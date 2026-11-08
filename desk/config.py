"""Settings with defaults (STEP 10), validation, change log, secrets, ticket check."""
import json
import os
import re
import secrets as _secrets
import stat
import time
from pathlib import Path

DESK_DIR = Path(__file__).resolve().parent
DESK_HOME = Path(os.environ.get("DESK_HOME", Path.home() / ".grokdesk"))
LOG_DIR = Path(os.environ.get("DESK_LOG_DIR", DESK_DIR / "logs"))
APP_NAME = "Grok Bot"

# key: (default, min, max, kind, label, aliases)
# kind: int | float | bool | str | time | enum:a|b
SPEC = {
    # scanner
    "scanner.min_liquidity_usd": (40000, 1000, 10_000_000, "float", "Min liquidity $", ["min liquidity", "liquidity"]),
    "scanner.max_top10_pct": (25, 1, 100, "float", "Max top 10 %", ["scanner top10"]),
    "scanner.max_h1_change_pct": (80, 1, 10000, "float", "Max 1h change %", ["max h1", "h1"]),
    "scanner.poll_s": (60, 15, 600, "int", "Poll every s", ["scanner poll"]),
    "scanner.min_pool_age_min": (10, 0, 240, "int", "Min pool age min", ["scanner age"]),
    "scanner.max_wait_min": (60, 5, 720, "int", "Max wait min", ["max wait", "wait"]),
    "scanner.runner_h24_pct": (300, 10, 100000, "float", "Runner 24h %", ["runner"]),
    "scanner.ws_silence_s": (120, 30, 1800, "int", "WS silence s", []),
    "scanner.max_dex_rpm": (250, 10, 290, "int", "DexScreener req/min", []),
    "scanner.dex_backoff_s": (30, 5, 600, "int", "429 backoff s", []),
    # auditor
    "auditor.enabled": (True, None, None, "bool", "Take apart before buying", ["auditor"]),
    "auditor.max_dev_pct": (5, 0, 100, "float", "Max dev %", ["dev", "max dev"]),
    "auditor.max_top10_pct": (25, 1, 100, "float", "Max top 10 %", ["top10", "top 10"]),
    "auditor.min_lp_locked_pct": (99, 0, 100, "float", "Min LP locked %", ["lp", "lp locked"]),
    "auditor.min_pool_age_min": (10, 0, 240, "int", "Min pool age min", ["pool age", "age"]),
    "auditor.max_bundled": (5, 1, 1000, "int", "Max bundled", ["bundled", "bundles"]),
    "auditor.max_delegated_accounts": (10, 1, 10000, "int", "Max delegated accounts", ["delegations", "delegated"]),
    "auditor.retries": (3, 0, 10, "int", "Retries", ["retries"]),
    "auditor.retry_gap_s": (2, 0, 60, "float", "Retry gap s", []),
    "auditor.max_liq_drop_pct": (50, 1, 100, "float", "Liquidity pulled %", []),
    # analyst
    "analyst.mode": ("rules", None, None, "enum:jev|rules", "Mode", ["analyst mode"]),
    "analyst.min_alive_6h": (0.70, 0, 1, "float", "Min alive 6h", ["alive", "alive_6h"]),
    "analyst.min_organic": (0.65, 0, 1, "float", "Min organic", ["organic"]),
    "analyst.max_chase": (0.30, 0, 1, "float", "Max chase", ["chase"]),
    "analyst.min_score": (70, 0, 100, "int", "Min score", ["score", "min score"]),
    "analyst.timeout_s": (10, 1, 120, "float", "Jev timeout s", ["timeout s"]),
    "analyst.max_state_chars": (3000, 500, 20000, "int", "Max state chars", []),
    "analyst.queue_429_s": (60, 0, 600, "int", "429 queue s", []),
    "analyst.rules.alive_volume_h1": (25000, 1, 100_000_000, "float", "Alive: volume 1h $", ["alive volume"]),
    "analyst.rules.organic_buys_h1": (150, 1, 1_000_000, "int", "Organic: buys 1h", ["organic buys"]),
    "analyst.rules.bundled_penalty": (0.5, 0, 1, "float", "Bundled penalty x", ["bundled penalty"]),
    "analyst.rules.bundled_from": (3, 1, 1000, "int", "Penalty from N bundled", []),
    "analyst.rules.flush_drop_m5_pct": (5, 0, 100, "float", "Flush: 5m drop %", ["flush"]),
    "analyst.rules.chase_h1_pct": (80, 1, 10000, "float", "Chase: 1h %", ["chase h1"]),
    # executor
    "executor.stack_pct": (8, 0.1, 100, "float", "Stack %", ["stack pct", "size"]),
    "executor.max_pool_pct": (2, 0.01, 100, "float", "Max % of pool", ["pool pct"]),
    "executor.min_ticket_usd": (47.50, 1, 100000, "float", "Min ticket $", ["min ticket"]),
    "executor.below_min": ("bump", None, None, "enum:bump|skip", "Below min", ["below min"]),
    "executor.max_ticket_pct": (100, 1, 100, "float", "Max ticket % of stack", ["max ticket"]),
    "executor.max_drop_m5_pct": (100, 1, 100, "float", "Skip if 5m drop over %", ["falling knife", "max drop"]),
    "executor.recheck_liq_drop_pct": (20, 1, 100, "float", "Re-check: liquidity drop %", []),
    "executor.recheck_price_up_pct": (15, 1, 1000, "float", "Re-check: price up %", []),
    "executor.confirm_window_min": (5, 1, 120, "float", "Confirm window min", []),
    # risk
    "risk.poll_s": (15, 5, 300, "int", "Poll every s", ["risk poll"]),
    "risk.stop_pct": (6, 0.5, 90, "float", "Stop %", ["stop", "stop loss", "sl"]),
    "risk.trail_start_pct": (20, 1, 10000, "float", "Trail starts at +%", ["trail start"]),
    "risk.trail_pct": (12, 0.5, 90, "float", "Trail %", ["trail", "trailing"]),
    "risk.timeout_h": (3, 0.1, 72, "float", "Timeout h", ["timeout"]),
    "risk.timeout_min_gain_pct": (5, 0, 1000, "float", "Timeout min gain %", ["timeout gain"]),
    "risk.confirm_window_min": (2, 0.5, 60, "float", "Sold confirm window min", []),
    "risk.no_price_polls": (4, 1, 100, "int", "No-price polls", []),
    "risk.backoff_s": (30, 5, 600, "int", "429 backoff s", []),
    # desk
    "desk.mode": ("PAPER", None, None, "enum:PAPER|LIVE", "Mode", ["mode"]),
    "desk.paper_start_stack": (200, 10, 10_000_000, "float", "Paper start stack $", ["paper stack"]),
    "desk.stack_usd": (200, 10, 10_000_000, "float", "LIVE stack $", ["stack", "live stack"]),
    "desk.report_time": ("08:00", None, None, "time", "Report time", ["report time"]),
    "desk.notifier": ("webpush", None, None, "enum:telegram|webpush|channel", "Notifier", ["notifier"]),
    "desk.channel_url": ("", None, None, "str", "Channel webhook URL", []),
    "desk.rpc_url": ("https://api.mainnet-beta.solana.com", None, None, "str", "RPC URL", ["rpc", "rpc url"]),
    "desk.push_rejects": (False, None, None, "bool", "Push rejects", ["push rejects"]),
    "desk.fees_ref_discount": (0.10, 0, 1, "float", "Fee ref discount", ["discount"]),
    "desk.fomo_handle": ("", None, None, "str", "FOMO handle", ["handle", "fomo handle"]),
    "desk.learner": ("auto", None, None, "enum:auto|suggest|off", "Learn from mistakes", ["learner", "learning"]),
    "desk.min_paper_night_h": (6, 0.1, 24, "float", "Full PAPER night h", []),
}

