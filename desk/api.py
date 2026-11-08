"""JSON + SSE for the app (plan A). Every /api call needs APP_TOKEN (Authorization: Bearer), else 401."""
import asyncio
import hmac
import time
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import bus, commands, config, db, links, notifier, sources, util, webpush
from .agents import auditor as auditor_mod
from .agents import risk as risk_mod

WEB = Path(__file__).resolve().parent / "web"
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
desk = None  # set by main


def auth(request: Request):
    h = request.headers.get("authorization", "")
    tok = h[7:] if h.lower().startswith("bearer ") else ""
    if not tok or not hmac.compare_digest(tok.encode(), config.secret("APP_TOKEN").encode()):
        raise HTTPException(401, "unauthorized")


A = [Depends(auth)]


def _name(mint):
    c = db.coin(mint) or {}
    return c.get("name") or c.get("symbol") or util.short(mint)


# ------------------------------------------------------------------ state
def agent_cards():
    ns = db.night_start()
    ag = desk.agents if desk else {}
    hb = {r["agent"]: r["ts"] for r in db.q("SELECT * FROM heartbeats")}
    paused = {a: bool(db.kv_get(f"paused.{a}", False)) for a in commands.AGENTS}

    def base(a):
        return {"name": a, "paused": paused[a], "heartbeatAge": round(time.time() - hb[a], 1) if a in hb else None}

    feed = db.q("SELECT s.mint, s.verdict, s.reason, s.liquidity_usd liq, s.ts, c.name, c.symbol FROM scans s "
                "LEFT JOIN coins c ON c.mint=s.mint WHERE s.ts>=? ORDER BY s.ts DESC LIMIT 6", (ns,))
    sc = ag.get("scanner")
    scanner = base("scanner") | {
        "count": db.q1("SELECT COUNT(*) c FROM coins WHERE seen_at>=?", (ns,))["c"],
        "waiting": len(sc.room) if sc else 0, "wsConnected": bool(sc and sc.ws_connected),
        "passed": db.q1("SELECT COUNT(*) c FROM scans WHERE ts>=? AND verdict='pass'", (ns,))["c"],
        "feed": [{"mint": f["mint"], "name": f["name"] or f["symbol"] or util.short(f["mint"]), "verdict": f["verdict"],
                  "reason": f["reason"], "liq": f["liq"], "ts": f["ts"]} for f in feed]}
    au = ag.get("auditor")
    last_mint = db.q1("SELECT mint FROM audits WHERE ts>=? ORDER BY ts DESC LIMIT 1", (ns,))
    strips = []
    if last_mint:
        rows = db.q("SELECT layer, pass, value_text FROM audits WHERE mint=? AND ts>=? ORDER BY layer", (last_mint["mint"], ns))
        strips = [{"n": r["layer"], "pass": bool(r["pass"]), "value": r["value_text"]} for r in rows]
    auditor = base("auditor") | {
        "count": db.q1("SELECT COUNT(DISTINCT mint) c FROM audits WHERE ts>=?", (ns,))["c"],
        "rejected": db.q1("SELECT COUNT(DISTINCT mint) c FROM audits WHERE ts>=? AND pass=0", (ns,))["c"],
        "current": au.current if au else None, "last": au.last if au else None, "strips": strips,
        "lastMint": last_mint["mint"] if last_mint else None,
        "lastName": _name(last_mint["mint"]) if last_mint else None, "enabled": config.get("auditor.enabled")}
    an = ag.get("analyst")
    lv = db.q1("SELECT * FROM verdicts WHERE ts>=? ORDER BY ts DESC LIMIT 1", (ns,))
    analyst = base("analyst") | {
        "count": db.q1("SELECT COUNT(*) c FROM verdicts WHERE ts>=?", (ns,))["c"], "mode": config.get("analyst.mode"),
        "current": an.current if an else None, "minScore": config.get("analyst.min_score"),
        "last": ({"mint": lv["mint"], "name": _name(lv["mint"]), "score": lv["score"], "passed": bool(lv["pass"]),
                  "reason": lv["reason"]} if lv else None)}
    ex = ag.get("executor")
    trades = db.q1("SELECT COUNT(*) c FROM positions WHERE opened_at>=?", (ns,))["c"]
    ls = db.q1("SELECT * FROM signals WHERE ts>=? AND status!='skipped' ORDER BY ts DESC LIMIT 1", (ns,))
    executor = base("executor") | {
        "count": trades, "stackPct": config.get("executor.stack_pct"), "current": ex.current if ex else None,
        "last": ({"mint": ls["mint"], "name": _name(ls["mint"]), "size": ls["size_usd"], "pct": ls["stack_pct"],
                  "status": ls["status"], "ts": ls["ts"]} if ls else None)}
    lx = db.q1("SELECT * FROM positions WHERE exit_reason IS NOT NULL ORDER BY COALESCE(closed_at, exiting_at) DESC LIMIT 1")
    risk = base("risk") | {
        "open": len(db.open_positions()), "stopPct": config.get("risk.stop_pct"), "trailPct": config.get("risk.trail_pct"),
        "locked": bool(db.open_positions()),
        "last": ({"mint": lx["mint"], "name": _name(lx["mint"]), "reason": lx["exit_reason"], "pnl": lx["pnl_usd"],
                  "label": {"trail": "Trailed out", "stop": "Stopped", "timeout": "Timed out", "pulled": "Pulled",
                            "manual": "Sold"}.get(lx["exit_reason"], lx["exit_reason"])} if lx else None)}
    return [scanner, auditor, analyst, executor, risk]


