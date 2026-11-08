"""Learn from mistakes. After every closed trade: a post-mortem, then lessons that only ever make the desk safer.

desk.learner = auto     apply tightening lessons at once (logged as who="learner", pushed, undo any time)
               suggest  push them as suggestions, apply with "apply lesson N"
               off      post-mortems only
A lesson never loosens a setting. An undone lesson comes back only with 2 new losses that show the same thing.
"""
import asyncio
import json
import time

from . import bus, config, db, notifier, util

# feature at entry -> setting that guards it. 'min' = an entry needs value >= threshold, 'max' = value <= threshold
PATTERNS = [
    ("liquidity", "scanner.min_liquidity_usd", "min", "liquidity at entry"),
    ("score", "analyst.min_score", "min", "Analyst score"),
    ("chase", "analyst.max_chase", "max", "chase"),
    ("top10", "scanner.max_top10_pct", "max", "top 10 holders %"),
    ("h1", "scanner.max_h1_change_pct", "max", "1h change %"),
    ("drop_m5", "executor.max_drop_m5_pct", "max", "5m drop % at entry"),
]
MIN_LOSERS = 2          # a pattern needs at least 2 losing trades behind it
MIN_LOSS_SHARE = 0.5    # ... and must explain at least half of the $ lost
RUG_PCT = -50           # one trade losing more than half its ticket = a rug: cap the ticket
RUG_TICKET_CAP = 10     # % of stack
GAP_PP = 2              # exit more than 2 points past the stop line = the price was too slow
FAST_POLL_S = 5
_lock = asyncio.Lock()
log = util.logger("learner")


def _features(p):
    """What the desk knew at entry. Saved at push time; older trades are rebuilt from scans + verdicts."""
    s = db.q1("SELECT features FROM signals WHERE id=?", (p["signal_id"],)) if p.get("signal_id") else None
    if s and s["features"]:
        return json.loads(s["features"])
    sc = db.q1("SELECT * FROM scans WHERE mint=? AND verdict='pass' ORDER BY ts DESC LIMIT 1", (p["mint"],)) or {}
    v = db.q1("SELECT * FROM verdicts WHERE mint=? ORDER BY ts DESC LIMIT 1", (p["mint"],)) or {}
    return {"liquidity": sc.get("liquidity_usd"), "top10": sc.get("top10_pct"), "h1": sc.get("h1_change_pct"),
            "score": v.get("score"), "chase": v.get("chase"), "drop_m5": None}


def post_mortem(p):
    pct = 100 * (p["pnl_usd"] or 0) / p["size_usd"]
    tags = []
    if pct <= RUG_PCT:
        tags.append("rug")
    stop_pct = 100 * (1 - p["stop_price"] / p["entry_price"])
    exit_pct = 100 * (p["exit_price"] / p["entry_price"] - 1)
    if p["exit_reason"] == "stop" and -exit_pct - stop_pct > GAP_PP:
        tags.append("gap")
    if p["closed_at"] - p["opened_at"] < 120 and pct < 0:
        tags.append("fast")
    if pct < 0 and (p["fees_usd"] or 0) > 0.25 * abs(p["pnl_usd"]):
        tags.append("fee-heavy")
    f = _features(p)
    db.x("INSERT OR REPLACE INTO postmortems VALUES (?,?,?,?,?,?,?,?)",
         (p["id"], p["closed_at"], p["mint"], p["pnl_usd"], round(pct, 2), p["exit_reason"], json.dumps(tags), json.dumps(f)))
    return {"pct": pct, "tags": tags, "features": f, "pnl": p["pnl_usd"], "mint": p["mint"], "closed_at": p["closed_at"],
            "exit_pct": exit_pct, "stop_pct": stop_pct}


def _name(mint):
    return (db.coin(mint) or {}).get("name") or util.short(mint)


