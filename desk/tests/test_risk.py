"""STEP 13 #3: trail / stop / timeout, stops never move down, 'set stop to -8%' end to end."""
import asyncio
import time

from desk.agents import risk as R


def pos(**kw):
    p = {"id": 1, "mint": "M", "entry_price": 1.0, "size_usd": 47.5, "peak_price": 1.0, "stop_price": 0.94, "trail_active": 0,
         "opened_at": time.time(), "mode": "PAPER"}
    p.update(kw)
    return p


def test_rules(desk_env):
    p = pos()
    assert R.evaluate(p, 1.25) is None and p["trail_active"] == 1            # +25%: trail on
    assert R.evaluate(p, 1.25 * 0.87) == "trail"                             # 13% off the top: trail exit
    assert R.evaluate(pos(), 0.939) == "stop"                                # -6.1%: stop
    assert R.evaluate(pos(), 0.941) is None
    assert R.evaluate(pos(opened_at=time.time() - 3 * 3600), 1.04) == "timeout"   # 3h at +4%: dead money
    assert R.evaluate(pos(opened_at=time.time() - 3 * 3600), 1.06) is None
    p = pos(); R.evaluate(p, 1.25); R.evaluate(p, 1.0)
    assert p["trail_active"] == 1                                            # never turns off


def open_pos(db, mint, stop_pct, price=1.0):
    return db.insert("positions", dict(mint=mint, opened_at=time.time(), entry_price=price, size_usd=47.5, peak_price=price,
                                       stop_price=price * (1 - stop_pct / 100), trail_active=0, mode="PAPER"))


def test_loosening_never_moves_open_stop_down(desk_env):
    from desk import config, db
    pid = open_pos(db, "A", 6)
    config.set("risk.stop_pct", 8, "test")
    assert abs(db.position_stop_pct(db.q1("SELECT * FROM positions WHERE id=?", (pid,))) - 6) < 1e-9
    config.set("risk.stop_pct", 4, "test")                                    # tighter: applies to open ones
    assert abs(db.position_stop_pct(db.q1("SELECT * FROM positions WHERE id=?", (pid,))) - 4) < 1e-9
    config.set("risk.stop_pct", 10, "test")
    assert abs(db.position_stop_pct(db.q1("SELECT * FROM positions WHERE id=?", (pid,))) - 4) < 1e-9


def test_set_stop_to_8_end_to_end(desk_env):
    from desk import api, commands, config, db, notifier
    from desk.main import Desk
    pushes = []
    notifier._extra_sinks[:] = [lambda t, b, meta: pushes.append((t, b))]
    try:
        for m, n in (("OLD", "Oldcoin"), ("NEW", "Newcoin")):
            db.upsert_coin(dict(mint=m, name=n, migrated_at=time.time(), seen_at=time.time()))
        old = open_pos(db, "OLD", config.get("risk.stop_pct"))                 # opened at -6%
        reply = asyncio.run(commands.handle("set stop to -8%"))[0][0]
        assert reply.startswith("stop -6% -> -8%"), reply
        new = open_pos(db, "NEW", config.get("risk.stop_pct"))                 # new PAPER position at -8%
        risk = R.Risk()
        asyncio.run(risk.poll_once(prices={"OLD": (0.95, 50000, 100), "NEW": (0.919, 50000, 100)}))   # NEW drops 8.1%
        text = [t for t, _ in pushes if "Newcoin" in t][0]
        print("push:", text)
        assert text.startswith("PAPER · Newcoin hit the -8% stop · -$")
        btn = [b for t, bs in pushes if "Newcoin" in t for b in bs][0]
        from desk import links
        assert btn == {"label": "Sell on FOMO", "url": links.coin_url("NEW", "solana")}
        row = db.q1("SELECT * FROM activity WHERE mint='NEW'")
        print("activity:", row["title"], "/", row["subtitle"], "/", row["value"])
        assert (row["title"], row["subtitle"]) == ("Stopped Newcoin", "Risk · -8% stop") and row["value"].startswith("-$")
        mark = [m for m in api.chart("LIVE")["marks"] if m["mint"] == "NEW"][0]
        print("mark:", mark["text"])
        assert mark["text"].startswith("-8% · -$") and mark["kind"] == "loss"
        api.desk = Desk()
        pill = [a for a in api.agent_cards() if a["name"] == "risk"][0]
        assert f"stop -{pill['stopPct']:g}%" == "stop -8%"
        o = db.q1("SELECT * FROM positions WHERE id=?", (old,))
        assert o["closed_at"] is None and abs(db.position_stop_pct(o) - 6) < 1e-9     # still -6%
        assert api.coin("OLD")["position"]["stopPct"] == 6
    finally:
        notifier._extra_sinks.clear()


def test_paper_pnl_uses_fees(desk_env):
    from desk import fees
    net, pc, f = R.pnl(pos(), 1.0875)
    gross = 47.5 * 0.0875
    assert abs(f - (fees.side_fee(47.5) + fees.side_fee(47.5 * 1.0875))) < 1e-6 and abs(net - round(gross - f, 2)) < 1e-9
    assert abs(fees.side_fee(47.5) - 0.855) < 1e-9          # flat 0.95 minus 10% ref discount
    assert abs(fees.side_fee(20) - 0.36) < 1e-9            # 2% of $20 minus 10%
    assert abs(fees.side_fee(1000) - 4.5) < 1e-9           # 0.50% of $1000 minus 10%
