"""AGENT 1 · SCANNER. Counts and cuts. Owns every coin that graduates off pumpfun onto PumpSwap."""
import asyncio
import json
import re
import time

import websockets

from .. import bus, config, db, fields, sources, util
from .base import Agent, retry

WS_URL = "wss://pumpportal.fun/api/data"


def norm(name):
    """Copycat key: lowercase, strip spaces, digits, emoji and symbols."""
    return "".join(ch for ch in (name or "").lower() if ch.isalpha())


class Scanner(Agent):
    name = "scanner"

    def __init__(self):
        super().__init__()
        self.room: dict[str, dict] = {}
        self.runners: dict[str, tuple] = {}     # norm(name|symbol) -> (display name, mint, day)
        self.feed: list = []
        self.ws_connected = False
        self._reload_room()

    def _reload_room(self):
        since = time.time() - config.get("scanner.max_wait_min") * 60
        decided = {r["mint"] for r in db.q("SELECT DISTINCT mint FROM scans WHERE ts>=?", (db.night_start(),))}
        for c in db.q("SELECT * FROM coins WHERE migrated_at>=?", (since,)):
            if c["mint"] not in decided:
                self.room[c["mint"]] = {"mint": c["mint"], "migrated_at": c["migrated_at"]}

    async def run(self):
        await asyncio.gather(self.ws_loop(), self.poll_loop())

    # ---- input: PumpPortal, ONE connection, subscribeMigration only ----
    async def ws_loop(self):
        backoff = 1
        while True:
            try:
                async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=20, open_timeout=20) as ws:
                    await ws.send(json.dumps({"method": "subscribeMigration"}))
                    self.ws_connected = True
                    self.log.info("ws connected, subscribed to migrations")
                    backoff = 1
                    while True:
                        raw = await asyncio.wait_for(ws.recv(), timeout=config.get("scanner.ws_silence_s"))
                        await self.on_message(raw)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                self.ws_connected = False
                reason = "silent" if isinstance(e, asyncio.TimeoutError) else type(e).__name__
                db.insert("reconnects", dict(ts=time.time(), agent=self.name, reason=reason))
                self.log.warning("ws reconnect in %ss (%s)", backoff, reason)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60)

    async def on_message(self, raw):
        self.beat()
        try:
            m = json.loads(raw)
        except json.JSONDecodeError:
            return
        mint = fields.get("pumpportal", "mint", m)
        if not mint or fields.get("pumpportal", "tx_type", m) != "migrate":
            return
        if self.paused:
            self.log.info("paused, ignoring migration %s", mint)
            return
        await self.on_migration(mint, m)

    async def on_migration(self, mint, m, migrated_at=None):
        if mint in self.room or db.q1("SELECT 1 FROM scans WHERE mint=? AND ts>=?", (mint, db.night_start())):
            return
        now = migrated_at or time.time()
        db.upsert_coin(dict(mint=mint, signature=fields.get("pumpportal", "signature", m), migrated_at=now, seen_at=time.time(),
                            creator=fields.get("pumpportal", "creator", m), pool=fields.get("pumpportal", "pool", m)))
        self.room[mint] = {"mint": mint, "migrated_at": now}
        self.log.info("graduated %s, into the waiting room (%d)", mint, len(self.room))
        bus.emit("scan", {"agent": "scanner", "mint": mint, "event": "new", "room": len(self.room)})
        asyncio.create_task(self.fill_creator(mint, m))

    async def fill_creator(self, mint, m):
        """Creator from the message; if null there, from the RugCheck report. Creator balance NOW."""
        creator = fields.get("pumpportal", "creator", m)
        if not creator:
            for _ in range(6):
                rep, err = await retry(lambda: sources.rugcheck(mint, "report"), 1, 3)
                creator = fields.get("rugcheck_report", "creator", rep) if rep else None
                if creator:
                    break
                await asyncio.sleep(10)
        if not creator:
            self.log.info("%s creator unknown (null), Auditor layer 3 will be red", mint)
            return
        bal, err = await retry(lambda: sources.owner_balance(creator, mint), 3, 2)
        db.upsert_coin(dict(mint=mint, creator=creator, creator_balance_at_migration=bal))
        self.log.info("%s creator %s balance at migration %s", mint, creator, bal)

    # ---- every [60]s: DexScreener for the whole waiting room ----
    async def poll_loop(self):
        while True:
            await self.wait_unpaused()
            self.beat()
            t0 = time.time()
            try:
                await self.poll_once()
            except sources.RateLimited:
                self.log.warning("DexScreener 429, waiting %ss, room kept (%d)", config.get("scanner.dex_backoff_s"), len(self.room))
                await asyncio.sleep(config.get("scanner.dex_backoff_s"))
            except Exception as e:  # noqa: BLE001
                self.log.warning("poll failed: %s", e)
            await asyncio.sleep(max(1, config.get("scanner.poll_s") - (time.time() - t0)))

    async def poll_once(self):
        if not self.room:
            return
        pairs = await sources.dex_tokens(list(self.room))
        now = time.time()
        for mint, entry in list(self.room.items()):
            age_min = (now - entry["migrated_at"]) / 60
            p = pairs.get(mint)
            if p is None:     # DexScreener doesn't know it yet: it waits in the room
                if age_min >= config.get("scanner.max_wait_min"):
                    self.decide(mint, None, "kill", "never qualified", age_min)
                continue
            v = sources.pair_view(p)
            if v["price"] is not None:
                db.add_price(mint, v["price"], v["v5"])
            db.upsert_coin(dict(mint=mint, name=v["name"], symbol=v["symbol"], pool=v["pool"]))
            self.note_runner(mint, v)
            if age_min < config.get("scanner.min_pool_age_min"):
                continue
            await self.evaluate(mint, v, age_min)
            if mint in self.room and age_min >= config.get("scanner.max_wait_min"):
                self.decide(mint, v, "kill", "never qualified", age_min)

    def note_runner(self, mint, v):
        if (v["p24"] or 0) >= config.get("scanner.runner_h24_pct"):
            day = time.strftime("%Y-%m-%d")
            for k in (norm(v["name"]), norm(v["symbol"])):
                if len(k) >= 3:
                    self.runners[k] = (v["name"] or v["symbol"], mint, day)

    def copycat_of(self, mint, v):
        day = time.strftime("%Y-%m-%d")
        for key in {norm(v["name"]), norm(v["symbol"])}:
            if len(key) < 3:
                continue
            for rk, (rname, rmint, rday) in self.runners.items():
                if rmint == mint or rday != day:
                    continue
                if key == rk or key in rk or rk in key:
                    return rname
        return None

    async def evaluate(self, mint, v, age_min):
        liq = v["liquidity"] or 0
        v["top10"] = None
        if liq < config.get("scanner.min_liquidity_usd"):
            return self.decide(mint, v, "kill", f"liq {util.kusd(liq)}", age_min)
        try:
            supply, _ = await sources.token_supply(mint)
            v["top10"], src = await sources.top10_pct(mint, v["pool"], supply)
        except Exception as e:  # noqa: BLE001
            self.log.info("%s top10 unreadable (%s), waiting", mint, e)
            return
        if v["top10"] is None:
            return
        if v["top10"] > config.get("scanner.max_top10_pct"):
            return self.decide(mint, v, "kill", f"top 10 hold {v['top10']:.0f}%", age_min)
        if (v["p1"] or 0) > config.get("scanner.max_h1_change_pct"):
            return self.decide(mint, v, "kill", f"+{v['p1']:.0f}% in 1h", age_min)
        cc = self.copycat_of(mint, v)
        if cc:
            return self.decide(mint, v, "kill", f"copycat of {cc}", age_min)
        return self.decide(mint, v, "pass", None, age_min)

    def decide(self, mint, v, verdict, reason, age_min):
        v = v or {}
        out = {"agent": "scanner", "mint": mint, "name": v.get("name"), "symbol": v.get("symbol"), "pool": v.get("pool"),
               "liquidityUsd": v.get("liquidity"), "top10Pct": v.get("top10"), "h1ChangePct": v.get("p1"),
               "ageMin": int(age_min), "verdict": verdict, "reason": reason, "ts": util.iso()}
        db.insert("scans", dict(mint=mint, ts=time.time(), liquidity_usd=out["liquidityUsd"], top10_pct=out["top10Pct"],
                                h1_change_pct=out["h1ChangePct"], age_min=age_min, verdict=verdict, reason=reason))
        self.room.pop(mint, None)
        self.log.info("ts=%s mint=%s verdict=%s reason=%s liq=%s top10=%s h1=%s age=%d", out["ts"], mint, verdict, reason,
                      out["liquidityUsd"], out["top10Pct"], out["h1ChangePct"], age_min)
        self.last = out
        bus.emit("scan", out)
        if verdict == "pass":
            bus.auditor.put_nowait(out)
        return out
