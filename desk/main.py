"""Starts everything in ONE asyncio event loop: 5 agents + API + Telegram long polling. Writes heartbeats.

    python -m desk.main            (from the repo root)   env: DESK_HOME, PORT, PUBLIC_URL, TG_TOKEN, TYPESAFE_API_KEY
"""
import asyncio
import logging
import os
import time

import uvicorn

from . import api, bus, commands, config, db, notifier, telegram, util
from .agents.analyst import Analyst
from .agents.auditor import Auditor
from .agents.executor import Executor
from .agents.risk import Risk
from .agents.scanner import Scanner

log = util.logger("main")


class Desk:
    def __init__(self):
        self.agents = {"scanner": Scanner(), "auditor": Auditor(), "analyst": Analyst(), "executor": Executor(), "risk": Risk()}
        self.tasks: dict[str, asyncio.Task] = {}

    def start(self, name):
        self.tasks[name] = asyncio.create_task(self.agents[name].supervise(), name=name)

    def restart(self, name):
        t = self.tasks.get(name)
        if t:
            t.cancel()
        log.warning("restarting %s", name)
        self.start(name)


async def balance_writer():
    while True:
        try:
            db.insert("balance", dict(ts=time.time(), value=db.balance_now()))
            bus.emit("balance", {"balance": db.balance_now()})
        except Exception as e:  # noqa: BLE001
            log.warning("balance write failed: %s", e)
        await asyncio.sleep(60)


async def heartbeat():
    while True:
        db.beat("main")
        await asyncio.sleep(10)


async def night_check():
    """Ticket check at the start of every night. Don't start an empty night silently."""
    seen = None
    while True:
        n = db.current_night()
        if n["id"] != seen:
            seen = n["id"]
            lvl, msg = config.ticket_check()
            if msg:
                log.info("ticket check: %s", msg)
                await notifier.notify(("Warning: " if lvl == "warn" else "") + msg, [], kind="ticket")
        await asyncio.sleep(30)


async def _serve(server):
    """uvicorn captures SIGINT/SIGTERM and returns from serve(): then the whole desk stops (agents included)."""
    await server.serve()
    log.info("API stopped (signal), stopping the desk")
    raise SystemExit(0)


async def amain(port=None, with_api=True):
    db.connect()
    s = config.secrets()  # generates APP_TOKEN / VAPID pair / PAGE_KEY once (stored outside the repo, chmod 600)
    if s.get("TYPESAFE_API_KEY") and db.raw_setting("analyst.mode") is None:
        config.set("analyst.mode", "jev", "startup")
    if s.get("TG_TOKEN") and db.raw_setting("desk.notifier") is None:
        config.set("desk.notifier", "telegram", "startup")
    desk = Desk()
    api.desk = commands.desk = telegram.desk = desk
    db.current_night()
    for name in desk.agents:
        desk.start(name)
    jobs = [heartbeat(), balance_writer(), night_check(), api.price_writer(), telegram.run()]
    if with_api:
        port = int(port or os.environ.get("PORT", 8787))
        cfg = uvicorn.Config(api.app, host=os.environ.get("HOST", "0.0.0.0"), port=port, log_level="warning",
                             access_log=False, proxy_headers=True, forwarded_allow_ips="*")
        server = uvicorn.Server(cfg)
        jobs.append(_serve(server))
        log.info("desk up on :%s, mode %s", port, config.get("desk.mode"))
    await asyncio.gather(*jobs)


def main():
    logging.basicConfig(level=logging.WARNING)
    try:
        asyncio.run(amain())
    except (SystemExit, KeyboardInterrupt):
        pass
    finally:
        os._exit(0)   # state is in SQLite (WAL, autocommit): nothing to flush; don't wait on resolver threads


if __name__ == "__main__":
    main()
