"""Routine 'night-report': the morning Page. Run daily at settings.report_time:
    python -m desk.report --if-due      (cron every 5 min; only fires once a day at report_time)
    python -m desk.report --now
"""
import argparse
import asyncio
import html
import time
from datetime import datetime

from . import config, db, links, notifier, util

CSS = """body{background:#000;color:#fff;font:15px/1.45 -apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif;
margin:0;padding:24px 16px 48px;max-width:720px;margin:auto;font-variant-numeric:tabular-nums}
h1{font:600 30px -apple-system,'SF Pro Display',system-ui;margin:8px 0 4px}h2{font-size:20px;margin:28px 0 8px}
.sub{color:rgba(235,235,245,.6)}a{color:#0a84ff;text-decoration:none}.card{background:#1c1c1e;border-radius:14px;padding:4px 14px;margin:8px 0}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:.5px solid rgba(84,84,88,.55)}.row:last-child{border:0}
.g{color:#00d35a}.r{color:#ff453a}.o{color:#ff9f0a}.alert{background:#2c1412;color:#ff453a;border-radius:14px;padding:12px 14px;margin:12px 0}
footer{margin-top:36px;color:rgba(235,235,245,.6)}"""


def page_url(fname):
    base = (config.secret("PUBLIC_URL") or "http://localhost:8787").rstrip("/")
    return f"{base}/p/{config.secret('PAGE_KEY')}/{fname}"


def a(mint, label):
    return f'<a href="{html.escape(links.coin_url(mint, "solana"))}">{html.escape(label or util.short(mint))}</a>'


def nm(mint):
    c = db.coin(mint) or {}
    return c.get("name") or c.get("symbol") or util.short(mint)


