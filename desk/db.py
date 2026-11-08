"""SQLite (WAL) schema from STEP 4 + helpers."""
import json
import os
import sqlite3
import threading
import time

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS coins (mint TEXT PRIMARY KEY, name TEXT, symbol TEXT, pool TEXT, migrated_at REAL,
  creator TEXT, creator_balance_at_migration REAL, holders INTEGER, signature TEXT, seen_at REAL);
CREATE TABLE IF NOT EXISTS scans (id INTEGER PRIMARY KEY, mint TEXT, ts REAL, liquidity_usd REAL, top10_pct REAL,
  h1_change_pct REAL, age_min REAL, verdict TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS audits (id INTEGER PRIMARY KEY, mint TEXT, ts REAL, layer INTEGER, name TEXT,
  value_text TEXT, pass INTEGER, source TEXT);
CREATE TABLE IF NOT EXISTS verdicts (id INTEGER PRIMARY KEY, mint TEXT, ts REAL, alive_6h REAL, organic REAL,
  flush REAL, chase REAL, score INTEGER, pass INTEGER, reason TEXT, input_tokens INTEGER, model TEXT, price REAL);
CREATE TABLE IF NOT EXISTS signals (id INTEGER PRIMARY KEY, mint TEXT, ts REAL, price REAL, size_usd REAL,
  stack_pct REAL, link TEXT, mode TEXT, status TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS positions (id INTEGER PRIMARY KEY, mint TEXT, opened_at REAL, entry_price REAL,
  size_usd REAL, peak_price REAL, stop_price REAL, trail_active INTEGER DEFAULT 0, closed_at REAL,
  exit_price REAL, exit_reason TEXT, pnl_usd REAL, fees_usd REAL, mode TEXT, signal_id INTEGER, exiting_at REAL);
CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY, ts REAL, kind TEXT, mint TEXT, agent TEXT,
  title TEXT, subtitle TEXT, value TEXT);
CREATE TABLE IF NOT EXISTS prices (mint TEXT, ts REAL, price REAL, volume_m5 REAL);
CREATE INDEX IF NOT EXISTS prices_mint_ts ON prices (mint, ts);
CREATE TABLE IF NOT EXISTS balance (ts REAL, value REAL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at REAL);
CREATE TABLE IF NOT EXISTS change_log (ts REAL, key TEXT, old TEXT, new TEXT, who TEXT);
CREATE TABLE IF NOT EXISTS skips (mint TEXT PRIMARY KEY, until REAL);
CREATE TABLE IF NOT EXISTS heartbeats (agent TEXT PRIMARY KEY, ts REAL);
CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, p256dh TEXT, auth TEXT, created_at REAL);
-- desk extras (not in STEP 4): night boundaries, bell, ws reconnect counter, owner, alerts
CREATE TABLE IF NOT EXISTS nights (id INTEGER PRIMARY KEY, started_at REAL, ended_at REAL, mode TEXT,
  start_balance REAL, page TEXT);