def _blocked(key, trades):
    """An undone lesson for this key comes back only with 2+ new losses closed after the undo."""
    u = db.q1("SELECT * FROM lessons WHERE key=? AND status='undone' ORDER BY undone_at DESC LIMIT 1", (key,))
    if not u:
        return False
    return sum(1 for t in trades if t["pnl"] < 0 and t["closed_at"] > u["undone_at"]) < 2


MAX_STEP = 3.0          # one pattern lesson tightens a gate by at most 3x: two losses are weak evidence


def _tighter(key, new, pattern=False):
    """(is it a real tightening, value). Never clamps: a threshold outside the setting's range means no real pattern."""
    lo, hi = config.SPEC[key][1], config.SPEC[key][2]
    if (lo is not None and new < lo) or (hi is not None and new > hi):
        return False, new
    if pattern and new in (lo, hi):          # a pattern that needs the extreme of the range is no pattern
        return False, new
    cur = config.get(key)
    direction = "min" if key in ("scanner.min_liquidity_usd", "analyst.min_score") else "max"
    if pattern and cur:
        step = new / cur if direction == "min" else (cur / new if new else float("inf"))
        if step > MAX_STEP:
            return False, new
    return (new > cur if direction == "min" else new < cur), new


def find_lessons(trades):
    lessons = []
    losers = [t for t in trades if t["pnl"] < 0]
    winners = [t for t in trades if t["pnl"] > 0]
    total_loss = -sum(t["pnl"] for t in losers) or 1
    # 1) tail risk, one event is enough
    rugs = [t for t in losers if "rug" in t["tags"]]
    if rugs and config.get("executor.max_ticket_pct") > RUG_TICKET_CAP:
        r = rugs[-1]
        lessons.append(("rug", "executor.max_ticket_pct", RUG_TICKET_CAP,
                        f"{_name(r['mint'])} lost {r['pct']:.0f}% of its ticket straight through the stop. No stop survives a rug, "
                        f"only size does: tickets capped at {RUG_TICKET_CAP}% of the stack", [r["mint"]]))
    gaps = [t for t in losers if "gap" in t["tags"]]
    if gaps and config.get("risk.poll_s") > FAST_POLL_S:
        lessons.append(("gap", "risk.poll_s", FAST_POLL_S,
                        f"{len(gaps)} stop(s) filled past the line ({', '.join(_name(t['mint']) for t in gaps[-3:])}). "
                        f"Risk now reads the pool on-chain every {FAST_POLL_S}s", [t["mint"] for t in gaps]))
    # 2) patterns: what losers share and winners don't
    for feat, key, direction, label in PATTERNS:
        lv = [(t[ "features"].get(feat), t) for t in losers if t["features"].get(feat) is not None]
        wv = [t["features"].get(feat) for t in winners if t["features"].get(feat) is not None]
        if len(lv) < MIN_LOSERS:
            continue
        if direction == "min":
            edge = min(wv) if wv else None
            hit = [(v, t) for v, t in lv if edge is None or v < edge]
            if len(hit) < MIN_LOSERS:
                continue
            worst = max(v for v, _ in hit)
            new = (worst + edge) / 2 if edge is not None else worst * 1.1
        else:
            edge = max(wv) if wv else None
            hit = [(v, t) for v, t in lv if edge is None or v > edge]
            if len(hit) < MIN_LOSERS:
                continue
            worst = min(v for v, _ in hit)
            new = (worst + edge) / 2 if edge is not None else worst * 0.9
        share = -sum(t["pnl"] for _, t in hit) / total_loss
        if share < MIN_LOSS_SHARE:
            continue
        kind = config.SPEC[key][3]
        new = round(new) if kind == "int" else (round(new, 2) if abs(new) < 10 else round(new))
        names = ", ".join(_name(t["mint"]) for _, t in hit[-4:])
        side = "under" if direction == "min" else "over"
        lessons.append(("pattern", key, new, f"{len(hit)} losses ({names}) had {label} {side} {util.gnum(new)}, "
                                              f"{share:.0%} of the $ lost; no winner did", [t["mint"] for _, t in hit]))
    return lessons