def state():
    mode = config.get("desk.mode")
    n = db.current_night()
    bal = db.balance_now(mode)
    start = n["start_balance"] or bal
    return {"mode": mode, "balance": bal, "stack": db.current_stack(mode), "free": db.free_stack(mode),
            "startBalance": start, "todayPct": round(100 * (bal / start - 1), 2) if start else 0,
            "multiplier": round(bal / start, 2) if start else 1, "nightStart": n["started_at"], "serverTime": time.time(),
            "unread": db.q1("SELECT COUNT(*) c FROM pushes WHERE read=0")["c"], "agents": agent_cards(),
            "appName": config.APP_NAME, "tonight": {k: v for k, v in trades(mode, "night")["summary"].items() if k != "curve"},
            "openPositions": [{"id": p["id"], "mint": p["mint"], "name": _name(p["mint"])} for p in db.open_positions()]}


@app.get("/api/state", dependencies=A)
def api_state():
    return state()


RANGES = {"1H": 3600, "4H": 4 * 3600, "1D": 86400, "1W": 7 * 86400, "ALL": None}


def chart(rng="LIVE"):
    now = time.time()
    if rng == "LIVE":
        since = db.night_start()
    elif rng in RANGES and RANGES[rng]:
        since = now - RANGES[rng]
    else:
        since = 0
    pts = db.q("SELECT ts, value FROM balance WHERE ts>=? ORDER BY ts", (since,))
    if len(pts) > 600:
        step = len(pts) // 600 + 1
        pts = pts[::step]
    cur = db.balance_now()
    points = [[p["ts"], p["value"]] for p in pts] + [[now, cur]]
    start = db.current_night()["start_balance"] if rng == "LIVE" else (points[0][1] if points else cur)
    marks = []
    for a in db.q("SELECT * FROM activity WHERE ts>=? AND kind IN ('bought','sold','stopped') ORDER BY ts", (since,)):
        if a["kind"] == "bought":
            txt, kind = a["title"], "buy"
        elif a["kind"] == "sold":
            txt, kind = a["value"].split(" · ")[0], "win" if not a["value"].startswith("-") else "loss"
        else:
            stop = a["subtitle"].replace("Risk · ", "").replace(" stop", "")
            txt, kind = f"{stop} · {a['value']}", "loss"
        marks.append({"ts": a["ts"], "kind": kind, "text": txt, "mint": a["mint"]})
    return {"range": rng, "points": points, "start": start, "marks": marks, "empty": not db.q1(
        "SELECT 1 FROM positions WHERE opened_at>=? LIMIT 1", (since,))}


@app.get("/api/chart", dependencies=A)
def api_chart(range: str = "LIVE"):  # noqa: A002
    return chart(range.upper())


def activity_rows(before=None, limit=30):
    if before:
        rows = db.q("SELECT * FROM activity WHERE id<? ORDER BY id DESC LIMIT ?", (before, limit))
    else:
        rows = db.q("SELECT * FROM activity ORDER BY id DESC LIMIT ?", (limit,))
    for r in rows:
        r["link"] = links.coin_url(r["mint"], "solana") if r["mint"] else None
    return rows


@app.get("/api/activity", dependencies=A)
def api_activity(before: int | None = None):
    rows = activity_rows(before)
    return {"rows": rows, "next": rows[-1]["id"] if len(rows) == 30 else None}


