import asyncio
import time

from .. import db, util


class Agent:
    name = "agent"

    def __init__(self):
        self.log = util.logger(self.name)
        self.current = None        # what the card shows right now
        self.last = None           # last decision for the card
        self.started = time.time()

    @property
    def paused(self):
        return bool(db.kv_get(f"paused.{self.name}", False))

    def set_paused(self, v: bool):
        db.kv_set(f"paused.{self.name}", bool(v))

    def beat(self):
        db.beat(self.name)

    async def next(self, queue_name):
        """Wait for the next item on a bus queue, heartbeating while idle."""
        from .. import bus
        while True:
            self.beat()
            try:
                return await asyncio.wait_for(getattr(bus, queue_name).get(), timeout=20)
            except asyncio.TimeoutError:
                continue

    async def wait_unpaused(self):
        while self.paused:
            self.beat()
            await asyncio.sleep(2)

    async def run(self):
        raise NotImplementedError

    async def supervise(self):
        """Run forever; restart the loop after a crash (logged)."""
        while True:
            try:
                await self.run()
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                self.log.exception("crashed: %s, restarting in 5s", e)
                await asyncio.sleep(5)


async def retry(fn, retries=3, gap=2.0, log=None, what=""):
    """Source error or timeout: retry N times, gap apart. Returns (value, error)."""
    err = None
    for i in range(retries + 1):
        try:
            return await fn(), None
        except Exception as e:  # noqa: BLE001
            err = e
            if log:
                log.info("%s attempt %d failed: %s", what, i + 1, e)
            if i < retries:
                await asyncio.sleep(gap)
    return None, err