GROUPS = ["scanner", "auditor", "analyst", "executor", "risk", "desk"]
_cache: dict = {}
_loaded = False


class SettingError(ValueError):
    pass


def _db():
    from . import db
    return db


def load():
    global _loaded
    _cache.clear()
    for k, v, _ in _db().all_settings():
        if k in SPEC:
            try:
                _cache[k] = json.loads(v)
            except Exception:
                pass
    _loaded = True


def get(key):
    if key not in SPEC:
        raise KeyError(key)
    if not _loaded:
        try:
            load()
        except Exception:
            pass
    return _cache.get(key, SPEC[key][0])


def all_values():
    return {k: get(k) for k in SPEC}


def coerce(key, raw):
    default, lo, hi, kind, label, _ = SPEC[key]
    if kind == "bool":
        if isinstance(raw, bool):
            return raw
        s = str(raw).strip().lower()
        if s in ("1", "true", "on", "yes"):
            return True
        if s in ("0", "false", "off", "no"):
            return False
        raise SettingError(f"{key} takes on or off")
    if kind.startswith("enum:"):
        opts = kind[5:].split("|")
        for o in opts:
            if str(raw).strip().lower() == o.lower():
                return o
        raise SettingError(f"{key} takes one of {', '.join(opts)}")
    if kind == "time":
        s = str(raw).strip()
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", s):
            raise SettingError(f"{key} takes HH:MM, 00:00 to 23:59")
        return s
    if kind == "str":
        s = str(raw).strip()
        if key == "desk.rpc_url" and not s.startswith("https://"):
            raise SettingError("rpc_url must start with https://")
        if key == "desk.fomo_handle":
            s = s.lstrip("@")
            if s and not re.fullmatch(r"[A-Za-z0-9_.\-]{1,40}", s):
                raise SettingError("fomo_handle: letters, digits, _ . - only")
        return s
    s = str(raw).strip().replace("$", "").replace(",", "").replace("%", "").replace("×", "").replace("x", "")
    if key in ("risk.stop_pct",):
        s = s.lstrip("-")  # "-8%" means an 8% stop
    try:
        val = float(s)
    except ValueError:
        raise SettingError(f"{key} takes a number from {lo} to {hi}")
    if kind == "int":
        if val != int(val):
            raise SettingError(f"{key} takes a whole number from {lo} to {hi}")
        val = int(val)
    if (lo is not None and val < lo) or (hi is not None and val > hi):
        raise SettingError(f"{key} out of range: {lo} to {hi}")
    return val