def candles(mint, since):
    rows = db.q("SELECT ts, price, volume_m5 FROM prices WHERE mint=? AND ts>=? ORDER BY ts", (mint, since))
    out, prev_v = [], None
    for r in rows:
        if not r["price"]:
            continue
        b = int(r["ts"] // 60) * 60
        dv = max(0.0, (r["volume_m5"] or 0) - prev_v) if prev_v is not None and r["volume_m5"] is not None else 0.0
        prev_v = r["volume_m5"] if r["volume_m5"] is not None else prev_v
        if out and out[-1]["t"] == b:
            c = out[-1]
            c["h"], c["l"], c["c"] = max(c["h"], r["price"]), min(c["l"], r["price"]), r["price"]
            c["v"] += dv
        else:
            o = out[-1]["c"] if out else r["price"]
            out.append({"t": b, "o": o, "h": max(o, r["price"]), "l": min(o, r["price"]), "c": r["price"], "v": dv})
    return out[-240:]


def coin(mint):
    c = db.coin(mint)
    if not c:
        raise HTTPException(404, "unknown coin")
    lp = db.last_price(mint)
    view = sources.last_view(mint)
    p = db.q1("SELECT * FROM positions WHERE mint=? ORDER BY opened_at DESC LIMIT 1", (mint,))
    pos = None
    if p:
        line = risk_mod.exit_line(p)
        pos = {"id": p["id"], "entry": p["entry_price"], "size": p["size_usd"], "peak": p["peak_price"], "stop": p["stop_price"],
               "stopPct": db.position_stop_pct(p), "trailActive": bool(p["trail_active"]),
               "trailLine": p["peak_price"] * (1 - config.get("risk.trail_pct") / 100) if p["trail_active"] else
               p["entry_price"] * (1 + config.get("risk.trail_start_pct") / 100),
               "exitLine": line, "openedAt": p["opened_at"], "closedAt": p["closed_at"], "exitingAt": p["exiting_at"],
               "exitPrice": p["exit_price"], "exitReason": p["exit_reason"], "pnl": p["pnl_usd"], "mode": p["mode"],
               "timeoutAt": p["opened_at"] + config.get("risk.timeout_h") * 3600, "trailPct": config.get("risk.trail_pct")}
    sig = db.q1("SELECT * FROM signals WHERE mint=? AND status='sent' ORDER BY ts DESC LIMIT 1", (mint,))
    passed = db.q1("SELECT COUNT(*) c FROM audits WHERE mint=? AND pass=1", (mint,))["c"]
    since = (p["opened_at"] - 3600) if p else time.time() - 4 * 3600
    return {"mint": mint, "name": c["name"], "symbol": c["symbol"], "chain": "Solana", "migratedAt": c["migrated_at"],
            "price": lp["price"] if lp else None, "priceTs": lp["ts"] if lp else None, "candles": candles(mint, since),
            "stats": {"mcap": view.get("mcap"), "liquidity": view.get("liquidity"), "volume24h": view.get("v24"),
                      "holders": c["holders"]}, "image": view.get("image"),
            "audit": {"passed": passed, "of": 8}, "position": pos,
            "signal": {"id": sig["id"], "size": sig["size_usd"]} if sig else None,
            "coinUrl": links.coin_url(mint, "solana"), "mode": config.get("desk.mode")}


@app.get("/api/coin/{mint}", dependencies=A)
def api_coin(mint: str):
    return coin(mint)


# ------------------------------------------------------------------ trades & PnL
# "profitable" before AUTO is even built: every line must be true on PAPER, all time
AUTO_CRITERIA = {"nights": 3, "trades": 20, "profit_factor": 1.2, "max_dd_pct": 25.0}


def trade_stats(closed, start_stack):
    pnls = [p["pnl_usd"] or 0 for p in closed]
    wins = [x for x in pnls if x > 0]
    losses = [x for x in pnls if x <= 0]
    realized = round(sum(pnls), 2)
    eq, peak, dd, dd_pct, curve = start_stack, start_stack, 0.0, 0.0, []
    for p in closed:
        eq += p["pnl_usd"] or 0
        peak = max(peak, eq)
        if peak - eq > dd:
            dd = peak - eq
            dd_pct = 100 * dd / peak if peak else 0
        curve.append([p["closed_at"], round(eq - start_stack, 2)])
    holds = [(p["closed_at"] - p["opened_at"]) / 60 for p in closed]
    return {"realized": realized, "pct": round(100 * realized / start_stack, 2) if start_stack else None,
            "fees": round(sum(p["fees_usd"] or 0 for p in closed), 2), "trades": len(closed), "wins": len(wins),
            "losses": len(losses), "winRate": round(100 * len(wins) / len(closed), 1) if closed else None,
            "avgWin": round(sum(wins) / len(wins), 2) if wins else None,
            "avgLoss": round(sum(losses) / len(losses), 2) if losses else None,
            "profitFactor": round(sum(wins) / abs(sum(losses)), 2) if losses and sum(losses) < 0 else (None if not wins else "∞"),
            "best": max(pnls) if pnls else None, "worst": min(pnls) if pnls else None,
            "avgHoldMin": round(sum(holds) / len(holds), 1) if holds else None,
            "maxDrawdown": round(dd, 2), "maxDrawdownPct": round(dd_pct, 2), "startStack": round(start_stack, 2),
            "curve": curve}


def _trade_row(p):
    lp = db.last_price(p["mint"]) if not p["closed_at"] else None
    c = db.coin(p["mint"]) or {}
    row = {"id": p["id"], "mint": p["mint"], "name": c.get("name") or util.short(p["mint"]), "symbol": c.get("symbol"),
           "openedAt": p["opened_at"], "closedAt": p["closed_at"], "entry": p["entry_price"], "size": p["size_usd"],
           "stopPct": db.position_stop_pct(p), "mode": p["mode"], "link": links.coin_url(p["mint"], "solana")}
    if p["closed_at"]:
        row |= {"exit": p["exit_price"], "pnl": p["pnl_usd"], "pct": round(100 * (p["pnl_usd"] or 0) / p["size_usd"], 2),
                "fees": p["fees_usd"], "reason": p["exit_reason"], "holdMin": round((p["closed_at"] - p["opened_at"]) / 60, 1)}
    else:
        price = lp["price"] if lp else None
        unreal = round(p["size_usd"] * (price / p["entry_price"] - 1), 2) if price else None
        row |= {"price": price, "unrealized": unreal, "pct": round(100 * unreal / p["size_usd"], 2) if unreal is not None else None,
                "exitLine": risk_mod.exit_line(p), "exiting": bool(p["exiting_at"])}
    return row


def trades(mode=None, rng="night", before=None, limit=50):
    mode = (mode or config.get("desk.mode")).upper()
    since = db.night_start() if rng == "night" else (time.time() - 7 * 86400 if rng == "7d" else 0)
    closed = db.q("SELECT * FROM positions WHERE mode=? AND closed_at IS NOT NULL AND opened_at>=? ORDER BY closed_at", (mode, since))
    opn = db.q("SELECT * FROM positions WHERE mode=? AND closed_at IS NULL ORDER BY opened_at", (mode,))
    start = db.current_stack(mode) - sum(p["pnl_usd"] or 0 for p in closed)
    st = trade_stats(closed, start)
    open_rows = [_trade_row(p) for p in opn]
    st["unrealized"] = round(sum(r["unrealized"] or 0 for r in open_rows), 2)
    by = {}
    for p in closed:
        b = by.setdefault(p["exit_reason"] or "?", {"reason": p["exit_reason"], "n": 0, "pnl": 0.0})
        b["n"] += 1
        b["pnl"] = round(b["pnl"] + (p["pnl_usd"] or 0), 2)
    newest = list(reversed(closed))
    if before:
        newest = [p for p in newest if p["id"] < before]
    page = newest[:limit]
    # AUTO readiness: PAPER, all time
    allp = db.q("SELECT * FROM positions WHERE mode='PAPER' AND closed_at IS NOT NULL ORDER BY closed_at")
    a = trade_stats(allp, config.get("desk.paper_start_stack"))
    nights = db.full_paper_nights(config.get("desk.min_paper_night_h"))
    pf = a["profitFactor"]
    pf_ok = pf == "∞" or (isinstance(pf, (int, float)) and pf >= AUTO_CRITERIA["profit_factor"])
    ready = [
        {"label": f"{AUTO_CRITERIA['nights']} full PAPER nights", "ok": nights >= AUTO_CRITERIA["nights"], "value": str(nights)},
        {"label": f"{AUTO_CRITERIA['trades']}+ closed PAPER trades", "ok": a["trades"] >= AUTO_CRITERIA["trades"], "value": str(a["trades"])},
        {"label": "Net PnL after fees > $0", "ok": a["realized"] > 0, "value": util.usd(a["realized"], True)},
        {"label": f"Profit factor ≥ {AUTO_CRITERIA['profit_factor']}", "ok": pf_ok, "value": "n/a" if pf is None else str(pf)},
        {"label": f"Max drawdown ≤ {AUTO_CRITERIA['max_dd_pct']:g}%", "ok": a["trades"] > 0 and a["maxDrawdownPct"] <= AUTO_CRITERIA["max_dd_pct"],
         "value": f"{a['maxDrawdownPct']:g}%"},
    ]
    return {"mode": mode, "range": rng, "summary": st, "byReason": sorted(by.values(), key=lambda b: b["pnl"]),
            "open": open_rows, "closed": [_trade_row(p) for p in page],
            "next": page[-1]["id"] if len(newest) > limit else None,
            "readiness": {"items": ready, "ready": all(i["ok"] for i in ready), "burnerUsd": 42}}


# ------------------------------------------------------------------ live (separate real-time app at /live/)
STARTED = time.time()


def _history(limit=120):
    """Tonight's decisions from the db in the SSE event shape (the tape before this process started)."""
    ns = db.night_start()
    nm = lambda m, n: n or util.short(m)  # noqa: E731
    ev = []
    for r in db.q("SELECT s.*, c.name FROM scans s LEFT JOIN coins c USING(mint) WHERE s.ts>=? ORDER BY s.ts DESC LIMIT ?", (ns, limit)):
        ev.append({"kind": "scan", "ts": r["ts"], "data": {"mint": r["mint"], "name": nm(r["mint"], r["name"]), "verdict": r["verdict"],
                                                           "reason": r["reason"], "liquidityUsd": r["liquidity_usd"]}})
    for r in db.q("SELECT a.mint, MAX(a.ts) ts, MIN(a.pass) ok, COUNT(*) n, c.name, (SELECT value_text FROM audits b WHERE b.mint=a.mint "
                  "AND b.pass=0 ORDER BY b.ts DESC LIMIT 1) reason FROM audits a LEFT JOIN coins c USING(mint) WHERE a.ts>=? "
                  "GROUP BY a.mint ORDER BY ts DESC LIMIT ?", (ns, limit)):
        ev.append({"kind": "audit", "ts": r["ts"], "data": {"mint": r["mint"], "name": nm(r["mint"], r["name"]),
                                                            "passed": bool(r["ok"]) and r["n"] >= 8, "reason": r["reason"]}})
    for r in db.q("SELECT v.*, c.name FROM verdicts v LEFT JOIN coins c USING(mint) WHERE v.ts>=? ORDER BY v.ts DESC LIMIT ?", (ns, limit)):
        ev.append({"kind": "verdict", "ts": r["ts"], "data": {"mint": r["mint"], "name": nm(r["mint"], r["name"]), "score": r["score"],
                                                              "passed": bool(r["pass"]), "failed": [r["reason"]] if r["reason"] else [],
                                                              "model": r["model"]}})
    for r in db.q("SELECT g.*, c.name FROM signals g LEFT JOIN coins c USING(mint) WHERE g.ts>=? ORDER BY g.ts DESC LIMIT ?", (ns, limit)):
        ev.append({"kind": "signal", "ts": r["ts"], "data": {"mint": r["mint"], "name": nm(r["mint"], r["name"]), "sizeUsd": r["size_usd"],
                                                             "stackPct": r["stack_pct"], "status": r["status"], "reason": r["reason"],
                                                             "mode": r["mode"]}})
    for r in db.q("SELECT p.*, c.name FROM positions p LEFT JOIN coins c USING(mint) WHERE p.opened_at>=?", (ns,)):
        ev.append({"kind": "fill", "ts": r["opened_at"], "data": {"mint": r["mint"], "name": nm(r["mint"], r["name"]),
                                                                  "sizeUsd": r["size_usd"], "price": r["entry_price"], "mode": r["mode"]}})
        if r["exit_reason"]:
            ev.append({"kind": "exit", "ts": r["exiting_at"] or r["closed_at"], "data": {
                "mint": r["mint"], "name": nm(r["mint"], r["name"]), "reason": r["exit_reason"], "pnlUsd": r["pnl_usd"],
                "pct": round(100 * (r["pnl_usd"] or 0) / r["size_usd"], 2), "status": "closed" if r["closed_at"] else "exiting"}})
    return ev


def live():
    ns = db.night_start()
    st = state()
    tr = trades(st["mode"], "night", limit=12)
    c = lambda sql, *a: db.q1(sql, (ns, *a))["c"]  # noqa: E731
    funnel = {"heard": c("SELECT COUNT(*) c FROM coins WHERE seen_at>=?"),
              "waiting": len(desk.agents["scanner"].room) if desk else 0,
              "scannerPass": c("SELECT COUNT(*) c FROM scans WHERE ts>=? AND verdict='pass'"),
              "scannerKill": c("SELECT COUNT(*) c FROM scans WHERE ts>=? AND verdict='kill'"),
              "audited": c("SELECT COUNT(DISTINCT mint) c FROM audits WHERE ts>=?"),
              "cleared": c("SELECT COUNT(*) c FROM (SELECT mint FROM audits WHERE ts>=? GROUP BY mint HAVING MIN(pass)=1 AND COUNT(*)>=8)"),
              "scored": c("SELECT COUNT(*) c FROM verdicts WHERE ts>=?"),
              "analystPass": c("SELECT COUNT(*) c FROM verdicts WHERE ts>=? AND pass=1"),
              "pushed": c("SELECT COUNT(*) c FROM signals WHERE ts>=? AND status!='skipped'"),
              "filled": c("SELECT COUNT(*) c FROM positions WHERE opened_at>=?"),
              "exited": c("SELECT COUNT(*) c FROM positions WHERE opened_at>=? AND closed_at IS NOT NULL")}
    events = [e for e in _history() if e["ts"] < STARTED] + [e for e in bus.recent if e["kind"] not in ("balance", "price")]
    events.sort(key=lambda e: e["ts"], reverse=True)
    return {"state": st, "trades": tr, "funnel": funnel, "events": events[:250], "serverTime": time.time(),
            "risk": {"stopPct": config.get("risk.stop_pct"), "trailPct": config.get("risk.trail_pct"),
                     "timeoutH": config.get("risk.timeout_h")}}


@app.get("/api/live", dependencies=A)
def api_live():
    return live()


@app.get("/api/trades", dependencies=A)
def api_trades(mode: str | None = None, range: str = "night", before: int | None = None):  # noqa: A002
    if range not in ("night", "7d", "all"):
        raise HTTPException(400, "range is night, 7d or all")
    return trades(mode, range, before)


def audit_view(mint):
    c = db.coin(mint)
    if not c:
        raise HTTPException(404, "unknown coin")
    last = db.q1("SELECT MAX(ts) t FROM audits WHERE mint=? AND layer=1", (mint,))
    rows = db.q("SELECT * FROM audits WHERE mint=? AND ts>=? ORDER BY layer", (mint, last["t"] or 0)) if last["t"] else []
    layers = []
    for n, ln in enumerate(auditor_mod.LAYERS, 1):
        r = next((x for x in rows if x["layer"] == n), None)
        layers.append({"n": n, "name": ln, "pass": (bool(r["pass"]) if r else None), "value": r["value_text"] if r else "not checked",
                       "source": r["source"] if r else None})
    red = next((L for L in layers if L["pass"] is False), None)
    sig = db.q1("SELECT * FROM signals WHERE mint=? ORDER BY ts DESC LIMIT 1", (mint,))
    cur = desk.agents["auditor"].current if desk else None
    return {"mint": mint, "name": c["name"] or util.short(mint), "symbol": c["symbol"], "layers": layers,
            "running": bool(cur and cur.get("mint") == mint), "audited": bool(rows),
            "verdict": None if not rows else ("rejected" if red else ("cleared" if len(rows) == 8 else "running")),
            "reason": red["value"] if red else None, "sentSize": sig["size_usd"] if sig else None,
            "coinUrl": links.coin_url(mint, "solana"), "enabled": config.get("auditor.enabled")}


@app.get("/api/audit/{mint}", dependencies=A)
def api_audit(mint: str):
    return audit_view(mint)


@app.get("/api/audits/latest", dependencies=A)
def api_audit_latest():
    r = db.q1("SELECT mint FROM audits ORDER BY ts DESC LIMIT 1")
    return audit_view(r["mint"]) if r else {"audited": False, "layers": []}


def decisions(name):
    if name == "scanner":
        rows = db.q("SELECT s.ts, s.mint, s.verdict, s.reason FROM scans s ORDER BY s.ts DESC LIMIT 20")
    elif name == "auditor":
        rows = db.q("SELECT MAX(ts) ts, mint, MIN(pass) p, COUNT(*) n, (SELECT value_text FROM audits b WHERE b.mint=a.mint AND b.pass=0 "
                    "ORDER BY ts DESC LIMIT 1) reason FROM audits a GROUP BY mint ORDER BY ts DESC LIMIT 20")
        rows = [{"ts": r["ts"], "mint": r["mint"], "verdict": "pass" if r["p"] else "red", "reason": r["reason"] or f"{r['n']}/8"} for r in rows]
    elif name == "analyst":
        rows = db.q("SELECT ts, mint, pass, score, reason, model FROM verdicts ORDER BY ts DESC LIMIT 20")
        rows = [{"ts": r["ts"], "mint": r["mint"], "verdict": "pass" if r["pass"] else "reject",
                 "reason": f"score {r['score']}" + (f" · {r['reason']}" if r["reason"] else "")} for r in rows]
    elif name == "executor":
        rows = db.q("SELECT ts, mint, status verdict, COALESCE(reason, '$' || printf('%.2f', size_usd)) reason FROM signals ORDER BY ts DESC LIMIT 20")
    elif name == "risk":
        rows = db.q("SELECT COALESCE(closed_at, exiting_at) ts, mint, exit_reason verdict, printf('%+.2f', pnl_usd) reason FROM positions "
                    "WHERE exit_reason IS NOT NULL ORDER BY ts DESC LIMIT 20")
    else:
        raise HTTPException(404, "unknown agent")
    for r in rows:
        r["name"] = _name(r["mint"])
        r["link"] = links.coin_url(r["mint"], "solana")
    return rows


@app.get("/api/agents/{name}/decisions", dependencies=A)
def api_decisions(name: str):
    return decisions(name)


@app.post("/api/agents/{name}/pause", dependencies=A)
def api_pause(name: str):
    msg, _ = commands._pause(name, True)
    if "can't" in msg or "Unknown" in msg:
        raise HTTPException(409, msg)
    return {"ok": True, "message": msg}


@app.post("/api/agents/{name}/resume", dependencies=A)
def api_resume(name: str):
    msg, _ = commands._pause(name, False)
    return {"ok": True, "message": msg}


@app.post("/api/agents/{name}/restart", dependencies=A)
async def api_restart(name: str):
    if not desk or name not in desk.agents:
        raise HTTPException(404, "unknown agent")
    desk.restart(name)
    return {"ok": True}


def account():
    handle = config.get("desk.fomo_handle")
    lvl, msg = config.ticket_check()
    ok, why = config.live_allowed()
    return {"mode": config.get("desk.mode"), "stack": db.current_stack(), "liveStack": config.get("desk.stack_usd"),
            "paperStart": config.get("desk.paper_start_stack"), "fomoHandle": handle or None,
            "profileUrl": links.profile_url(handle) if handle else None, "signupUrl": links.SIGNUP_URL,
            "telegram": {"configured": bool(config.secret("TG_TOKEN")), "owner": bool(db.kv_get("owner_chat_id"))},
            "webpush": {"subscriptions": db.q1("SELECT COUNT(*) c FROM push_subs")["c"], "vapidPublicKey": config.secret("VAPID_PUBLIC_KEY")},
            "notifier": config.get("desk.notifier"), "analystMode": config.get("analyst.mode"),
            "jevKey": bool(config.secret("TYPESAFE_API_KEY")), "ticket": {"level": lvl, "message": msg, "minStack": round(config.min_stack(), 2)},
            "liveAllowed": ok, "liveWhy": why, "hosting": "A"}


@app.get("/api/account", dependencies=A)
def api_account():
    return account()


def settings_view():
    groups = {g: [] for g in config.GROUPS}
    for k, (d, lo, hi, kind, label, al) in config.SPEC.items():
        g = k.split(".")[0]
        groups[g].append({"key": k, "label": label, "value": config.get(k), "default": d, "min": lo, "max": hi, "kind": kind,
                          "sub": "rules" if k.startswith("analyst.rules.") else None})
    return {"groups": groups}


@app.get("/api/settings", dependencies=A)
def api_settings():
    return settings_view()


@app.post("/api/settings", dependencies=A)
async def api_settings_post(request: Request):
    body = await request.json()
    out = []
    for k, v in body.items():
        if k == "desk.mode":
            raise HTTPException(400, "use /api/mode")
        try:
            old, new = config.set(k, v, "app")
        except config.SettingError as e:
            raise HTTPException(400, str(e))
        out.append({"key": k, "old": old, "new": new})
    lvl, msg = config.ticket_check()
    return {"ok": True, "changed": out, "ticket": {"level": lvl, "message": msg}}


@app.post("/api/mode", dependencies=A)
async def api_mode(request: Request):
    body = await request.json()
    mode = str(body.get("mode", "")).upper()
    if mode == "LIVE" and body.get("confirm") != "LIVE":
        raise HTTPException(400, 'LIVE needs {"confirm":"LIVE"}')
    try:
        old, new = config.set("desk.mode", mode, "app")
    except config.SettingError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "mode": new}


