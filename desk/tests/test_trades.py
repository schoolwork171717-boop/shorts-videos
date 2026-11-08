"""Trades & PnL: realized, fees, win rate, profit factor, drawdown, by-exit totals, open unrealized, AUTO readiness."""
import time


def close(db, mint, pnl, fees, reason, t0, mode="PAPER"):
    return db.insert("positions", dict(mint=mint, opened_at=t0, entry_price=1.0, size_usd=47.5, peak_price=1.0, stop_price=0.94,
                                       closed_at=t0 + 600, exit_price=1 + pnl / 47.5, exit_reason=reason, pnl_usd=pnl,
                                       fees_usd=fees, mode=mode, exiting_at=t0 + 600))


def test_trade_stats_and_readiness(desk_env):
    from desk import api, db, links
    t = time.time()
    close(db, "A", 10.0, 1.7, "trail", t + 1)     # equity 210
    close(db, "B", -4.0, 1.6, "stop", t + 2)      # 206
    close(db, "C", -6.0, 1.6, "stop", t + 3)      # 200  (drawdown 10 from 210 = 4.76%)
    close(db, "D", 5.0, 1.7, "timeout", t + 4)    # 205
    close(db, "L", 99.0, 1.0, "trail", t + 5, mode="LIVE")   # LIVE never mixes into PAPER
    db.insert("positions", dict(mint="E", opened_at=t + 6, entry_price=2.0, size_usd=47.5, peak_price=2.0, stop_price=1.88, mode="PAPER"))
    db.add_price("E", 2.2, 100)
    d = api.trades("PAPER", "all")
    s = d["summary"]
    assert (s["realized"], s["fees"], s["trades"], s["wins"], s["losses"]) == (5.0, 6.6, 4, 2, 2)
    assert s["winRate"] == 50.0 and s["profitFactor"] == 1.5 and s["avgWin"] == 7.5 and s["avgLoss"] == -5.0
    assert (s["best"], s["worst"], s["startStack"]) == (10.0, -6.0, 200.0)
    assert s["maxDrawdown"] == 10.0 and abs(s["maxDrawdownPct"] - 4.76) < 0.01
    assert [c[1] for c in s["curve"]] == [10.0, 6.0, 0.0, 5.0]
    assert s["unrealized"] == 4.75                                   # 47.5 x +10%
    assert {b["reason"]: (b["n"], b["pnl"]) for b in d["byReason"]} == {"stop": (2, -10.0), "trail": (1, 10.0), "timeout": (1, 5.0)}
    assert [r["mint"] for r in d["closed"]] == ["D", "C", "B", "A"]  # newest first
    assert all(r["link"] == links.coin_url(r["mint"], "solana") for r in d["closed"] + d["open"])
    R = {i["label"]: i["ok"] for i in d["readiness"]["items"]}
    assert R["Net PnL after fees > $0"] and R["Profit factor ≥ 1.2"] and R["Max drawdown ≤ 25%"]
    assert not R["20+ closed PAPER trades"] and not R["3 full PAPER nights"] and d["readiness"]["ready"] is False
    assert d["readiness"]["burnerUsd"] == 42
    assert api.trades("LIVE", "all")["summary"]["realized"] == 99.0
    page = api.trades("PAPER", "all", limit=2)
    assert len(page["closed"]) == 2 and page["next"] == page["closed"][-1]["id"]
    assert [r["mint"] for r in api.trades("PAPER", "all", before=page["next"])["closed"]] == ["B", "A"]


def test_empty(desk_env):
    from desk import api
    d = api.trades("PAPER", "night")
    s = d["summary"]
    assert s["trades"] == 0 and s["realized"] == 0 and s["winRate"] is None and s["profitFactor"] is None and s["curve"] == []
    assert d["readiness"]["ready"] is False
