"""STEP 13 #4: sizing, bump/skip, the ticket-check warning, the pool cap, re-checks, 1 push per coin."""
import asyncio
import time

from desk.agents.executor import Executor, size_ticket


def test_sizes(desk_env):
    from desk import config
    assert size_ticket(200, 200, 10_000_000)[:2] == (47.50, None)            # $200 -> $16 -> bump to $47.50
    assert size_ticket(200, 200, 10_000_000)[3] == 16
    config.set("executor.below_min", "skip", "test")
    assert size_ticket(200, 200, 10_000_000)[:2] == (None, "under $47.50")   # skip skips
    config.set("executor.below_min", "bump", "test")
    size, why, cap, raw = size_ticket(20_000, 20_000, 40_000)                # 8% = $1,600, pool $40,000
    assert (size, cap) == (800.0, "max_pool_pct")                             # caps any size at $800
    assert size_ticket(200, 30, 10_000_000)[:2] == (None, "no free stack")


def test_ticket_check_warning(desk_env):
    from desk import config, db
    assert db.current_stack("PAPER") == 200
    lvl, msg = config.ticket_check()
    assert lvl == "info" and msg == "tickets bumped to $47.50 = 23.8% of stack", msg
    config.set("executor.below_min", "skip", "test")
    lvl, msg = config.ticket_check()
    print(msg)
    assert lvl == "warn" and msg.startswith("every coin will be skipped, stack under $593.75")


def test_handle_paper_end_to_end(desk_env, monkeypatch):
    from desk import bus, db, links, notifier, sources
    pushes = []
    notifier._extra_sinks[:] = [lambda t, b, meta: pushes.append((t, b))]
    views = {"OK": {"price": 1.0, "liquidity": 60000}, "DROP": {"price": 1.0, "liquidity": 40000},
             "RAN": {"price": 1.2, "liquidity": 60000}}

    async def fake_dex(mints):
        return {m: {"raw": m} for m in mints if m in views}
    monkeypatch.setattr(sources, "dex_tokens", fake_dex)
    monkeypatch.setattr(sources, "pair_view", lambda p: views[p["raw"]])
    try:
        for m in views:
            db.upsert_coin(dict(mint=m, name=m.title(), migrated_at=time.time(), seen_at=time.time()))
        item = lambda m: {"scan": {"mint": m, "name": m.title(), "liquidityUsd": 60000}, "analyst": {"score": 82}, "price": 1.0, "name": m.title()}  # noqa: E731
        ex = Executor()
        out = asyncio.run(ex.handle(item("OK")))
        assert out["status"] == "bought" and out["sizeUsd"] == 47.5 and out["link"] == links.coin_url("OK", "solana")
        t, b = pushes[0]
        print("push:", t.replace("\n", " | "))
        assert t.startswith("PAPER · Buy Ok · $47.50 · 23.8% of stack") and "stop -6% · trail 12%" in t
        assert b[0] == {"label": "Buy on FOMO", "url": links.coin_url("OK", "solana")}
        assert [x["label"] for x in b] == ["Buy on FOMO", "Bought", "Skip"]
        a = db.q1("SELECT * FROM activity WHERE kind='bought'")
        assert a["title"] == "Bought Ok" and a["subtitle"].startswith("Executor · ") and a["value"] == "$47.50 · 23.8% of stack"
        assert db.open_positions()[0]["stop_price"] == 0.94
        assert asyncio.run(ex.handle(item("OK"))) is None                   # 1 push per coin per night
        assert asyncio.run(ex.handle(item("DROP")))["reason"] == "liquidity dropping"
        assert asyncio.run(ex.handle(item("RAN")))["reason"] == "ran before the push"
        assert len(pushes) == 1
    finally:
        notifier._extra_sinks.clear()
