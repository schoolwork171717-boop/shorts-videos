"""Shared clients: DexScreener (1 limiter for the whole desk), RugCheck, Solana RPC."""
import asyncio
import hashlib
import json
import logging
import time
from collections import deque

import httpx

from . import config, fields

log = logging.getLogger("sources")
TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
UA = {"User-Agent": "desk/1.0"}


class RateLimited(Exception):
    pass


class SourceError(Exception):
    pass


_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(30, connect=10), headers=UA,
                                    limits=httpx.Limits(max_connections=20))
    return _client


# ---------------- DexScreener ----------------
_dex_times: deque = deque()
_dex_lock = asyncio.Lock()
dex_429_until = 0.0


async def _dex_slot():
    async with _dex_lock:
        while True:
            now = time.time()
            while _dex_times and now - _dex_times[0] > 60:
                _dex_times.popleft()
            if len(_dex_times) < config.get("scanner.max_dex_rpm"):
                _dex_times.append(now)
                return
            await asyncio.sleep(60 - (now - _dex_times[0]) + 0.05)


def best_pair(pairs, mint):
    """PumpSwap pair (dexId pumpswap) for this mint; if several, the one with the most liquidity."""
    cands = [p for p in pairs if fields.get("dexscreener", "mint", p) == mint
             and fields.get("dexscreener", "dex_id", p) == "pumpswap"]
    if not cands:
        return None
    return max(cands, key=lambda p: fields.get("dexscreener", "liquidity_usd", p) or 0)


async def dex_tokens(mints: list[str]) -> dict:
    """mint -> best PumpSwap pair (raw). Batches of 30. Raises RateLimited on 429."""
    global dex_429_until
    out = {}
    mints = list(dict.fromkeys(mints))
    for i in range(0, len(mints), 30):
        chunk = mints[i:i + 30]
        if time.time() < dex_429_until:
            raise RateLimited("dexscreener backoff")
        await _dex_slot()
        r = await client().get("https://api.dexscreener.com/tokens/v1/solana/" + ",".join(chunk))
        if r.status_code == 429:
            dex_429_until = time.time() + config.get("scanner.dex_backoff_s")
            raise RateLimited("dexscreener 429")
        if r.status_code != 200:
            raise SourceError(f"dexscreener {r.status_code}")
        pairs = r.json() or []
        for m in chunk:
            p = best_pair(pairs, m)
            if p:
                out[m] = p
                _last[m] = (time.time(), p)
    return out


_last: dict = {}


def last_view(mint) -> dict:
    """Latest DexScreener read of this mint by any writer (Scanner, Risk, api, Analyst, Executor)."""
    c = _last.get(mint)
    return pair_view(c[1]) if c else {}


def pair_view(p) -> dict:
    g = lambda f: fields.get("dexscreener", f, p)  # noqa: E731
    price = g("price_usd")
    return {
        "name": g("name"), "symbol": g("symbol"), "pool": g("pair_address"),
        "price": float(price) if price not in (None, "") else None,
        "liquidity": g("liquidity_usd"), "mcap": g("market_cap"),
        "v5": g("volume_m5"), "v1": g("volume_h1"), "v24": g("volume_h24"),
        "b5": g("buys_m5"), "s5": g("sells_m5"), "b1": g("buys_h1"), "s1": g("sells_h1"),
        "p5": g("change_m5"), "p1": g("change_h1"), "p24": g("change_h24"),
        "created_ms": g("pair_created_at_ms"), "image": g("image"),
    }


# ---------------- RugCheck ----------------
async def rugcheck(mint, what="report"):
    url = f"https://api.rugcheck.xyz/v1/tokens/{mint}/" + ("report" if what == "report" else "insiders/graph")
    r = await client().get(url)
    if r.status_code == 429:
        raise RateLimited("rugcheck 429")
    if r.status_code != 200:
        raise SourceError(f"rugcheck {what} {r.status_code}")
    return r.json()


# ---------------- Solana RPC ----------------
async def rpc(method, params, timeout=30):
    r = await client().post(config.get("desk.rpc_url"), json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                            timeout=timeout)
    try:
        j = r.json()
    except json.JSONDecodeError:
        raise SourceError(f"rpc {method} http {r.status_code}")
    if r.status_code == 429 or (isinstance(j.get("error"), dict) and j["error"].get("code") in (429, -32005)):
        raise RateLimited(f"rpc {method} 429")
    if "error" in j:
        raise SourceError(f"rpc {method}: {j['error']}")
    return j


async def account_info(mint):
    return await rpc("getAccountInfo", [mint, {"encoding": "jsonParsed"}])


async def token_supply(mint):
    j = await rpc("getTokenSupply", [mint])
    return int(j["result"]["value"]["amount"]), int(j["result"]["value"]["decimals"])


