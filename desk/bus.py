"""Queues between agents (scanner -> auditor -> analyst -> executor -> risk) + live event fan-out for SSE."""
import asyncio
import json
import time

auditor: asyncio.Queue = asyncio.Queue()
analyst: asyncio.Queue = asyncio.Queue()
executor: asyncio.Queue = asyncio.Queue()
risk: asyncio.Queue = asyncio.Queue()

_subs: set[asyncio.Queue] = set()
recent: list = []          # last events, so a fresh app sees the current beam / bar


def reset():
    global auditor, analyst, executor, risk
    auditor, analyst, executor, risk = asyncio.Queue(), asyncio.Queue(), asyncio.Queue(), asyncio.Queue()
    _subs.clear(); recent.clear()


def emit(kind: str, data: dict):
    ev = {"kind": kind, "ts": time.time(), "data": data}
    recent.append(ev)
    del recent[:-200]
    for q in list(_subs):
        if q.qsize() < 1000:
            q.put_nowait(ev)


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _subs.add(q)
    return q


def unsubscribe(q):
    _subs.discard(q)


def sse(ev) -> str:
    return f"event: {ev['kind']}\ndata: {json.dumps(ev['data'], default=str)}\n\n"
