"""STEP 2 proofs:  python -m desk.proof [--mint MINT] [--save]
Jev call (if a key is set), 1 test push through the notifier, RPC getSlot, DexScreener, RugCheck,
LAYER 8 PROOF (getProgramAccounts on Token + Token-2022 through settings.rpc_url), and the field mapping table.
--save rewrites the raw samples in logs/raw/."""
import argparse
import asyncio
import json
import time

from . import config, db, fields, links, notifier, sources
from .agents.analyst import NoAnswer, ask_jev
from .util import logger

RAW = config.DESK_DIR / "logs" / "raw"


async def main(mint=None, save=False):
    db.connect()
    config.secrets()
    ok = True
    print(f"rpc_url = {config.get('desk.rpc_url')}")
    # Jev
    key = config.secret("TYPESAFE_API_KEY")
    if key:
        try:
            a, model, tok, usage = await ask_jev("Coin TEST on Solana, graduated 12 min ago. Liquidity $50,000.", key, logger("proof"))
            print(f"Jev        ok  model={model} answers={a} usage={usage}")
        except NoAnswer as e:
            print(f"Jev        FAIL {e}"); ok = False
    else:
        print("Jev        skipped (no key: analyst_mode = rules)")
    # notifier
    via = await notifier.notify("Test push from the desk (STEP 2 proof)", [{"label": "Join FOMO", "url": links.SIGNUP_URL}],
                                kind="test", paper_prefix=False)
    print(f"Push       {'ok via ' + ', '.join(via) if via else 'no channel connected yet (no TG_TOKEN, no web push device, no webhook)'}")
    # RPC getSlot
    j = await sources.rpc("getSlot", [])
    print(f"RPC        ok  getSlot={j['result']}")
    # DexScreener
    if not mint:
        r = await sources.client().get("https://api.dexscreener.com/latest/dex/search?q=pumpswap")
        pairs = [p for p in r.json().get("pairs", []) if p.get("dexId") == "pumpswap" and p["baseToken"]["address"].endswith("pump")]
        mint = max(pairs, key=lambda p: (p.get("liquidity") or {}).get("usd") or 0)["baseToken"]["address"]
    d = await sources.dex_tokens([mint])
    v = sources.pair_view(d[mint]) if mint in d else {}
    print(f"DexScreener ok {v.get('name')} ({mint}) price={v.get('price')} liq={v.get('liquidity')}")
    rep = await sources.rugcheck(mint, "report")
    graph = await sources.rugcheck(mint, "graph")
    print(f"RugCheck   ok  creator={fields.get('rugcheck_report', 'creator', rep)} markets={len(fields.get('rugcheck_report', 'markets', rep) or [])} graph networks={len(graph) if isinstance(graph, list) else 'n/a'}")
    acct = await sources.account_info(mint)
    print(f"getAccountInfo ok owner={fields.get('rpc_account_info', 'owner_program', acct)}")
    # LAYER 8 PROOF
    t = time.time()
    try:
        accs = await sources.token_accounts(mint, max_age=0)
        holders = sum(1 for a in accs if int(fields.get("rpc_token_account", "amount_raw", a) or 0) > 0)
        print(f"LAYER 8    PASS getProgramAccounts Token+Token-2022: {len(accs)} accounts, {holders} holders, {time.time()-t:.1f}s")
    except Exception as e:  # noqa: BLE001
        ok = False
        print(f"LAYER 8    FAIL ({e}). Auditor layer 8 will turn every coin red (no data: delegations) and Holders will read "
              f"n/a until rpc_url points to an endpoint that allows getProgramAccounts. No PAPER night until it passes.")
    if save:
        RAW.mkdir(parents=True, exist_ok=True)
        for name, obj in (("dexscreener_pair", [d[mint]] if mint in d else []), ("rugcheck_report", rep),
                          ("rugcheck_insiders_graph", graph), ("rpc_getAccountInfo", acct)):
            (RAW / f"{name}.json").write_text(json.dumps(obj, indent=1))
    print("\nfield the agents need -> raw key (fields.py)")
    for src, f, p in fields.table():
        print(f"  {src:18} {f:24} {p or 'null (not in the raw JSON)'}")
    return ok


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mint")
    ap.add_argument("--save", action="store_true")
    a = ap.parse_args()
    raise SystemExit(0 if asyncio.run(main(a.mint, a.save)) else 1)
