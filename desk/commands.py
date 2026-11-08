"""Talking to the desk. Same handler for Telegram, the app's command box and the assistant.
Every coin mentioned in a reply carries its coin_url (as a button and in the text)."""
import re
import time

from . import config, db, links, util

AGENTS = ["scanner", "auditor", "analyst", "executor", "risk"]
HELP = ("Commands:\n"
        "buy X · sell X · why X · pause Scanner · resume Scanner\n"
        "set stop to -8% · stack 1240 · status · paper · live\n"
        "invite · report\n"
        "X = name, symbol or mint")

desk = None  # set by main: object with .agents dict


def _btn(label, mint):
    return {"label": label, "url": links.coin_url(mint, "solana")}


def _coin_line(c):
    return f"{c.get('name') or c.get('symbol') or util.short(c['mint'])} ({c.get('symbol') or '?'}) · {links.coin_url(c['mint'], 'solana')}"


def _resolve(x):
    """Returns (coin or None, reply or None)."""
    rows = db.find_coins(x)
    if len(rows) == 1:
        return rows[0], None
    if len(rows) > 1:
        return None, ("Which one?\n" + "\n".join(_coin_line(c) for c in rows[:8]),
                      [_btn(f"{c.get('symbol') or util.short(c['mint'])} on FOMO", c["mint"]) for c in rows[:8]])
    if re.fullmatch(r"[1-9A-HJ-NP-Za-km-z]{32,44}", x.strip()):
        return {"mint": x.strip(), "name": None, "symbol": None, "_unknown": True}, None
    return None, (f"I don't know {x} yet. Send me its mint address.", [])


async def handle(text: str, who="telegram"):
    """Returns a list of (text, buttons)."""
    t = (text or "").strip()
    if t.startswith("/"):
        t = t[1:]
    t = re.sub(r"@\w+bot\b", "", t, flags=re.I).strip()
    low = t.lower()
    if low in ("start", "help", ""):
        return [(HELP, [])]
    m = re.match(r"^(buy|sell|why)\s+(.+)$", t, re.I)
    if m:
        return await {"buy": _buy, "sell": _sell, "why": _why}[m.group(1).lower()](m.group(2).strip())
    m = re.match(r"^why was (.+?) refused\??$", t, re.I)
    if m:
        return await _why(m.group(1))
    m = re.match(r"^(pause|resume)\s+(\w+)$", t, re.I)
    if m:
        return [_pause(m.group(2).lower(), m.group(1).lower() == "pause")]
    m = re.match(r"^set\s+(.+?)\s+(?:to|=)\s+(.+)$", t, re.I)
    if m:
        return [_set(m.group(1), m.group(2), who)]
    m = re.match(r"^stack\s+\$?([\d,\.]+)$", t, re.I)
    if m:
        return [_set("desk.stack_usd", m.group(1), who, label="stack")]
    if low == "status":
        return [_status()]
    if low == "paper":
        return [_set("desk.mode", "PAPER", who, label="mode")]
    if t == "LIVE":
        return [_set("desk.mode", "LIVE", who, label="mode")]
    if low == "live":
        return [("Type LIVE (capitals) to switch to LIVE. Money only moves when you tap Buy on FOMO and buy inside FOMO.", [])]
    if low == "invite":
        return [(f"New to FOMO? {links.SIGNUP_URL}", [{"label": "Join FOMO", "url": links.SIGNUP_URL}])]
    if low == "report":
        from . import report
        n = db.q1("SELECT * FROM nights WHERE page IS NOT NULL ORDER BY id DESC LIMIT 1")
        return [(f"Last morning Page: {report.page_url(n['page'])}" if n else "No morning Page yet.", [])]
    return [("I didn't get that.\n" + HELP, [])]


