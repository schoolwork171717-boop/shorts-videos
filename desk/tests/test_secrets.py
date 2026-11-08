"""STEP 13 #7: secret values must not appear in web/, logs/, the repo, API responses or the Page.
APP_TOKEN lives only in the #t= fragment and localStorage. /api/state: 200 with the token, 401 without.
Checks the test desk, and also the real secrets file if DESK_SECRETS points at one (the live desk)."""
import json
import os
from pathlib import Path

from fastapi.testclient import TestClient

DESK = Path(__file__).resolve().parents[1]
REPO = DESK.parent
SKIP = {".venv", ".git", "__pycache__", ".pytest_cache"}


def scan_tree(values):
    hits = []
    for p in REPO.rglob("*"):
        if not p.is_file() or set(p.relative_to(REPO).parts) & SKIP or p.stat().st_size > 50_000_000:
            continue
        data = p.read_bytes()
        for name, v in values.items():
            if v and v.encode() in data:
                hits.append((str(p.relative_to(REPO)), name))
    return hits


def test_no_secret_anywhere(desk_env, monkeypatch):
    from desk import api, commands, config, db, report
    from desk.main import Desk
    import secrets as _s
    monkeypatch.setenv("TG_TOKEN", "123456:" + _s.token_urlsafe(26))       # random per run, never a literal here
    monkeypatch.setenv("TYPESAFE_API_KEY", "jev_" + _s.token_urlsafe(30))
    s = config.secrets()
    values = {k: s.get(k) for k in ("TYPESAFE_API_KEY", "TG_TOKEN", "VAPID_PRIVATE_KEY", "APP_TOKEN", "PAGE_KEY")}
    api.desk = commands.desk = Desk()
    c = TestClient(api.app)
    h = {"Authorization": f"Bearer {s['APP_TOKEN']}"}
    assert c.get("/api/state").status_code == 401
    assert c.get("/api/state", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert c.get("/api/state", headers=h).status_code == 200
    bodies = [c.get(p, headers=h).text for p in ["/api/state", "/api/account", "/api/settings", "/api/activity", "/api/heartbeats",
                                                   "/api/pushes", "/api/chart"]]
    bodies += [c.get("/config.js").text, c.get("/").text, c.get("/app.js").text]
    bodies.append(report.build(db.current_night()))
    for name, v in values.items():
        for b in bodies:
            assert v not in b, f"{name} leaked into a response/page"
    assert s["VAPID_PUBLIC_KEY"] in c.get("/config.js").text      # the public key may sit in web/
    logs = "".join(p.read_text(errors="ignore") for p in Path(os.environ["DESK_LOG_DIR"]).glob("*.log*"))
    for name, v in values.items():
        assert v not in logs, f"{name} in logs"
    # the Page path needs the PAGE_KEY, nothing at the bare path
    assert c.get("/p/").status_code == 404 and c.get("/p/wrong/x.html").status_code == 404
    hits = scan_tree(values)
    assert not hits, hits


def test_live_secrets_not_in_repo_or_logs():
    f = os.environ.get("DESK_SECRETS")
    if not f:
        import pytest
        pytest.skip("set DESK_SECRETS=/path/to/secrets.json to check the live desk")
    s = json.loads(Path(f).read_text())
    values = {k: s.get(k) for k in ("TYPESAFE_API_KEY", "TG_TOKEN", "VAPID_PRIVATE_KEY", "APP_TOKEN", "PAGE_KEY") if s.get(k)}
    hits = scan_tree(values)
    print(f"checked {len(values)} live secret values against the repo (web/, logs/, code, raw samples): {len(hits)} hits")
    assert not hits, hits
