"""AGENT 4 · EXECUTOR. Never picks a coin, never places an order. Arithmetic + 1 button."""
import asyncio
import json
import time

from .. import bus, config, db, links, notifier, sources, util
from .base import Agent


def size_ticket(stack, free, liquidity):
    """Returns (size or None, reason, cap_hit, raw_size)."""
    raw = stack * config.get("executor.stack_pct") / 100
    size, cap = raw, "stack_pct"
    pool_cap = (liquidity or 0) * config.get("executor.max_pool_pct") / 100
    if size > pool_cap:
        size, cap = pool_cap, "max_pool_pct"
    mt = config.get("executor.min_ticket_usd")
    if size < mt:
        if config.get("executor.below_min") == "skip":
            return None, f"under ${mt:.2f}", cap, raw
        if free < mt:
            return None, "no free stack", cap, raw
        size, cap = mt, "bump"
    max_t = stack * config.get("executor.max_ticket_pct") / 100      # the learner's rug lesson: size is the only rug defense
    if size > max_t:
        size, cap = max_t, "max_ticket_pct"
    if size < 5:                                                       # FOMO's smallest ticket in its fee table
        return None, "under $5", cap, raw
    if size > free:
        return None, "no free stack", cap, raw
    return round(size, 2), None, cap, raw


