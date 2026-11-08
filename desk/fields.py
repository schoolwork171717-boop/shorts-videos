"""Raw key mapping (STEP 2). Agents read source JSON ONLY through this module.

Every path below was found in a raw sample saved in logs/raw/. A field with path None was not
found in the raw JSON and always reads as None. Nothing here is guessed.
"""

# field the agents need -> (source sample file, key path)
MAP = {
    "pumpportal": {  # logs/raw/pumpportal_migration.json
        "mint": ["mint"],
        "signature": ["signature"],
        "tx_type": ["txType"],          # "migrate"
        "venue": ["pool"],              # NOTE: "pump-amm" = the AMM name, NOT a pool address
        "pool": None,                   # no pool address in the message -> DexScreener pairAddress
        "creator": None,                # no creator key in the message -> RugCheck report.creator
        "name": None,                   # -> DexScreener baseToken.name
        "symbol": None,                 # -> DexScreener baseToken.symbol
    },
    "dexscreener": {  # logs/raw/dexscreener_pair.json (GET /tokens/v1/solana/{mints} -> list of pairs)
        "dex_id": ["dexId"],
        "mint": ["baseToken", "address"],
        "name": ["baseToken", "name"],
        "symbol": ["baseToken", "symbol"],
        "pair_address": ["pairAddress"],
        "price_usd": ["priceUsd"],
        "liquidity_usd": ["liquidity", "usd"],
        "market_cap": ["marketCap"],
        "volume_m5": ["volume", "m5"],
        "volume_h1": ["volume", "h1"],
        "volume_h24": ["volume", "h24"],
        "buys_m5": ["txns", "m5", "buys"],
        "sells_m5": ["txns", "m5", "sells"],
        "buys_h1": ["txns", "h1", "buys"],
        "sells_h1": ["txns", "h1", "sells"],
        "change_m5": ["priceChange", "m5"],
        "change_h1": ["priceChange", "h1"],
        "change_h24": ["priceChange", "h24"],
        "pair_created_at_ms": ["pairCreatedAt"],
        "image": ["info", "imageUrl"],
    },
    "rugcheck_report": {  # logs/raw/rugcheck_report.json
        "creator": ["creator"],
        "creator_balance": ["creatorBalance"],
        "mint_authority": ["mintAuthority"],
        "freeze_authority": ["freezeAuthority"],
        "total_holders": ["totalHolders"],
        "markets": ["markets"],
        "market_pool": ["pubkey"],                    # inside a markets[] entry
        "market_type": ["marketType"],                # "pump_fun_amm" for PumpSwap
        "market_lp_locked_pct": ["lp", "lpLockedPct"],  # LP burned or locked, percent
        "market_lp_burned": ["lp", "lpBurned"],       # present, null in the sample
        "market_quote_usd": ["lp", "quoteUSD"],
        "market_base_usd": ["lp", "baseUSD"],
        "top_holders": ["topHolders"],
        "known_accounts": ["knownAccounts"],
    },
    "rugcheck_graph": {  # logs/raw/rugcheck_insiders_graph.json (+ non-empty samples, see README)
        # response = list of networks; empty list = no insider network found
        "nodes": ["nodes"],           # per network: [{"id": wallet, "participant": bool, "holdings": raw}]
        "edges": ["links"],           # per network: [{"source": wallet, "target": wallet}]
        "node_id": ["id"],
        "node_holdings": ["holdings"],
        "edge_source": ["source"],
        "edge_target": ["target"],
    },
    "rpc_account_info": {  # logs/raw/rpc_getAccountInfo.json (jsonParsed)
        "owner_program": ["result", "value", "owner"],
        "mint_authority": ["result", "value", "data", "parsed", "info", "mintAuthority"],
        "freeze_authority": ["result", "value", "data", "parsed", "info", "freezeAuthority"],
        "supply_raw": ["result", "value", "data", "parsed", "info", "supply"],
        "decimals": ["result", "value", "data", "parsed", "info", "decimals"],
    },
    "rpc_token_account": {  # getProgramAccounts / getTokenAccountsByOwner item, jsonParsed
        "pubkey": ["pubkey"],
        "mint": ["account", "data", "parsed", "info", "mint"],
        "owner": ["account", "data", "parsed", "info", "owner"],
        "amount_raw": ["account", "data", "parsed", "info", "tokenAmount", "amount"],
        "delegate": ["account", "data", "parsed", "info", "delegate"],
        "delegated_amount_raw": ["account", "data", "parsed", "info", "delegatedAmount", "amount"],
    },
    # getTokenLargestAccounts: not mapped. The public RPC returned 429 on every call (logs/raw/rpc_getTokenLargestAccounts.json
    # is that error), so there is no raw sample. Top 10 is read from getProgramAccounts (rpc_token_account) instead.
    "jev": {  # POST api.typesafe.ai/v1/systemone. No key was given in STEP 2: no raw sample yet.
        "answer_noul": ["answers", "{q}", "noul"],   # from the prompt spec, unverified
        "model": ["model"],
        "usage": ["usage"],
        "input_tokens": None,                       # unknown until a real response is saved
    },
}


def get(source: str, field: str, obj, **fmt):
    path = MAP[source][field]
    if path is None or obj is None:
        return None
    cur = obj
    for k in path:
        k = k.format(**fmt) if "{" in k else k
        if isinstance(cur, dict) and k in cur:
            cur = cur[k]
        else:
            return None
    return cur


def has(source, field, obj):
    path = MAP[source][field]
    if path is None or obj is None:
        return False
    cur = obj
    for k in path:
        if isinstance(cur, dict) and k in cur:
            cur = cur[k]
        else:
            return False
    return True


def table():
    rows = []
    for src, m in MAP.items():
        for f, p in m.items():
            rows.append((src, f, ".".join(p) if p else None))
    return rows


if __name__ == "__main__":
    print(f"{'source':18} {'field':24} raw key")
    for s, f, p in table():
        print(f"{s:18} {f:24} {p if p else 'null (not in the raw JSON)'}")
