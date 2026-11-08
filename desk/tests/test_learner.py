"""Learn from mistakes, using the two real PAPER losses from the exercise desk (2026-11-08) as fixtures."""
import asyncio
import json
import time


def seed_real_losses(db):
    t = time.time() - 3600
    rows = [  # mint, name, entry, exit, pnl, fees, hold s, features at entry (from that night's scans/verdicts)
        ("ASr7fomo", "fomo", 6.088e-05, 1.995e-06, -46.83, 0.88, 480,
         {"liquidity": 18041.87, "score": 45, "chase": 0.7945, "top10": 2.12, "h1": 63.56, "drop_m5": None}),
        ("78gdBEAN", "PUSH THE BEAN", 2.735e-05, 2.472e-05, -6.20, 1.63, 30,
         {"liquidity": 11083.53, "score": 100, "chase": 0.0, "top10": 22.39, "h1": -39.31, "drop_m5": 55.0}),
    ]
    for i, (m, n, entry, ex, pnl, fees, hold, f) in enumerate(rows):
        db.upsert_coin(dict(mint=m, name=n, migrated_at=t, seen_at=t))
        sid = db.insert("signals", dict(mint=m, ts=t + i * 600, price=entry, size_usd=47.5, stack_pct=23.8, link="x", mode="PAPER",
                                        status="bought", features=json.dumps(f)))
        db.insert("positions", dict(mint=m, opened_at=t + i * 600, entry_price=entry, size_usd=47.5, peak_price=entry,
                                    stop_price=entry * 0.94, closed_at=t + i * 600 + hold, exit_price=ex, exit_reason="stop",
                                    pnl_usd=pnl, fees_usd=fees, mode="PAPER", signal_id=sid))


def test_learns_from_the_two_real_losses(desk_env):
    from desk import config, db, learner
    config.set("scanner.min_liquidity_usd", 8000, "test")        # the exercise desk's loosened gate
    seed_real_losses(db)
    out = asyncio.run(learner.run(push=False))
    got = {l["key"]: (l["old"], l["new"]) for l in out}
    print(*[f"#{l['id']} {l['key']}: {l['old']} -> {l['new']} | {l['text']}" for l in out], sep="\n")
    assert got["executor.max_ticket_pct"] == (100, 10)             # fomo: -98.6% through the stop -> size cap
    assert got["risk.poll_s"] == (15, 5)                           # both stops filled past the line
    assert got["scanner.min_liquidity_usd"] == (8000, 19846)       # both losers under $18K, no winner: 18041.87 x 1.1
    # overfitting guards: the losers disagree on score/chase/top10/1h, so no threshold fits inside the range or the 3x step
    assert set(got) == {"executor.max_ticket_pct", "risk.poll_s", "scanner.min_liquidity_usd"}, got
    pm = {r["mint"]: json.loads(r["tags"]) for r in db.q("SELECT * FROM postmortems")}
    assert set(pm["ASr7fomo"]) >= {"rug", "gap"} and set(pm["78gdBEAN"]) >= {"gap", "fast", "fee-heavy"}
    assert config.get("executor.max_ticket_pct") == 10 and config.get("risk.poll_s") == 5
    assert db.q1("SELECT who FROM change_log WHERE key='risk.poll_s'")["who"] == "learner"
    assert asyncio.run(learner.run(push=False)) == []              # nothing new to learn: no duplicates


def test_never_loosens_and_undo_sticks(desk_env):
    from desk import config, db, learner
    seed_real_losses(db)                                           # default min liquidity is $40,000: already tighter
    out = asyncio.run(learner.run(push=False))
    assert "scanner.min_liquidity_usd" not in {l["key"] for l in out} and config.get("scanner.min_liquidity_usd") == 40000
    lid = [l["id"] for l in out if l["key"] == "risk.poll_s"][0]
    assert learner.undo(lid).startswith(f"lesson #{lid} undone") and config.get("risk.poll_s") == 15
    assert asyncio.run(learner.run(push=False)) == []              # an undone lesson needs 2 NEW losses to come back
    assert config.get("risk.poll_s") == 15


def test_suggest_mode_changes_nothing(desk_env):
    from desk import config, db, learner
    config.set("desk.learner", "suggest", "test")
    seed_real_losses(db)
    out = asyncio.run(learner.run(push=False))
    assert out and all(l["status"] == "suggested" for l in out) and config.get("executor.max_ticket_pct") == 100
    lid = [l["id"] for l in out if l["key"] == "executor.max_ticket_pct"][0]
    assert learner.apply(lid) == f"lesson #{lid} applied" and config.get("executor.max_ticket_pct") == 10


def test_ticket_cap_and_falling_knife(desk_env, monkeypatch):
    from desk import config, db, sources
    from desk.agents.executor import Executor, size_ticket
    config.set("executor.max_ticket_pct", 10, "test")
    assert size_ticket(200, 200, 1e7)[:3] == (20.0, None, "max_ticket_pct")   # bump to $47.50, capped at 10% = $20
    config.set("executor.max_drop_m5_pct", 30, "test")

    async def dex(m):
        return {x: {"raw": x} for x in m}
    monkeypatch.setattr(sources, "dex_tokens", dex)
    monkeypatch.setattr(sources, "pair_view", lambda p: {"price": 1.0, "liquidity": 60000, "p5": -55, "p1": -39})
    db.upsert_coin(dict(mint="K", name="Knife", migrated_at=time.time(), seen_at=time.time()))
    out = asyncio.run(Executor().handle({"scan": {"mint": "K", "name": "Knife", "liquidityUsd": 60000}, "analyst": {"score": 100},
                                         "price": 1.0, "name": "Knife"}))
    assert out["status"] == "skipped" and out["reason"] == "falling knife -55% in 5m"


def test_risk_prices_from_the_pool_relative_to_entry(desk_env, monkeypatch):
    from desk import db, sources
    from desk.agents.risk import Risk
    db.upsert_coin(dict(mint="P", name="Poolcoin", migrated_at=time.time(), seen_at=time.time(), vault_base="VB", vault_quote="VQ"))
    pid = db.insert("positions", dict(mint="P", opened_at=time.time(), entry_price=0.002733, size_usd=20, peak_price=0.002733,
                                      stop_price=0.002733 * 0.94, mode="PAPER", entry_native=3.0e-05))

    async def dex(m):
        return {"P": {"raw": "P"}}

    async def nat(v):
        return {("VB", "VQ"): 2.7e-05}            # pool ratio fell 10% since entry
    monkeypatch.setattr(sources, "dex_tokens", dex)
    monkeypatch.setattr(sources, "pair_view", lambda p: {"price": 0.002733, "liquidity": 190000, "v5": 1})  # stale cache: unchanged
    monkeypatch.setattr(sources, "pool_natives", nat)
    asyncio.run(Risk().poll_once())
    p = db.q1("SELECT * FROM positions WHERE id=?", (pid,))
    assert p["exit_reason"] == "stop" and abs(p["exit_price"] - 0.002733 * 0.9) < 1e-12   # stale DexScreener would have held