CREATE TABLE IF NOT EXISTS pushes (id INTEGER PRIMARY KEY, ts REAL, text TEXT, url TEXT, mint TEXT, read INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS reconnects (ts REAL, agent TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY, ts REAL, kind TEXT, key TEXT, old TEXT, new TEXT, text TEXT,
  evidence TEXT, status TEXT, undone_at REAL);
CREATE TABLE IF NOT EXISTS postmortems (position_id INTEGER PRIMARY KEY, ts REAL, mint TEXT, pnl REAL, pct REAL, reason TEXT,
  tags TEXT, features TEXT);
CREATE INDEX IF NOT EXISTS activity_ts ON activity (ts);
CREATE INDEX IF NOT EXISTS scans_mint ON scans (mint);
CREATE INDEX IF NOT EXISTS audits_mint ON audits (mint);
"""

_conn = None
_lock = threading.RLock()


def path():
    return os.environ.get("DESK_DB", str(config.DESK_HOME / "desk.db"))


def connect(p=None):
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
        p = p or path()
        os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
        _conn = sqlite3.connect(p, check_same_thread=False, isolation_level=None, timeout=30)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA synchronous=NORMAL")
        _conn.executescript(SCHEMA)
        for table, col in (("signals", "features TEXT"), ("signals", "native REAL"), ("positions", "entry_native REAL"),
                           ("coins", "vault_base TEXT"), ("coins", "vault_quote TEXT")):
            try:
                _conn.execute(f"ALTER TABLE {table} ADD COLUMN {col}")
            except sqlite3.OperationalError:
                pass  # already there
    config.load()
    current_night()          # the night is open from the moment the desk has a db
    return _conn


def conn():
    if _conn is None:
        connect()
    return _conn


def q(sql, args=()):
    with _lock:
        return [dict(r) for r in conn().execute(sql, args).fetchall()]


def q1(sql, args=()):
    r = q(sql, args)
    return r[0] if r else None


def x(sql, args=()):
    with _lock:
        cur = conn().execute(sql, args)
        return cur.lastrowid


def insert(table, row: dict):
    cols = ",".join(row)
    return x(f"INSERT INTO {table} ({cols}) VALUES ({','.join('?' * len(row))})", tuple(row.values()))


# settings -----------------------------------------------------------------
def all_settings():
    with _lock:
        return [tuple(r) for r in conn().execute("SELECT key, value, updated_at FROM settings").fetchall()]


def set_setting(key, value):
    x("INSERT INTO settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
      (key, value, time.time()))


def raw_setting(key, default=None):
    r = q1("SELECT value FROM settings WHERE key=?", (key,))
    return json.loads(r["value"]) if r else default


def log_change(key, old, new, who):
    x("INSERT INTO change_log VALUES (?,?,?,?,?)", (time.time(), key, old, new, who))


def kv_get(key, default=None):
    r = q1("SELECT value FROM kv WHERE key=?", (key,))
    return json.loads(r["value"]) if r else default


def kv_set(key, value):
    x("INSERT INTO kv (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, json.dumps(value)))


# heartbeats ----------------------------------------------------------------
def beat(agent):
    x("INSERT INTO heartbeats (agent, ts) VALUES (?,?) ON CONFLICT(agent) DO UPDATE SET ts=excluded.ts", (agent, time.time()))


# coins / prices -------------------------------------------------------------
def coin(mint):
    return q1("SELECT * FROM coins WHERE mint=?", (mint,))


def upsert_coin(row: dict):
    cols = list(row)
    x(f"INSERT INTO coins ({','.join(cols)}) VALUES ({','.join('?' * len(cols))}) ON CONFLICT(mint) DO UPDATE SET "
      + ",".join(f"{c}=COALESCE(excluded.{c}, coins.{c})" for c in cols if c != "mint"), tuple(row.values()))


def add_price(mint, price, volume_m5, ts=None):
    x("INSERT INTO prices VALUES (?,?,?,?)", (mint, ts or time.time(), price, volume_m5))


def last_price(mint):
    return q1("SELECT * FROM prices WHERE mint=? ORDER BY ts DESC LIMIT 1", (mint,))


def find_coins(text):
    t = text.strip().lstrip("$")
    rows = q("SELECT * FROM coins WHERE mint=?", (t,))
    if rows:
        return rows
    return q("SELECT * FROM coins WHERE lower(symbol)=lower(?) OR lower(name)=lower(?) ORDER BY seen_at DESC", (t, t))


# activity --------------------------------------------------------------------
def add_activity(kind, mint, agent, title, subtitle, value, ts=None):
    return insert("activity", dict(ts=ts or time.time(), kind=kind, mint=mint, agent=agent, title=title,
                                   subtitle=subtitle, value=value))


# nights ------------------------------------------------------------------------
def current_night():
    n = q1("SELECT * FROM nights WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1")
    if n is None:
        nid = insert("nights", dict(started_at=time.time(), mode=config.get("desk.mode"), start_balance=current_stack()))
        n = q1("SELECT * FROM nights WHERE id=?", (nid,))
    return n


def night_start():
    return current_night()["started_at"]


def full_paper_nights(min_hours):
    r = q1("SELECT COUNT(*) c FROM nights WHERE mode='PAPER' AND ended_at IS NOT NULL AND (ended_at-started_at)>=?",
           (min_hours * 3600,))
    return r["c"]


# money ---------------------------------------------------------------------------
def current_stack(mode=None):
    """PAPER: start stack + realised PAPER PnL. LIVE: the stack set with 'stack N' + LIVE PnL since."""
    mode = mode or config.get("desk.mode")
    if mode == "PAPER":
        r = q1("SELECT COALESCE(SUM(pnl_usd),0) s FROM positions WHERE mode='PAPER' AND closed_at IS NOT NULL")
        return round(config.get("desk.paper_start_stack") + r["s"], 2)
    since = raw_setting("desk.stack_set_at", 0) or 0
    r = q1("SELECT COALESCE(SUM(pnl_usd),0) s FROM positions WHERE mode='LIVE' AND closed_at IS NOT NULL AND closed_at>=?", (since,))
    return round(config.get("desk.stack_usd") + r["s"], 2)


def open_positions(mode=None):
    if mode:
        return q("SELECT * FROM positions WHERE closed_at IS NULL AND mode=? ORDER BY opened_at", (mode,))
    return q("SELECT * FROM positions WHERE closed_at IS NULL ORDER BY opened_at")


def free_stack(mode=None):
    mode = mode or config.get("desk.mode")
    used = sum(p["size_usd"] for p in open_positions(mode))
    return round(current_stack(mode) - used, 2)


def balance_now(mode=None):
    mode = mode or config.get("desk.mode")
    bal = current_stack(mode)
    for p in open_positions(mode):
        lp = last_price(p["mint"])
        if lp and lp["price"] and p["entry_price"]:
            bal += p["size_usd"] * (lp["price"] / p["entry_price"] - 1)
    return round(bal, 2)


def tighten_open_stops(stop_pct):
    """A new stop setting applies to open positions only if it is tighter. Never moves a stop down."""
    for p in open_positions():
        new_stop = p["entry_price"] * (1 - stop_pct / 100)
        if new_stop > (p["stop_price"] or 0):
            x("UPDATE positions SET stop_price=? WHERE id=?", (new_stop, p["id"]))


def position_stop_pct(p):
    return round(100 * (1 - p["stop_price"] / p["entry_price"]), 4) if p["entry_price"] else None


def skipped(mint):
    return q1("SELECT 1 FROM skips WHERE mint=? AND until>?", (mint, time.time())) is not None
