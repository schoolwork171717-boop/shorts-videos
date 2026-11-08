"""Live app: /api/live snapshot (auth, funnel, history tape, open positions) and Risk price events."""
import asyncio
import time

from fastapi.testclient import TestClient


def test_live_snapshot_and_price_events(desk_env):
    from desk import api, bus, config, db
    from desk.agents.risk import Risk
    t = time.time()
    db.upsert_coin(dict(mint="M1", name="Onecoin", migrated_at=t, seen_at=t))
    db.upsert_coin(dict(mint="M2", name="Twocoin", migrated_at=t, seen_at=t))
    db.insert("scans", dict(mint="M1", ts=t, liquidity_usd=50000, verdict="pass"))
    db.insert("scans", dict(mint="M2", ts=t, liquidity_usd=9000, verdict="kill", reason="liq $9.0K"))
    for n in range(1, 9):
        db.insert("audits", {"mint": "M1", "ts": t, "layer": n, "name": f"L{n}", "value_text": "ok", "pass": 1, "source": "rpc"})
    db.insert("verdicts", {"mint": "M1", "ts": t, "score": 80, "pass": 1, "model": "rules"})
    pid = db.insert("positions", dict(mint="M1", opened_at=t, entry_price=1.0, size_usd=47.5, peak_price=1.0, stop_price=0.94, mode="PAPER"))
    api.STARTED = time.time() + 1          # everything above is "history" for the tape
    c = TestClient(api.app)
    assert c.get("/api/live").status_code == 401
    d = c.get("/api/live", headers={"Authorization": f"Bearer {config.secret('APP_TOKEN')}"}).json()
    f = d["funnel"]
    assert (f["heard"], f["scannerPass"], f["scannerKill"], f["cleared"], f["analystPass"], f["filled"]) == (2, 1, 1, 1, 1, 1)
    kinds = {e["kind"] for e in d["events"]}
    assert {"scan", "audit", "verdict", "fill"} <= kinds
    assert d["trades"]["open"][0]["id"] == pid and d["state"]["mode"] == "PAPER"
    q = bus.subscribe()
    asyncio.run(Risk().poll_once(prices={"M1": (1.1, 50000, 100)}))
    ev = [q.get_nowait() for _ in range(q.qsize())]
    pe = [e for e in ev if e["kind"] == "price"][0]["data"]
    assert pe["positionId"] == pid and pe["price"] == 1.1 and pe["unrealized"] == 4.75
