"""Routine 'desk-health', hourly:  python -m desk.health
If the process or any agent heartbeat is older than 2 min, restart it and say "Restarted {agent}, down {n} min".
More than 10 websocket reconnects in the last hour: say so."""
import asyncio
import os
import subprocess
import time

import httpx

from . import config, db, notifier, telegram

AGENTS = ["scanner", "auditor", "analyst", "executor", "risk"]
RESTART_CMD = os.environ.get("DESK_RESTART_CMD", "systemctl --user restart grokdesk")


async def check():
    db.connect()
    if config.secret("TG_TOKEN"):
        notifier.register_telegram(telegram._push)
    now = time.time()
    beats = {r["agent"]: r["ts"] for r in db.q("SELECT * FROM heartbeats")}
    msgs = []
    main_age = now - beats.get("main", 0)
    if main_age > 120:
        subprocess.run(RESTART_CMD, shell=True, check=False)
        msgs.append(f"Restarted desk process, down {int(main_age // 60)} min")
    else:
        port = os.environ.get("PORT", "8787")
        for a in AGENTS:
            age = now - beats.get(a, 0)
            if age > 120:
                try:
                    httpx.post(f"http://127.0.0.1:{port}/api/agents/{a}/restart",
                               headers={"Authorization": f"Bearer {config.secret('APP_TOKEN')}"}, timeout=10)
                except Exception:  # noqa: BLE001
                    pass
                msgs.append(f"Restarted {a.capitalize()}, down {int(age // 60)} min")
    # 'silent' reconnects (no migration for ws_silence_s) are logged but not counted: at ~20 graduations/hour
    # the 120s silence rule reconnects by itself; only real drops (errors / closes) count toward the alert.
    rc = db.q1("SELECT COUNT(*) c FROM reconnects WHERE ts>=? AND reason!='silent'", (now - 3600,))["c"]
    if rc > 10:
        msgs.append(f"PumpPortal websocket reconnected {rc} times in the last hour")
    for m in msgs:
        await notifier.notify(m, [], kind="health", paper_prefix=False)
    return msgs


if __name__ == "__main__":
    print(asyncio.run(check()) or "healthy")
