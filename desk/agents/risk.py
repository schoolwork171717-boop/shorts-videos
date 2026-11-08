"""AGENT 5 · RISK. Decides exits and sends the Sell button. Never moves a stop down."""
import asyncio
import time

from .. import bus, config, db, fees, links, notifier, sources, util
from .base import Agent

ACT_SUB = {"trail": "Risk · trailing stop", "timeout": "Risk · timeout", "pulled": "Risk · liquidity pulled"}


def evaluate(p, price, now=None):
    """Apply the rules in order. Mutates p (peak, trail_active). Returns exit reason or None."""
    now = now or time.time()
    entry = p["entry_price"]
    p["peak_price"] = max(p["peak_price"] or price, price)
    if price <= p["stop_price"]:
        return "stop"
    if price >= entry * (1 + config.get("risk.trail_start_pct") / 100):
        p["trail_active"] = 1
    if p["trail_active"] and price <= p["peak_price"] * (1 - config.get("risk.trail_pct") / 100):
        return "trail"
    if now - p["opened_at"] >= config.get("risk.timeout_h") * 3600 and price < entry * (1 + config.get("risk.timeout_min_gain_pct") / 100):
        return "timeout"
    return None


def exit_line(p):
    """The current exit line: the stop, or the trail line once the trail is on (whichever is higher)."""
    line = p["stop_price"]
    if p.get("trail_active"):
        line = max(line, p["peak_price"] * (1 - config.get("risk.trail_pct") / 100))
    return line


def pnl(p, exit_price):
    gross = p["size_usd"] * (exit_price / p["entry_price"] - 1)
    f = fees.round_trip(p["size_usd"], p["size_usd"] * exit_price / p["entry_price"])
    net = round(gross - f, 2)
    return net, round(100 * net / p["size_usd"], 2), round(f, 2)