async def run(push=True):
    """Post-mortem every closed trade, then learn. Returns the lessons recorded this run."""
    mode = config.get("desk.learner")
    async with _lock:
        closed = db.q("SELECT * FROM positions WHERE closed_at IS NOT NULL AND pnl_usd IS NOT NULL ORDER BY closed_at")
        trades = [post_mortem(p) for p in closed]
        if mode == "off" or not trades:
            return []
        out = []
        for kind, key, new, text, mints in find_lessons(trades):
            ok, new = _tighter(key, new, pattern=(kind == "pattern"))
            if not ok or _blocked(key, trades):
                continue
            if db.q1("SELECT 1 FROM lessons WHERE key=? AND new=? AND status IN ('applied','suggested')", (key, json.dumps(new))):
                continue
            old = config.get(key)
            status = "applied" if mode == "auto" else "suggested"
            if status == "applied":
                config.set(key, new, "learner")
            lid = db.insert("lessons", dict(ts=time.time(), kind=kind, key=key, old=json.dumps(old), new=json.dumps(new), text=text,
                                            evidence=json.dumps(mints), status=status))
            label = key.split(".")[-1].replace("_", " ")
            msg = (f"{'Learned' if status == 'applied' else 'Suggestion'} #{lid}: {text}. "
                   f"{label} {util.gnum(old)} -> {util.gnum(new)}" + ("" if status == "applied" else f". Reply 'apply lesson {lid}'"))
            log.info(msg)
            bus.emit("lesson", {"id": lid, "kind": kind, "key": key, "old": old, "new": new, "text": text, "status": status})
            if push:
                await notifier.notify(msg, [], kind="lesson")
            out.append({"id": lid, "key": key, "old": old, "new": new, "status": status, "text": text})
        return out


def undo(lid):
    lz = db.q1("SELECT * FROM lessons WHERE id=?", (lid,))
    if not lz:
        return f"no lesson #{lid}"
    if lz["status"] != "applied":
        return f"lesson #{lid} is {lz['status']}"
    old = json.loads(lz["old"])
    if lz["key"] == "risk.stop_pct":
        return "stop lessons can't be undone automatically"  # (none exist: the learner never touches open stops)
    config.set(lz["key"], old, "learner-undo")
    db.x("UPDATE lessons SET status='undone', undone_at=? WHERE id=?", (time.time(), lid))
    return f"lesson #{lid} undone: {lz['key'].split('.')[-1]} back to {util.gnum(old)}"


def apply(lid):
    lz = db.q1("SELECT * FROM lessons WHERE id=?", (lid,))
    if not lz or lz["status"] != "suggested":
        return f"lesson #{lid} is not a pending suggestion"
    ok, new = _tighter(lz["key"], json.loads(lz["new"]), pattern=(lz["kind"] == "pattern"))
    if not ok:
        db.x("UPDATE lessons SET status='stale' WHERE id=?", (lid,))
        return f"lesson #{lid} no longer tightens anything"
    config.set(lz["key"], new, "learner")
    db.x("UPDATE lessons SET status='applied' WHERE id=?", (lid,))
    return f"lesson #{lid} applied"


def lessons_view(limit=50):
    rows = db.q("SELECT * FROM lessons ORDER BY id DESC LIMIT ?", (limit,))
    for r in rows:
        r["old"], r["new"], r["evidence"] = json.loads(r["old"]), json.loads(r["new"]), json.loads(r["evidence"] or "[]")
    pms = db.q("SELECT p.*, c.name FROM postmortems p LEFT JOIN coins c USING(mint) ORDER BY p.ts DESC LIMIT 30")
    for r in pms:
        r["tags"], r["features"] = json.loads(r["tags"]), json.loads(r["features"])
    return {"mode": config.get("desk.learner"), "lessons": rows, "postmortems": pms}