async def _buy(x):
    c, reply = _resolve(x)
    if reply:
        return [reply]
    mint = c["mint"]
    name = c.get("name") or util.short(mint)
    sig = db.q1("SELECT * FROM signals WHERE mint=? AND ts>=? AND status!='skipped' ORDER BY ts DESC LIMIT 1",
                (mint, db.night_start()))
    if sig:
        return [(f"Buy {name} · ${sig['size_usd']:,.2f} · {sig['stack_pct']:g}% of stack (pushed {util.hhmm(sig['ts'])})\n"
                 f"{links.coin_url(mint, 'solana')}",
                 [_btn("Buy on FOMO", mint)] + ([{"label": "Bought", "callback": f"bought:{sig['id']}"}] if sig["status"] == "sent" else []))]
    if desk is None:
        return [("Desk not running.", [])]
    from . import sources
    pairs = await sources.dex_tokens([mint])
    v = sources.pair_view(pairs[mint]) if mint in pairs else {}
    if not db.coin(mint):
        mig = (v.get("created_ms") or time.time() * 1000) / 1000
        db.upsert_coin(dict(mint=mint, name=v.get("name"), symbol=v.get("symbol"), pool=v.get("pool"), migrated_at=mig,
                            seen_at=time.time()))
    scan = {"mint": mint, "name": v.get("name") or name, "pool": v.get("pool"), "liquidityUsd": v.get("liquidity")}
    out = await desk.agents["auditor"].audit(scan, forward=False)
    if out is None:
        rows = db.q("SELECT layer, name, value_text, pass FROM audits WHERE mint=? AND ts>=? ORDER BY layer",
                    (mint, db.night_start()))
        lines = [f"{r['layer']} {r['name']}: {r['value_text']} {'✓' if r['pass'] else '✗'}" for r in rows]
        return [(f"{name} was already rejected tonight:\n" + "\n".join(lines) + "\nnot sized, not on the desk\n"
                 + links.coin_url(mint, "solana"), [_btn("Buy on FOMO", mint)])]
    lines = [f"{L['n']} {L['name']}: {L['value']} {'✓' if L['pass'] else ('✗' if L['pass'] is False else '·')}"
             for L in out["layers"]]
    head = f"{v.get('name') or name} · Auditor {'8/8' if out['passed'] else 'red: ' + str(out['reason'])}"
    return [(head + "\n" + "\n".join(lines) + "\nnot sized, not on the desk\n" + links.coin_url(mint, "solana"),
             [_btn("Buy on FOMO", mint)])]


async def _sell(x):
    c, reply = _resolve(x)
    if reply:
        return [reply]
    p = db.q1("SELECT * FROM positions WHERE mint=? AND closed_at IS NULL", (c["mint"],))
    name = c.get("name") or util.short(c["mint"])
    if not p:
        return [(f"No open {name} position.\n{links.coin_url(c['mint'], 'solana')}", [_btn("Open on FOMO", c["mint"])])]
    lp = db.last_price(c["mint"])
    chg = f" · {100 * (lp['price'] / p['entry_price'] - 1):+.2f}% since entry" if lp else ""
    return [(f"Sell {name} · ${p['size_usd']:,.2f} in{chg}\n{links.coin_url(c['mint'], 'solana')}",
             [_btn("Sell on FOMO", c["mint"]), {"label": "Sold", "callback": f"sold:{p['id']}"}])]