def set(key, raw, who="app"):  # noqa: A001
    if key not in SPEC:
        raise SettingError(f"unknown setting {key}")
    new = coerce(key, raw)
    old = get(key)
    if key == "desk.mode" and new == "LIVE" and old != "LIVE":
        ok, why = live_allowed()
        if not ok:
            raise SettingError(why)
    _db().set_setting(key, json.dumps(new))
    _db().log_change(key, json.dumps(old), json.dumps(new), who)
    _cache[key] = new
    if key == "desk.stack_usd":
        _db().set_setting("desk.stack_set_at", json.dumps(time.time()))
    if key == "risk.stop_pct":
        _db().tighten_open_stops(float(new))
    return old, new


def resolve(name: str):
    """Resolve a key or alias ('stop', 'trail', 'risk.stop_pct', 'stop_pct') to a key."""
    n = name.strip().lower().replace("-", " ").replace("_", " ")
    for k in SPEC:
        if n == k.lower() or n == k.split(".", 1)[1].replace("_", " ") or n == k.replace("_", " "):
            return k
    for k, spec in SPEC.items():
        if n in [a.lower() for a in spec[5]]:
            return k
    for k in SPEC:
        if n == k.rsplit(".", 1)[1].replace("_", " "):
            return k
    return None


def live_allowed():
    hours = get("desk.min_paper_night_h")
    n = _db().full_paper_nights(hours)
    if n < 1:
        return False, f"LIVE stays locked until 1 full PAPER night ({hours:g}h, closed by the morning report) is in the db"
    return True, ""


def min_stack():
    return get("executor.min_ticket_usd") / (get("executor.stack_pct") / 100)


def stack_now():
    from . import db
    return db.current_stack()


def ticket_check(stack=None):
    """STEP 10 ticket check. Returns (level, message) or (None, None)."""
    stack = stack_now() if stack is None else stack
    ms = min_stack()
    if stack >= ms:
        return None, None
    mt = get("executor.min_ticket_usd")
    if get("executor.below_min") == "bump":
        p = 100 * mt / stack if stack else 0
        return "info", f"tickets bumped to ${mt:.2f} = {p:.1f}% of stack"
    return "warn", (f"every coin will be skipped, stack under ${ms:,.2f}. "
                    f"Switch below_min to bump or raise the stack")


# ---------------- secrets ----------------
SECRET_FILE = DESK_HOME / "secrets.json"
SERVER_ONLY = ("TYPESAFE_API_KEY", "TG_TOKEN", "VAPID_PRIVATE_KEY")


def _gen_vapid():
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    import base64
    k = ec.generate_private_key(ec.SECP256R1())
    priv = k.private_numbers().private_value.to_bytes(32, "big")
    pub = k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    b64 = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")  # noqa: E731
    return b64(priv), b64(pub)


def secrets() -> dict:
    DESK_HOME.mkdir(parents=True, exist_ok=True)
    data = {}
    if SECRET_FILE.exists():
        data = json.loads(SECRET_FILE.read_text())
    changed = False
    if not data.get("APP_TOKEN"):
        data["APP_TOKEN"] = _secrets.token_urlsafe(48); changed = True
    if not data.get("VAPID_PRIVATE_KEY"):
        data["VAPID_PRIVATE_KEY"], data["VAPID_PUBLIC_KEY"] = _gen_vapid(); changed = True
    if not data.get("PAGE_KEY"):
        data["PAGE_KEY"] = _secrets.token_urlsafe(24); changed = True
    if changed:
        SECRET_FILE.write_text(json.dumps(data, indent=1))
        os.chmod(SECRET_FILE, stat.S_IRUSR | stat.S_IWUSR)
    for k in ("TYPESAFE_API_KEY", "TG_TOKEN", "APP_TOKEN", "PUBLIC_URL"):
        if os.environ.get(k):
            data[k] = os.environ[k]
    return data


def secret(name):
    return secrets().get(name) or ""


def save_secret(name, value):
    data = secrets()
    if value:
        data[name] = value
    else:
        data.pop(name, None)
    SECRET_FILE.write_text(json.dumps(data, indent=1))
    os.chmod(SECRET_FILE, stat.S_IRUSR | stat.S_IWUSR)