@app.post("/api/push", dependencies=A)
async def api_push(request: Request):
    try:
        webpush.save_sub(await request.json())
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@app.post("/api/push/test", dependencies=A)
async def api_push_test():
    r = db.q1("SELECT mint FROM coins ORDER BY seen_at DESC LIMIT 1")
    mint = r["mint"] if r else None
    btn = [{"label": "Open on FOMO", "url": links.coin_url(mint, "solana") if mint else links.SIGNUP_URL}]
    via = await notifier.notify("Test push from the desk", btn, mint=mint, kind="test")
    return {"ok": bool(via), "via": via}


@app.get("/api/pushes", dependencies=A)
def api_pushes():
    return db.q("SELECT * FROM pushes ORDER BY id DESC LIMIT 50")


@app.post("/api/pushes/read", dependencies=A)
def api_pushes_read():
    db.x("UPDATE pushes SET read=1 WHERE read=0")
    return {"ok": True}


@app.post("/api/command", dependencies=A)
async def api_command(request: Request):
    body = await request.json()
    replies = await commands.handle(str(body.get("text", "")), who="app")
    return {"replies": [{"text": t, "buttons": b} for t, b in replies]}


@app.post("/api/signals/{sid}/{action}", dependencies=A)
def api_signal(sid: int, action: str):
    ex = desk.agents["executor"]
    if action == "bought":
        return {"result": ex.tap_bought(sid)}
    if action == "skip":
        return {"result": ex.tap_skip(sid)}
    raise HTTPException(404)