class Risk(Agent):
    name = "risk"

    def __init__(self):
        super().__init__()
        self.no_price: dict[int, int] = {}
        self.missed_polls = 0
        self.dex: dict = {}          # mint -> (price, liquidity, v5) from the last DexScreener read
        self.last_dex = 0.0

    def can_pause(self):
        return not db.open_positions()

    async def run(self):
        while True:
            self.beat()
            t0 = time.time()
            try:
                await self.poll_once()
            except sources.RateLimited:
                self.missed_polls += 1
                self.log.warning("429, backing off %ss (missed polls so far: %d)", config.get("risk.backoff_s"), self.missed_polls)
                await asyncio.sleep(config.get("risk.backoff_s"))
            except Exception as e:  # noqa: BLE001
                self.log.warning("poll failed: %s", e)
            try:
                await asyncio.wait_for(bus.risk.get(), timeout=max(0.5, config.get("risk.poll_s") - (time.time() - t0)))
            except asyncio.TimeoutError:
                pass

    async def poll_once(self, prices: dict | None = None, now=None):
        opn = db.q("SELECT * FROM positions WHERE closed_at IS NULL")
        if not opn:
            self.current = None
            return
        self.current = {"open": len(opn)}
        await self._repush_exiting([p for p in opn if p["exiting_at"]])
        live = [p for p in opn if not p["exiting_at"]]
        if not live:
            return
        if prices is None:
            prices = await self._prices(live)
        for p in live:
            price, liq, v5 = prices.get(p["mint"], (None, None, None))
            name = (db.coin(p["mint"]) or {}).get("name") or util.short(p["mint"])
            if not price:
                self.no_price[p["id"]] = self.no_price.get(p["id"], 0) + 1
                self.log.info("pos=%s %s no price (%d)", p["id"], p["mint"], self.no_price[p["id"]])
                if self.no_price[p["id"]] == config.get("risk.no_price_polls"):
                    await notifier.notify(f"{name}: no price for 1 min",
                                          [{"label": "Sell on FOMO", "url": links.coin_url(p["mint"], "solana")}],
                                          mint=p["mint"], kind="alert")
                continue
            self.no_price[p["id"]] = 0
            db.add_price(p["mint"], price, v5, ts=now)
            if liq is not None and liq <= 0:
                last = price
                await self.exit(p, "pulled", last, name, now)
                continue
            reason = evaluate(p, price, now)
            db.x("UPDATE positions SET peak_price=?, trail_active=? WHERE id=?", (p["peak_price"], p["trail_active"], p["id"]))
            bus.emit("price", {"mint": p["mint"], "name": name, "positionId": p["id"], "price": price, "entry": p["entry_price"],
                               "unrealized": round(p["size_usd"] * (price / p["entry_price"] - 1), 2), "exitLine": exit_line(p),
                               "peak": p["peak_price"], "trailActive": bool(p["trail_active"])})
            self.log.info("pos=%s mint=%s price=%.10g peak=%.10g stop=%.10g trail_line=%s action=%s", p["id"], p["mint"], price,
                          p["peak_price"], p["stop_price"],
                          f"{p['peak_price'] * (1 - config.get('risk.trail_pct') / 100):.10g}" if p["trail_active"] else "off",
                          reason or "hold")
            if reason:
                await self.exit(p, reason, price, name, now)

    async def _prices(self, live):
        """Price from the pool's own vaults every poll (DexScreener caches ~30s: both early losses gapped inside that window),
        as a ratio to the on-chain reading at entry, so the stop math never mixes two sources.
        DexScreener stays the source for liquidity and for positions without vaults, read at most every 30s."""
        now = time.time()
        need_dex = now - self.last_dex >= max(30, config.get("risk.poll_s")) or any(not p.get("entry_native") for p in live)
        if need_dex:
            pairs = await sources.dex_tokens([p["mint"] for p in live])
            for m, pr in pairs.items():
                v = sources.pair_view(pr)
                self.dex[m] = (v["price"], v["liquidity"], v["v5"])
            self.last_dex = now
        out = {m: self.dex[m] for m in (p["mint"] for p in live) if m in self.dex}
        vaults = {}
        for p in live:
            c = db.coin(p["mint"]) or {}
            if p.get("entry_native") and c.get("vault_base") and c.get("vault_quote"):
                vaults[p["id"]] = (c["vault_base"], c["vault_quote"])
        if vaults:
            try:
                nat = await sources.pool_natives(list(set(vaults.values())))
            except Exception as e:  # noqa: BLE001
                self.log.info("on-chain read failed (%s), DexScreener price used", e)
                nat = {}
            for p in live:
                n = nat.get(vaults.get(p["id"]))
                if n:
                    liq, v5 = (out.get(p["mint"]) or (None, None, None))[1:]
                    out[p["mint"]] = (p["entry_price"] * n / p["entry_native"], liq, v5)
        return out

    async def exit(self, p, reason, exit_price, name, now=None):
        now = now or time.time()
        net, pc, f = pnl(p, exit_price)
        stop_pct = db.position_stop_pct(p)
        link = links.coin_url(p["mint"], "solana")
        mode = p["mode"]
        if mode == "PAPER":
            db.x("UPDATE positions SET closed_at=?, exit_price=?, exit_reason=?, pnl_usd=?, fees_usd=?, exiting_at=? WHERE id=?",
                 (now, exit_price, reason, net, f, now, p["id"]))
            status = "closed"
            self._activity(p, reason, net, pc, stop_pct, name)
        else:
            db.x("UPDATE positions SET exit_price=?, exit_reason=?, pnl_usd=?, fees_usd=?, exiting_at=? WHERE id=?",
                 (exit_price, reason, net, f, now, p["id"]))
            status = "exiting"
        if reason == "trail":
            text = f"Sold {name} · {util.usd(net, True)} ({pc:+.2f}%)"
        elif reason == "stop":
            text = f"{name} hit the -{util.gnum(stop_pct)}% stop · -${abs(net):,.2f}"
        elif reason == "timeout":
            text = f"Sell {name}, dead money · {pc:+.2f}% in {util.gnum(config.get('risk.timeout_h'))}h"
        else:
            text = f"{name}: liquidity pulled, sell now · {util.usd(net, True)}"
        buttons = [{"label": "Sell on FOMO", "url": link}]
        if mode == "LIVE":
            buttons.append({"label": "Sold", "callback": f"sold:{p['id']}"})
        out = {"agent": "risk", "mint": p["mint"], "name": name, "ts": util.iso(now), "reason": reason,
               "entryPrice": p["entry_price"], "exitPrice": exit_price, "peakPrice": p["peak_price"], "pnlUsd": net, "pct": pc,
               "feesUsd": f, "stopPct": stop_pct, "mode": mode, "status": status, "link": link}
        self.last = out | {"tsf": now}
        bus.emit("exit", out)
        self.log.info("EXIT %s", out)
        await notifier.notify(text, buttons, mint=p["mint"], kind="exit")
        if mode == "PAPER":
            from .. import learner
            asyncio.create_task(learner.run())
        return out

    def _activity(self, p, reason, net, pc, stop_pct, name):
        if reason == "stop":
            db.add_activity("stopped", p["mint"], "risk", f"Stopped {name}", f"Risk · -{util.gnum(stop_pct)}% stop",
                            f"-${abs(net):,.2f}")
        elif reason == "pulled":
            db.add_activity("stopped", p["mint"], "risk", f"Stopped {name}", ACT_SUB["pulled"], util.usd(net, True))
        else:
            db.add_activity("sold", p["mint"], "risk", f"Sold {name}", ACT_SUB[reason], f"{util.usd(net, True)} · {pc:+.2f}%")

    async def _repush_exiting(self, exiting):
        for p in exiting:
            key = f"repushed.{p['id']}"
            if time.time() - p["exiting_at"] > config.get("risk.confirm_window_min") * 60 and not db.kv_get(key):
                db.kv_set(key, True)
                name = (db.coin(p["mint"]) or {}).get("name") or util.short(p["mint"])
                await notifier.notify(f"{name} still open, sell on FOMO",
                                      [{"label": "Sell on FOMO", "url": links.coin_url(p["mint"], "solana")},
                                       {"label": "Sold", "callback": f"sold:{p['id']}"}], mint=p["mint"], kind="exit")

    def tap_sold(self, pid):
        p = db.q1("SELECT * FROM positions WHERE id=?", (pid,))
        if not p:
            return "unknown position"
        if p["closed_at"]:
            return "already closed"
        if not p["exiting_at"]:
            # manual sell from the app/Telegram before Risk fired: close at the last polled price
            lp = db.last_price(p["mint"])
            if not lp:
                return "no price yet"
            net, pc, f = pnl(p, lp["price"])
            db.x("UPDATE positions SET exit_price=?, exit_reason='manual', pnl_usd=?, fees_usd=? WHERE id=?",
                 (lp["price"], net, f, pid))
            p = db.q1("SELECT * FROM positions WHERE id=?", (pid,))
        db.x("UPDATE positions SET closed_at=? WHERE id=?", (time.time(), pid))
        name = (db.coin(p["mint"]) or {}).get("name") or util.short(p["mint"])
        self._activity(p, p["exit_reason"] if p["exit_reason"] in ACT_SUB or p["exit_reason"] == "stop" else "trail",
                       p["pnl_usd"], round(100 * p["pnl_usd"] / p["size_usd"], 2), db.position_stop_pct(p), name)
        bus.emit("exit", {"mint": p["mint"], "status": "closed", "positionId": pid})
        from .. import learner
        try:
            asyncio.get_running_loop().create_task(learner.run())
        except RuntimeError:
            pass
        return "closed"