async def _why(x):
    c, reply = _resolve(x)
    if reply:
        return [reply]
    mint = c["mint"]
    name = c.get("name") or util.short(mint)
    url = links.coin_url(mint, "solana")
    s = db.q1("SELECT * FROM scans WHERE mint=? ORDER BY ts DESC LIMIT 1", (mint,))
    a = db.q1("SELECT * FROM audits WHERE mint=? AND pass=0 ORDER BY ts DESC LIMIT 1", (mint,))
    v = db.q1("SELECT * FROM verdicts WHERE mint=? ORDER BY ts DESC LIMIT 1", (mint,))
    sig = db.q1("SELECT * FROM signals WHERE mint=? ORDER BY ts DESC LIMIT 1", (mint,))
    if a:
        msg = f"{name}: Auditor, layer {a['layer']} {a['name']}, {a['value_text']}, {util.hhmm(a['ts'])}"
    elif v and not v["pass"]:
        lab = "Analyst (rules)" if v["model"] == "rules" else "Analyst"
        msg = f"{name}: {lab}, rule {v['reason']}, score {v['score']}, {util.hhmm(v['ts'])}"
    elif sig and sig["status"] == "skipped":
        msg = f"{name}: Executor, {sig['reason']}, {util.hhmm(sig['ts'])}"
    elif s and s["verdict"] == "kill":
        msg = f"{name}: Scanner, {s['reason']}, {util.hhmm(s['ts'])}"
    elif s:
        msg = f"{name}: not stopped. Scanner passed it at {util.hhmm(s['ts'])}."
    else:
        msg = f"{name}: never seen by the desk tonight."
    return [(msg + "\n" + url, [_btn("Open on FOMO", mint)])]


def _pause(agent, pause):
    if agent not in AGENTS:
        return (f"Unknown agent {agent}. Agents: Scanner, Auditor, Analyst, Executor, Risk", [])
    if agent == "risk" and pause and db.open_positions():
        return ("Risk can't be paused while a position is open.", [])
    db.kv_set(f"paused.{agent}", bool(pause))
    extra = " Risk keeps guarding." if agent != "risk" else ""
    return (f"{agent.capitalize()} {'paused' if pause else 'resumed'}.{extra}", [])


def _fmt(key, v):
    if key == "risk.stop_pct":
        return f"-{util.gnum(v)}%"
    if key.endswith("_pct"):
        return f"{util.gnum(v)}%"
    if key.endswith("_usd") or key.endswith("stack"):
        return f"${v:,.2f}" if isinstance(v, (int, float)) else str(v)
    return util.gnum(v) if not isinstance(v, bool) else ("on" if v else "off")


def _set(name, value, who, label=None):
    key = name if name in config.SPEC else config.resolve(name)
    if not key:
        return (f"Unknown setting {name}.", [])
    try:
        old, new = config.set(key, value, who)
    except config.SettingError as e:
        return (f"Refused: {e}", [])
    label = label or key.split(".")[-1].replace("_pct", "").replace("_", " ")
    msg = f"{label} {_fmt(key, old)} -> {_fmt(key, new)}"
    if key in ("desk.stack_usd", "executor.stack_pct", "executor.below_min", "desk.paper_start_stack", "executor.min_ticket_usd"):
        lvl, tm = config.ticket_check()
        if tm:
            msg += f"\n{'Warning: ' if lvl == 'warn' else ''}{tm}"
    if key == "risk.stop_pct":
        msg += "\nNew positions use it. Open stops only tighten, never move down."
    return (msg, [])


def _status():
    mode = config.get("desk.mode")
    bal = db.balance_now(mode)
    lines = [f"{mode} · balance {util.usd(bal)} · stack {util.usd(db.current_stack(mode))} · free {util.usd(db.free_stack(mode))}"]
    buttons = []
    for p in db.open_positions():
        c = db.coin(p["mint"]) or {}
        name = c.get("name") or util.short(p["mint"])
        lp = db.last_price(p["mint"])
        chg = f"{100 * (lp['price'] / p['entry_price'] - 1):+.2f}%" if lp else "n/a"
        lines.append(f"{name} · ${p['size_usd']:,.2f} in · {chg} · stop -{util.gnum(db.position_stop_pct(p))}% · "
                     f"{links.coin_url(p['mint'], 'solana')}")
        buttons.append(_btn(f"Sell {name} on FOMO", p["mint"]))
    if len(lines) == 1:
        lines.append("No open positions.")
    paused = [a for a in AGENTS if db.kv_get(f"paused.{a}")]
    if paused:
        lines.append("Paused: " + ", ".join(paused))
    return ("\n".join(lines), buttons)