@app.post("/api/positions/{pid}/sold", dependencies=A)
def api_sold(pid: int):
    return {"result": desk.agents["risk"].tap_sold(pid)}


@app.post("/api/jev-key", dependencies=A)
async def api_jev_key(request: Request):
    body = await request.json()
    key = (body.get("key") or "").strip()
    config.save_secret("TYPESAFE_API_KEY", key or None)
    config.set("analyst.mode", "jev" if key else "rules", "app")
    return {"ok": True, "analystMode": config.get("analyst.mode")}


@app.get("/api/search", dependencies=A)
def api_search(q: str):
    t = f"%{q.strip()}%"
    rows = db.q("SELECT mint, name, symbol, seen_at FROM coins WHERE mint=? OR name LIKE ? OR symbol LIKE ? ORDER BY seen_at DESC LIMIT 20",
                (q.strip(), t, t))
    for r in rows:
        r["link"] = links.coin_url(r["mint"], "solana")
    return rows


@app.get("/api/heartbeats", dependencies=A)
def api_heartbeats():
    return {"now": time.time(), "beats": db.q("SELECT * FROM heartbeats"),
            "reconnectsLastHour": db.q1("SELECT COUNT(*) c FROM reconnects WHERE ts>=? AND reason!='silent'", (time.time() - 3600,))["c"]}


