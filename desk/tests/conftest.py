import asyncio
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


@pytest.fixture()
def desk_env(tmp_path, monkeypatch):
    """Fresh DESK_HOME + db for each test."""
    monkeypatch.setenv("DESK_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("DESK_DB", str(tmp_path / "home" / "desk.db"))
    monkeypatch.setenv("DESK_LOG_DIR", str(tmp_path / "logs"))
    from desk import config, db, bus
    monkeypatch.setattr(config, "DESK_HOME", tmp_path / "home")
    monkeypatch.setattr(config, "SECRET_FILE", tmp_path / "home" / "secrets.json")
    monkeypatch.setattr(config, "LOG_DIR", tmp_path / "logs")
    for k in ("TG_TOKEN", "TYPESAFE_API_KEY", "APP_TOKEN", "PUBLIC_URL"):
        monkeypatch.delenv(k, raising=False)
    db._conn = None
    db.connect(str(tmp_path / "home" / "desk.db"))
    config.secrets()
    bus.reset()
    yield tmp_path
    db._conn.close()
    db._conn = None


def run(coro):
    return asyncio.run(coro)