_gpa_cache: dict = {}


async def token_accounts(mint, max_age=60):
    """Every token account of this mint on Token AND Token-2022 (getProgramAccounts, filter by mint, jsonParsed)."""
    c = _gpa_cache.get(mint)
    if c and time.time() - c[0] < max_age:
        return c[1]
    out = []
    for prog, filters in ((TOKEN_PROGRAM, [{"dataSize": 165}, {"memcmp": {"offset": 0, "bytes": mint}}]),
                          (TOKEN_2022, [{"memcmp": {"offset": 0, "bytes": mint}}])):
        j = await rpc("getProgramAccounts", [prog, {"encoding": "jsonParsed", "filters": filters}], timeout=90)
        res = j.get("result")
        if not isinstance(res, list):
            raise SourceError("getProgramAccounts: no list")
        out.extend(res)
    _gpa_cache[mint] = (time.time(), out)
    if len(_gpa_cache) > 200:
        for k in sorted(_gpa_cache, key=lambda k: _gpa_cache[k][0])[:100]:
            _gpa_cache.pop(k, None)
    return out


async def owner_balance(owner, mint):
    j = await rpc("getTokenAccountsByOwner", [owner, {"mint": mint}, {"encoding": "jsonParsed"}])
    return sum(int(fields.get("rpc_token_account", "amount_raw", a) or 0) for a in j["result"]["value"])


async def top10_pct(mint, pool, supply_raw):
    """Top 10 holders % of supply; accounts owned by the pool or the bonding curve are dropped before summing.
    Read from the full getProgramAccounts list (owner + amount per token account). getTokenLargestAccounts is not
    used: the public RPC answers it with 429 every time, so no raw sample of it exists to map keys from."""
    exclude = {pool, bonding_curve(mint)} - {None}
    accs = await token_accounts(mint)
    per = {}
    for a in accs:
        owner = fields.get("rpc_token_account", "owner", a)
        amt = int(fields.get("rpc_token_account", "amount_raw", a) or 0)
        if owner in exclude or amt <= 0:
            continue
        per[owner] = per.get(owner, 0) + amt      # per wallet, not per token account
    top = sorted(per.values(), reverse=True)[:10]
    if not supply_raw:
        return None, "gpa"
    return round(100 * sum(top) / supply_raw, 2), "gpa"


async def pool_natives(vaults: list[tuple[str, str]]) -> dict:
    """(base_vault, quote_vault) -> quote per base, read straight from the pool's two vaults (no 30s cache)."""
    addrs = [a for pair in vaults for a in pair]
    out = {}
    for i in range(0, len(addrs), 100):
        chunk = addrs[i:i + 100]
        j = await rpc("getMultipleAccounts", [chunk, {"encoding": "jsonParsed"}])
        for a, info in zip(chunk, j["result"]["value"]):
            out[a] = fields.get("rpc_vault", "ui_amount", info) if info else None
    res = {}
    for b, q in vaults:
        if out.get(b) and out.get(q) is not None:
            res[(b, q)] = out[q] / out[b]
    return res


# ---------------- base58 + PDA (bonding curve) ----------------
_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58decode(s: str) -> bytes:
    n = 0
    for ch in s:
        n = n * 58 + _B58.index(ch)
    full = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    pad = len(s) - len(s.lstrip("1"))
    return b"\x00" * pad + full


def b58encode(b: bytes) -> str:
    n = int.from_bytes(b, "big")
    out = ""
    while n:
        n, r = divmod(n, 58)
        out = _B58[r] + out
    pad = len(b) - len(b.lstrip(b"\x00"))
    return "1" * pad + out


_P = 2 ** 255 - 19
_D = (-121665 * pow(121666, _P - 2, _P)) % _P


def _on_curve(b: bytes) -> bool:
    y = int.from_bytes(b, "little") & ((1 << 255) - 1)
    if y >= _P:
        return False
    u = (y * y - 1) % _P
    v = (_D * y * y + 1) % _P
    x2 = u * pow(v, _P - 2, _P) % _P
    return x2 == 0 or pow(x2, (_P - 1) // 2, _P) == 1


def find_pda(seeds: list[bytes], program: str):
    pid = b58decode(program)
    for bump in range(255, -1, -1):
        h = hashlib.sha256(b"".join(seeds) + bytes([bump]) + pid + b"ProgramDerivedAddress").digest()
        if not _on_curve(h):
            return b58encode(h), bump
    raise ValueError("no PDA")


def bonding_curve(mint):
    try:
        return find_pda([b"bonding-curve", b58decode(mint)], PUMP_PROGRAM)[0]
    except Exception:
        return None