@app.get("/api/stream", dependencies=A)
async def api_stream(request: Request):
    q = bus.subscribe()

    async def gen():
        try:
            yield "retry: 3000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                    yield bus.sse(ev)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            bus.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# morning Page: secret path, no app token in the link
@app.get("/p/{key}/{fname}")
def page(key: str, fname: str):
    if not hmac.compare_digest(key.encode(), config.secret("PAGE_KEY").encode()) or "/" in fname or ".." in fname:
        raise HTTPException(404)
    f = config.DESK_HOME / "pages" / fname
    if not f.exists():
        raise HTTPException(404)
    return HTMLResponse(f.read_text())


@app.get("/p/{rest:path}")
def page_404(rest: str):
    raise HTTPException(404)


@app.get("/config.js")
def config_js():
    # public, no secrets: the VAPID *public* key and the app name
    js = f"window.DESK_PUBLIC={{vapidPublicKey:{config.secret('VAPID_PUBLIC_KEY')!r},appName:{config.APP_NAME!r}}};"
    return HTMLResponse(js, media_type="application/javascript")


@app.middleware("http")
async def no_store(request: Request, call_next):
    resp = await call_next(request)
    if request.url.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp


app.mount("/", StaticFiles(directory=WEB, html=True), name="web")


# --------------------------------------------- api.py price writer: every [60]s
async def price_writer():
    while True:
        await asyncio.sleep(60)
        try:
            ns = db.night_start()
            mints = {r["mint"] for r in db.q("SELECT mint FROM signals WHERE ts>=? UNION SELECT mint FROM audits WHERE ts>=? "
                                              "UNION SELECT mint FROM positions WHERE opened_at>=?", (ns, ns, ns))}
            covered = set(desk.agents["scanner"].room) if desk else set()
            covered |= {p["mint"] for p in db.open_positions()}
            todo = sorted(mints - covered)
            if todo:
                pairs = await sources.dex_tokens(todo)
                for m, p in pairs.items():
                    v = sources.pair_view(p)
                    if v["price"] is not None:
                        db.add_price(m, v["price"], v["v5"])
        except Exception:  # noqa: BLE001
            pass
        db.beat("api")
