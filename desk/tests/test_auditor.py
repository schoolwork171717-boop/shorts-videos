"""STEP 13 #5: Auditor on a mint with freeze authority set: red at layer 2, layers 3-8 'not checked'.
Uses the real getAccountInfo sample from logs/raw/ with freezeAuthority set to a wallet."""
import asyncio
import copy
import json
import time
from pathlib import Path

RAW = Path(__file__).resolve().parents[1] / "logs" / "raw"


def test_freeze_authority_red_at_layer2(desk_env, monkeypatch):
    from desk import db, sources
    from desk.agents.auditor import Auditor
    info = json.loads((RAW / "rpc_getAccountInfo.json").read_text())
    frozen = copy.deepcopy(info)
    frozen["result"]["value"]["data"]["parsed"]["info"]["freezeAuthority"] = "9fQxTk2bJ8rN5wq3d6Ezc8yH1aGv4pLmS7uR2nT2a"
    calls = []

    async def acct(m):
        calls.append("getAccountInfo"); return frozen

    async def rug(m, what="report"):
        calls.append("rugcheck " + what); return json.loads((RAW / "rugcheck_report.json").read_text())

    async def never(*a, **k):
        raise AssertionError("layers 3-8 must not be checked")
    monkeypatch.setattr(sources, "account_info", acct)
    monkeypatch.setattr(sources, "rugcheck", rug)
    monkeypatch.setattr(sources, "token_supply", never)
    monkeypatch.setattr(sources, "token_accounts", never)
    m = "FrozenMint1111111111111111111111111111pump"
    db.upsert_coin(dict(mint=m, name="Frozen", migrated_at=time.time() - 1800, seen_at=time.time()))
    out = asyncio.run(Auditor().audit({"mint": m, "name": "Frozen", "pool": "P", "liquidityUsd": 50000}))
    L = out["layers"]
    for x in L:
        print(x["n"], x["name"], "->", x["value"], x["pass"])
    assert not out["passed"] and out["reason"] == "freeze not revoked" and out["layersChecked"] == 2
    assert L[0]["pass"] is True and L[0]["value"] == "Revoked"
    assert L[1]["pass"] is False and L[1]["value"] == "freeze not revoked"
    assert all(x["value"] == "not checked" and x["pass"] is None for x in L[2:])
    row = db.q1("SELECT * FROM activity")
    assert (row["title"], row["subtitle"], row["value"]) == ("Rejected Frozen", "Auditor · freeze not revoked", "Skipped")
    # never re-audits a rejected mint the same night
    assert asyncio.run(Auditor().audit({"mint": m, "name": "Frozen"})) is None


def test_bundles_and_delegations_from_real_shapes():
    from desk.agents.auditor import bundled_from_graph, delegations
    g = [{"nodes": [{"id": "A", "holdings": 5}, {"id": "B", "holdings": 3}, {"id": "F", "holdings": 0}, {"id": "C", "holdings": 1}],
          "links": [{"source": "F", "target": "A"}, {"source": "F", "target": "B"}, {"source": "F", "target": "C"}]}]
    assert bundled_from_graph(g) == 3          # funded together through F, F holds nothing
    assert bundled_from_graph([]) == 0         # no insider network found
    assert bundled_from_graph([{"nodes": []}]) is None   # graph without the edges key = no data
    assert bundled_from_graph({"error": "x"}) is None
    acc = lambda amt, d=None: {"account": {"data": {"parsed": {"info": {"tokenAmount": {"amount": str(amt)}, "delegate": d}}}}}  # noqa: E731
    holders, n, d = delegations([acc(1, "D")] * 41 + [acc(0, "D")] * 5 + [acc(7)] * 3)
    assert (holders, n, d) == (44, 41, "D")