def build(night) -> str:
    s, e = night["started_at"], night["ended_at"] or time.time()
    E = html.escape
    out = [f"<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
           f"<title>{E(config.APP_NAME)} · night of {datetime.fromtimestamp(s):%b %-d}</title><style>{CSS}</style></head><body>"]
    out.append(f"<div class=sub>{E(config.APP_NAME)} · morning Page</div><h1>Night of {datetime.fromtimestamp(s):%a %b %-d}</h1>")
    out.append(f"<div class=sub>{util.hhmm(s)} → {util.hhmm(e)} · {E(night['mode'])}</div>")
    l8 = db.kv_get(f"layer8_kills.{night['id']}", 0) or 0
    if l8:
        out.append(f"<div class=alert>Layer 8 was down: {l8} coin(s) killed with “no data: delegations”. Change rpc_url.</div>")
    pos = db.q("SELECT * FROM positions WHERE opened_at>=? AND opened_at<? ORDER BY opened_at", (s, e))
    closed = [p for p in pos if p["pnl_usd"] is not None]
    reds = sorted([p for p in closed if p["pnl_usd"] < 0], key=lambda p: p["pnl_usd"])
    greens = sorted([p for p in closed if p["pnl_usd"] >= 0], key=lambda p: -p["pnl_usd"])
    tot = sum(p["pnl_usd"] for p in closed)
    fees = sum(p["fees_usd"] or 0 for p in closed)
    out.append(f"<div class=card><div class=row><span>Net PnL</span><b class={'g' if tot >= 0 else 'r'}>{util.usd(tot, True)}</b></div>"
               f"<div class=row><span>Trades</span><span>{len(closed)} closed · {len(reds)} red · {len(greens)} green · "
               f"{len(pos) - len(closed)} open</span></div><div class=row><span>Fees paid</span><span>{util.usd(fees)}</span></div></div>")

    def trades(title, rows, cls):
        out.append(f"<h2>{title}</h2>")
        if not rows:
            out.append("<div class=sub>None</div>")
            return
        out.append("<div class=card>")
        for p in rows:
            pc = 100 * p["pnl_usd"] / p["size_usd"]
            rule = {"stop": f"stop -{util.gnum(db.position_stop_pct(p))}%", "trail": "trailing stop", "timeout": "timeout",
                    "pulled": "liquidity pulled", "manual": "manual"}.get(p["exit_reason"], p["exit_reason"])
            out.append(f"<div class=row><span>{a(p['mint'], nm(p['mint']))}<br><span class=sub>entry {p['entry_price']:.8g} → exit "
                       f"{p['exit_price']:.8g} · {E(rule)} · {util.hhmm(p['opened_at'])}</span></span>"
                       f"<b class={cls}>{util.usd(p['pnl_usd'], True)}<br>{pc:+.2f}%</b></div>")
        out.append("</div>")

    trades("Red trades", reds, "r")
    trades("Green trades", greens, "g")
    seen = db.q1("SELECT COUNT(*) c FROM coins WHERE seen_at>=? AND seen_at<?", (s, e))["c"]
    out.append(f"<h2>Coins seen</h2><div class=card><div class=row><span>Graduations heard</span><b>{seen}</b></div></div>")
    kills = db.q("SELECT reason, COUNT(*) c FROM scans WHERE ts>=? AND ts<? AND verdict='kill' GROUP BY "
                 "CASE WHEN reason LIKE 'liq %' THEN 'liquidity' WHEN reason LIKE 'top 10%' THEN 'top 10' "
                 "WHEN reason LIKE '+%in 1h' THEN '1h change' WHEN reason LIKE 'copycat%' THEN 'copycat' ELSE reason END "
                 "ORDER BY c DESC", (s, e))
    out.append("<h2>Scanner kills by reason</h2><div class=card>")
    labels = lambda r: ("liquidity under min" if r.startswith("liq ") else "top 10 too high" if r.startswith("top 10") else  # noqa: E731
                        "ran too fast in 1h" if r.endswith("in 1h") else "copycat" if r.startswith("copycat") else r)
    out += [f"<div class=row><span>{E(labels(k['reason']))}</span><b>{k['c']}</b></div>" for k in kills] or ["<div class=row>None</div>"]
    out.append("</div><h2>Auditor refusals by layer</h2><div class=card>")
    refs = db.q("SELECT * FROM audits WHERE ts>=? AND ts<? AND pass=0 ORDER BY layer, ts", (s, e))
    out += [f"<div class=row><span>L{r['layer']} {E(r['name'])} · {a(r['mint'], nm(r['mint']))}<br><span class=sub>"
            f"{E(r['value_text'])}</span></span><span class=sub>{util.hhmm(r['ts'])}</span></div>" for r in refs] or ["<div class=row>None</div>"]
    out.append("</div><h2>Analyst rejects</h2><div class=card>")
    vs = db.q("SELECT * FROM verdicts WHERE ts>=? AND ts<? AND pass=0 ORDER BY ts", (s, e))
    out += [f"<div class=row><span>{a(v['mint'], nm(v['mint']))}<br><span class=sub>{E(v['reason'] or '')} · score {v['score']}"
            f"{' · rules' if v['model'] == 'rules' else ''}</span></span><span class=sub>{util.hhmm(v['ts'])}</span></div>" for v in vs] or ["<div class=row>None</div>"]
    lz = db.q("SELECT * FROM lessons WHERE ts>=? AND ts<? ORDER BY id", (s, e))
    out.append("<h2>Lessons learned</h2><div class=card>")
    out += [f"<div class=row><span>#{l['id']} {E(l['text'])}<br><span class=sub>{E(l['key'])}: {E(l['old'])} → {E(l['new'])} · {E(l['status'])}"
            f"</span></span></div>" for l in lz] or ["<div class=row>None tonight</div>"]
    out.append("</div>")
    tok = db.q1("SELECT COALESCE(SUM(input_tokens),0) t, COUNT(*) n FROM verdicts WHERE ts>=? AND ts<? AND model!='rules'", (s, e))
    out.append(f"</div><h2>Jev</h2><div class=card><div class=row><span>Calls · input tokens</span><span>{tok['n']} · {tok['t']:,}</span></div>"
               f"<div class=row><span>Cost</span><span>{'$0 (rules mode)' if config.get('analyst.mode') == 'rules' else 'n/a: no Jev price list known to the desk'}</span></div></div>")
    out.append(f"<footer>New to FOMO? <a href='{E(links.SIGNUP_URL)}'>{E(links.SIGNUP_URL)}</a></footer></body></html>")
    return "".join(out)


async def run(now=False):
    if not now:
        hh, mm = map(int, config.get("desk.report_time").split(":"))
        t = datetime.now()
        if (t.hour, t.minute) < (hh, mm) or db.kv_get("last_report_date") == t.strftime("%Y-%m-%d"):
            return None
    night = db.current_night()
    end = time.time()
    db.x("UPDATE nights SET ended_at=? WHERE id=?", (end, night["id"]))
    night = db.q1("SELECT * FROM nights WHERE id=?", (night["id"],))
    fname = f"{datetime.fromtimestamp(night['started_at']):%Y-%m-%d}-{night['id']}.html"
    (config.DESK_HOME / "pages").mkdir(parents=True, exist_ok=True)
    (config.DESK_HOME / "pages" / fname).write_text(build(night))
    db.x("UPDATE nights SET page=? WHERE id=?", (fname, night["id"]))
    db.kv_set("last_report_date", datetime.now().strftime("%Y-%m-%d"))
    db.x("DELETE FROM skips")                     # clear db.skips after the report
    db.current_night()                            # opens the next night
    from . import telegram
    if config.secret("TG_TOKEN"):
        notifier.register_telegram(telegram._push)
    await notifier.notify(f"Morning Page is ready: {page_url(fname)}", [{"label": "Join FOMO", "url": links.SIGNUP_URL}],
                          kind="report", paper_prefix=False)
    return fname


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--now", action="store_true")
    ap.add_argument("--if-due", action="store_true")
    args = ap.parse_args()
    db.connect()
    print(asyncio.run(run(now=args.now)) or "not due")
