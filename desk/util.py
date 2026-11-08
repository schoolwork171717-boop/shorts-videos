"""Logging (1 file per agent, rotated daily) and small formatters."""
import logging
import logging.handlers
import time
from datetime import datetime, timezone

from . import config

_set = set()


def logger(name):
    lg = logging.getLogger(f"desk.{name}")
    if name not in _set:
        config.LOG_DIR.mkdir(parents=True, exist_ok=True)
        h = logging.handlers.TimedRotatingFileHandler(config.LOG_DIR / f"{name}.log", when="midnight", backupCount=14,
                                                      encoding="utf-8")
        h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        lg.addHandler(h)
        lg.setLevel(logging.INFO)
        lg.propagate = False
        _set.add(name)
    return lg


def iso(ts=None):
    return datetime.fromtimestamp(ts or time.time(), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def hhmm(ts=None):
    return datetime.fromtimestamp(ts or time.time()).strftime("%-I:%M%p").lower()


def usd(v, signed=False):
    if v is None:
        return "n/a"
    s = f"{abs(v):,.2f}"
    if signed:
        return ("+$" if v >= 0 else "-$") + s
    return ("-$" if v < 0 else "$") + s


def kusd(v):
    if v is None:
        return "n/a"
    a = abs(v)
    if a >= 1e6:
        return f"${v/1e6:.1f}M"
    if a >= 1e3:
        return f"${v/1e3:.1f}K"
    return f"${v:,.0f}"


def pct(v, signed=True):
    if v is None:
        return "n/a"
    return (f"{v:+.2f}%" if signed else f"{v:.2f}%")


def short(addr):
    return f"{addr[:4]}...{addr[-3:]}" if addr and len(addr) > 10 else (addr or "")


def gnum(v):
    return f"{v:g}" if isinstance(v, (int, float)) else str(v)
