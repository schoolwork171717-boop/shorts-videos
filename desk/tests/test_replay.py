"""STEP 13 #6: run live migrations through PAPER and show the Activity.

    python -m desk.tests.test_replay --minutes 120            run the whole desk live (no API) on a temp db, then print
    python -m desk.tests.test_replay --home DIR               print the Activity of a PAPER run that already happened
Under pytest it only runs when REPLAY_MIN is set (it needs the network and real time)."""
import argparse
import asyncio
import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def show(home):
    import sqlite3
    c = sqlite3.connect(Path(home) / "desk.db")
    c.row_factory = sqlite3.Row
    first = c.execute("SELECT MIN(seen_at) s, MAX(seen_at) e, COUNT(*) n FROM coins").fetchone()
    print(f"window: {time.strftime('%H:%M', time.localtime(first['s'] or 0))} -> {time.strftime('%H:%M')} · {first['n']} graduations heard")
    for r in c.execute("SELECT verdict, COUNT(*) n FROM scans GROUP BY verdict"):
        print(f"  scanner {r['verdict']}: {r['n']}")
    for r in c.execute("SELECT reason, COUNT(*) n FROM scans WHERE verdict='kill' GROUP BY substr(reason,1,6) ORDER BY n DESC"):
        print(f"     e.g. {r['reason']}  x{r['n']}")
    print("ACTIVITY (newest first)")
    rows = c.execute("SELECT * FROM activity ORDER BY id DESC").fetchall()
    for r in rows:
        print(f"  {time.strftime('%H:%M:%S', time.localtime(r['ts']))}  {r['title']:<28} {r['subtitle']:<42} {r['value']}")
    if not rows:
        print("  (empty: no coin reached Auditor/Analyst/Executor yet)")
    st = c.execute("SELECT value FROM balance ORDER BY ts DESC LIMIT 1").fetchone()
    print("PAPER balance:", st["value"] if st else "n/a")
    return rows


async def live(minutes, home):
    os.environ["DESK_HOME"] = home
    os.environ["DESK_DB"] = str(Path(home) / "desk.db")
    from desk import main
    try:
        await asyncio.wait_for(main.amain(with_api=False), timeout=minutes * 60)
    except asyncio.TimeoutError:
        pass


def test_replay():
    m = os.environ.get("REPLAY_MIN")
    if not m:
        import pytest
        pytest.skip("live replay: set REPLAY_MIN=120 (needs the network and 2 real hours)")
    home = tempfile.mkdtemp(prefix="replay-")
    asyncio.run(live(float(m), home))
    show(home)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float)
    ap.add_argument("--home")
    a = ap.parse_args()
    if a.minutes:
        h = a.home or tempfile.mkdtemp(prefix="replay-")
        asyncio.run(live(a.minutes, h))
        show(h)
    else:
        show(a.home)
