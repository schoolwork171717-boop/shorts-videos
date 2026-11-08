"""STEP 13 #1: every FOMO URL carries r=savipww, unknown chain -> SIGNUP_URL, no shortened/redirected FOMO URL,
FOMO URLs built only in links.py. Covers the repo, API responses, rendered pushes, the Account tab and the Page."""
import asyncio
import re
import time
from pathlib import Path

from fastapi.testclient import TestClient

DESK = Path(__file__).resolve().parents[1]
REPO = DESK.parent
FOMO_RE = re.compile(r"https?://(?:www\.)?fomo\.family[^\s\"'<>)`\\]*")
SHORT_RE = re.compile(r"https?://(?:t\.co|bit\.ly|tinyurl\.com|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at)/", re.I)
SKIP_DIRS = {".venv", "__pycache__", ".git", ".pytest_cache", "node_modules"}


def ok_url(u):
    return "r=savipww" in u or u.rstrip("/").endswith("/r/savipww")


def files():
    for p in DESK.rglob("*"):
        if p.is_file() and not (set(p.relative_to(DESK).parts) & SKIP_DIRS) and p.suffix in {".py", ".js", ".html", ".css", ".json", ".md", ".txt", ".jsonl", ".service", ".conf", ""}:
            yield p


def all_urls(obj):
    return FOMO_RE.findall(obj if isinstance(obj, str) else repr(obj))


def test_links_module():
    from desk import links
    assert links.SIGNUP_URL == "https://fomo.family/r/savipww"
    u = links.coin_url("So11111111111111111111111111111111111111112")
    assert u == "https://fomo.family/coin?address=So11111111111111111111111111111111111111112&chainId=1399811149&r=savipww&source=share_link"
    for ch, cid in links.CHAIN_ID.items():
        assert f"chainId={cid}&r=savipww" in links.coin_url("abc", ch)
    assert links.coin_url("abc", "monad") == links.SIGNUP_URL
    assert links.coin_url("abc", "ethereum") == links.SIGNUP_URL
    assert links.profile_url("@savi") == "https://fomo.family/profile/savi?source=share_link&r=savipww"


def test_repo_grep():
    bad, outside, short = [], [], []
    for p in files():
        txt = p.read_text(errors="ignore")
        for u in FOMO_RE.findall(txt):
            if not ok_url(u):
                bad.append((str(p.relative_to(REPO)), u))
            if p.suffix in {".py", ".js", ".html", ".css"} and p.name != "links.py" and "tests" not in p.parts:
                outside.append((str(p.relative_to(REPO)), u))
        if SHORT_RE.search(txt) and "tests" not in p.parts:
            short.append(str(p.relative_to(REPO)))
    print(f"checked {sum(1 for _ in files())} files")
    assert not bad, f"FOMO URLs without r=savipww: {bad}"
    assert not outside, f"FOMO URLs built outside links.py: {outside}"
    assert not short, f"shortened links found in: {short}"


def seed():
    from desk import db, links
    db.current_night()
    m = "AWaBBNoVuwQ22B8Y5nEtLne2uEfk8UaYEFws7vT7pump"
    db.upsert_coin(dict(mint=m, name="Elysion", symbol="ELYSION", pool="HjxaEDvdje644vhUmE3VpjpteWLBmWgSsgvYhf6LVw2L",
                        migrated_at=time.time() - 3600, seen_at=time.time(), holders=2824))
    db.add_price(m, 0.0054, 40000)
    db.insert("audits", {"mint": m, "ts": time.time(), "layer": 1, "name": "Mint authority", "value_text": "Revoked", "pass": 1, "source": "rpc"})
    db.insert("audits", {"mint": m, "ts": time.time(), "layer": 2, "name": "Freeze authority", "value_text": "freeze not revoked", "pass": 0, "source": "rpc"})
    db.add_activity("rejected", m, "auditor", "Rejected Elysion", "Auditor · freeze not revoked", "Skipped")
    sid = db.insert("signals", dict(mint=m, ts=time.time(), price=0.0054, size_usd=47.5, stack_pct=23.8, link=links.coin_url(m), mode="PAPER", status="bought"))
    db.insert("positions", dict(mint=m, opened_at=time.time(), entry_price=0.0054, size_usd=47.5, peak_price=0.0054,
                                stop_price=0.0054 * 0.94, mode="PAPER", signal_id=sid))
    db.add_activity("bought", m, "executor", "Bought Elysion", "Executor · 1:00am", "$47.50 · 23.8% of stack")
    return m


def test_api_responses_pushes_account_page(desk_env):
    from desk import api, commands, config, db, notifier, report, telegram, links
    from desk.main import Desk
    config.set("desk.fomo_handle", "@demo_user", "test")
    m = seed()
    desk = Desk()
    api.desk = commands.desk = desk
    c = TestClient(api.app)
    h = {"Authorization": f"Bearer {config.secret('APP_TOKEN')}"}
    urls = []
    for path in ["/api/state", "/api/account", "/api/activity", f"/api/coin/{m}", f"/api/audit/{m}", "/api/audits/latest",
                 "/api/agents/scanner/decisions", "/api/agents/auditor/decisions", "/api/agents/executor/decisions",
                 f"/api/search?q=Elys", "/api/chart"]:
        r = c.get(path, headers=h)
        assert r.status_code == 200, path
        urls += all_urls(r.text)
    for text in ["why Elysion", "sell ELYSION", "status", "invite", f"why {m}"]:
        r = c.post("/api/command", headers=h, json={"text": text})
        urls += all_urls(r.text)
    acc = c.get("/api/account", headers=h).json()
    assert acc["profileUrl"] == links.profile_url("demo_user") and acc["signupUrl"] == links.SIGNUP_URL
    # rendered pushes (Telegram keyboard + plain-text channel)
    btn = [{"label": "Buy on FOMO", "url": links.coin_url(m, "solana")}, {"label": "Bought", "callback": "bought:1"}]
    kb = telegram.keyboard(btn)
    assert kb["inline_keyboard"][0][0]["url"] == links.coin_url(m, "solana")
    urls += all_urls(repr(kb)) + all_urls(notifier.plain("PAPER · Buy Elysion", btn))
    # the Page
    page = report.build(db.current_night())
    page_urls = all_urls(page)
    assert links.SIGNUP_URL in page and "New to FOMO? " in page and links.coin_url(m) in page.replace("&amp;", "&")
    urls += [u.replace("&amp;", "&") for u in page_urls]
    print(f"{len(urls)} FOMO URLs found in API responses, pushes, Account tab and Page")
    assert urls and all(ok_url(u) for u in urls), [u for u in urls if not ok_url(u)]
    assert not any(SHORT_RE.search(u) for u in urls)