class Executor(Agent):
    name = "executor"

    async def run(self):
        while True:
            item = await self.next("executor")
            await self.wait_unpaused()
            self.beat()
            try:
                await self.handle(item)
            except Exception as e:  # noqa: BLE001
                self.log.exception("executor crashed: %s", e)

    def pushed_tonight(self, mint):
        return db.q1("SELECT 1 FROM signals WHERE mint=? AND ts>=? AND status!='skipped'", (mint, db.night_start())) is not None

    async def handle(self, item):
        scan, an = item["scan"], item["analyst"]
        mint, name = scan["mint"], item.get("name") or scan.get("name")
        mode = config.get("desk.mode")
        if self.pushed_tonight(mint) or db.skipped(mint):
            self.log.info("%s already pushed / skipped tonight, ignored", mint)
            return None
        if db.q1("SELECT 1 FROM positions WHERE mint=? AND closed_at IS NULL", (mint,)):
            self.log.info("%s already open, never a 2nd buy", mint)
            return None
        stack, free = db.current_stack(mode), db.free_stack(mode)
        try:
            fresh = (await sources.dex_tokens([mint])).get(mint)
        except Exception:  # noqa: BLE001
            fresh = None
        v = sources.pair_view(fresh) if fresh else {}
        price = v.get("price")
        link = links.coin_url(mint, "solana")
        if not price:
            return self._skip(mint, name, stack, None, None, "no price", mode, link)
        size, why, cap, raw = size_ticket(stack, free, v.get("liquidity"))
        if size is None:
            return self._skip(mint, name, stack, raw, cap, why, mode, link)
        liq_scan = scan.get("liquidityUsd") or 0
        if liq_scan and (v.get("liquidity") or 0) < liq_scan * (1 - config.get("executor.recheck_liq_drop_pct") / 100):
            return self._skip(mint, name, stack, raw, cap, "liquidity dropping", mode, link)
        p_an = item.get("price")
        if p_an and price > p_an * (1 + config.get("executor.recheck_price_up_pct") / 100):
            return self._skip(mint, name, stack, raw, cap, "ran before the push", mode, link)
        drop = -(v.get("p5") or 0)
        if config.get("executor.max_drop_m5_pct") < 100 and drop > config.get("executor.max_drop_m5_pct"):
            return self._skip(mint, name, stack, raw, cap, f"falling knife -{drop:.0f}% in 5m", mode, link)
        coin = db.coin(mint) or {}
        native = None
        if coin.get("vault_base") and coin.get("vault_quote"):
            try:
                native = (await sources.pool_natives([(coin["vault_base"], coin["vault_quote"])])).get((coin["vault_base"], coin["vault_quote"]))
            except Exception:  # noqa: BLE001
                native = None
        feats = {"liquidity": v.get("liquidity"), "score": an.get("score"), "chase": (an.get("answers") or {}).get("chase"),
                 "top10": scan.get("top10Pct"), "h1": v.get("p1"), "drop_m5": max(0.0, drop), "age_min": scan.get("ageMin"),
                 "holders": coin.get("holders"), "mcap": v.get("mcap")}

        pct = round(100 * size / stack, 1) if stack else 0
        layers = db.q1("SELECT COUNT(*) c FROM audits WHERE mint=? AND ts>=? AND pass=1", (mint, db.night_start()))["c"]
        aud = f"Auditor {layers}/8" if config.get("auditor.enabled") else "Auditor off"
        text = (f"Buy {name} · ${size:,.2f} · {pct:g}% of stack\n"
                f"{aud} · Analyst {an['score']} · stop -{util.gnum(config.get('risk.stop_pct'))}% · "
                f"trail {util.gnum(config.get('risk.trail_pct'))}%")
        sid = db.insert("signals", dict(mint=mint, ts=time.time(), price=price, size_usd=size, stack_pct=pct, link=link,
                                        mode=mode, status="sent", features=json.dumps(feats), native=native))
        buttons = [{"label": "Buy on FOMO", "url": link}, {"label": "Bought", "callback": f"bought:{sid}"},
                   {"label": "Skip", "callback": f"skip:{sid}"}]
        self.current = {"mint": mint, "name": name, "size": size, "pct": pct, "sid": sid, "ts": time.time(), "mode": mode}
        bus.emit("signal", {"mint": mint, "name": name, "sizeUsd": size, "stackPct": pct, "signalId": sid, "mode": mode,
                            "link": link})
        delivered = await notifier.notify(text, buttons, mint=mint, kind="buy")
        status = "sent"
        if not delivered:
            self.log.warning("%s push failed", mint)
            if mode == "LIVE":
                db.x("UPDATE signals SET status='skipped', reason='push failed' WHERE id=?", (sid,))
                status = "skipped"
        self.log.info("mint=%s stack=%.2f raw=%.2f cap=%s final=%.2f mode=%s status=%s link=%s", mint, stack, raw, cap, size,
                      mode, status, link)
        out = {"agent": "executor", "mint": mint, "signalPrice": price, "sizeUsd": size, "stackPct": pct, "link": link,
               "mode": mode, "status": status, "reason": None if delivered else "push failed"}
        if mode == "PAPER":
            self.fill(sid)          # PAPER: fill at the signal price at once (even if the push failed)
            out["status"] = "bought"
        elif status == "sent":
            asyncio.create_task(self._expire(sid))
        return out

    def _skip(self, mint, name, stack, raw, cap, reason, mode, link):
        db.insert("signals", dict(mint=mint, ts=time.time(), price=None, size_usd=None, stack_pct=None, link=link, mode=mode,
                                  status="skipped", reason=reason))
        db.add_activity("rejected", mint, "executor", f"Rejected {name}", f"Executor · {reason}", "Skipped")
        self.log.info("mint=%s stack=%.2f raw=%s cap=%s final=skip mode=%s status=skipped reason=%s link=%s", mint, stack, raw,
                      cap, mode, reason, link)
        bus.emit("signal", {"mint": mint, "name": name, "status": "skipped", "reason": reason})
        return {"agent": "executor", "mint": mint, "signalPrice": None, "sizeUsd": None, "stackPct": None, "link": link,
                "mode": mode, "status": "skipped", "reason": reason}

    async def _expire(self, sid):
        await asyncio.sleep(config.get("executor.confirm_window_min") * 60)
        s = db.q1("SELECT * FROM signals WHERE id=?", (sid,))
        if s and s["status"] == "sent":
            db.x("UPDATE signals SET status='missed' WHERE id=?", (sid,))
            self.log.info("signal %s missed (no tap in %s min)", sid, config.get("executor.confirm_window_min"))
            bus.emit("signal", {"mint": s["mint"], "signalId": sid, "status": "missed"})

    def fill(self, sid):
        s = db.q1("SELECT * FROM signals WHERE id=?", (sid,))
        if not s or s["status"] not in ("sent",):
            return None
        if db.q1("SELECT 1 FROM positions WHERE mint=? AND closed_at IS NULL", (s["mint"],)):
            return None
        stop_pct = config.get("risk.stop_pct")
        pid = db.insert("positions", dict(mint=s["mint"], opened_at=time.time(), entry_price=s["price"], size_usd=s["size_usd"],
                                          peak_price=s["price"], stop_price=s["price"] * (1 - stop_pct / 100), trail_active=0,
                                          mode=s["mode"], signal_id=sid, entry_native=s.get("native")))
        db.x("UPDATE signals SET status='bought' WHERE id=?", (sid,))
        c = db.coin(s["mint"]) or {}
        name = c.get("name") or util.short(s["mint"])
        db.add_activity("bought", s["mint"], "executor", f"Bought {name}", f"Executor · {util.hhmm()}",
                        f"${s['size_usd']:,.2f} · {s['stack_pct']:g}% of stack")
        self.last = {"mint": s["mint"], "name": name, "size": s["size_usd"], "pct": s["stack_pct"], "ts": time.time(),
                     "filled": True}
        self.current = None
        bus.emit("fill", {"mint": s["mint"], "name": name, "positionId": pid, "sizeUsd": s["size_usd"], "price": s["price"],
                          "mode": s["mode"]})
        bus.risk.put_nowait(pid)
        return pid

    # taps ([Bought] / [Skip]) from Telegram or the app
    def tap_bought(self, sid):
        s = db.q1("SELECT * FROM signals WHERE id=?", (sid,))
        if not s:
            return "unknown signal"
        if s["status"] != "sent":
            return f"signal is {s['status']}"
        pid = self.fill(sid)
        return "position open" if pid else "not opened"

    def tap_skip(self, sid):
        s = db.q1("SELECT * FROM signals WHERE id=?", (sid,))
        if not s:
            return "unknown signal"
        until = db.current_night()["started_at"] + 36 * 3600
        db.x("INSERT INTO skips VALUES (?,?) ON CONFLICT(mint) DO UPDATE SET until=excluded.until", (s["mint"], until))
        if s["status"] == "sent":
            db.x("UPDATE signals SET status='skipped', reason='tapped Skip' WHERE id=?", (sid,))
        return "skipped for the night"
