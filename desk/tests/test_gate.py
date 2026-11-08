"""STEP 13 #2: the gate. alive 0.69 / organic 0.64 / chase 0.31 / score 69 each reject; all at threshold pass.
Same in rules mode with fake DexScreener numbers; Activity rows read 'Analyst (rules)'."""
import asyncio
import time

from desk.agents import analyst as A


def at(**kw):
    a = {"alive_6h": 0.70, "organic": 0.65, "flush": 0.75, "chase": 0.30}
    a.update(kw)
    return a


def test_gate_thresholds(desk_env):
    s, ok, f = A.gate(at())
    assert (s, ok, f) == (70, True, []), (s, ok, f)
    for kw, rule in [({"alive_6h": 0.69}, "alive_6h 0.69"), ({"organic": 0.64}, "organic 0.64"),
                     ({"chase": 0.31}, "chase 0.31")]:
        s, ok, f = A.gate(at(**kw))
        assert not ok and f[0] == rule, (kw, f)
    s, ok, f = A.gate(at(flush=0.71))
    assert s == 69 and not ok and f == ["score 69"], (s, f)
    print("jev gate: 0.69/0.64/0.31/69 reject, thresholds pass")


def fresh(**kw):
    v = {"name": "Testcoin", "symbol": "TEST", "pool": "P", "price": 1.0, "liquidity": 60000, "mcap": 300000,
         "v5": 3000, "v1": 25000, "v24": 30000, "b5": 20, "s5": 20, "b1": 150, "s1": 90, "p5": -6, "p1": 24, "p24": 50}
    v.update(kw)
    return v


def test_rules_mode(desk_env, monkeypatch):
    from desk import config, db, bus, sources
    config.set("analyst.mode", "rules", "test")
    audit = {"_ctx": {"bundled": 0}}
    # at threshold: alive 25000/25000=1, organic 150/150=1, flush 1 (p5 -6 <= -5 and b5>=s5), chase 24/80=0.30
    a = A.rules_answers(fresh(), audit)
    assert a == {"alive_6h": 1.0, "organic": 1.0, "flush": 1.0, "chase": 0.3}, a
    assert A.gate(a)[1]
    assert A.rules_answers(fresh(v1=17250), audit)["alive_6h"] == 0.69
    assert A.rules_answers(fresh(b1=96), audit)["organic"] == 0.64
    assert A.rules_answers(fresh(p1=24.8), audit)["chase"] == 0.31
    assert A.rules_answers(fresh(), {"_ctx": {"bundled": 3}})["organic"] == 0.5   # x0.5 from 3 bundled wallets
    assert A.rules_answers(fresh(p5=-1), audit)["flush"] == 0.5
    assert A.rules_answers(fresh(p5=2), audit)["flush"] == 0.0

    # end to end through the Analyst with fake DexScreener numbers
    cases = {"MintAlive": fresh(v1=17250), "MintOrganic": fresh(b1=96), "MintChase": fresh(p1=24.8), "MintOk": fresh()}

    async def fake_dex(mints):
        return {m: {"raw": m} for m in mints}
    monkeypatch.setattr(sources, "dex_tokens", fake_dex)
    monkeypatch.setattr(sources, "pair_view", lambda p: cases[p["raw"]])
    for m in cases:
        db.upsert_coin(dict(mint=m, name=m, migrated_at=time.time() - 1200, seen_at=time.time()))

    async def go():
        an = A.Analyst()
        outs = {}
        for m in cases:
            outs[m] = await an.judge({"scan": {"mint": m, "name": m}, "audit": audit})
        return outs
    outs = asyncio.run(go())
    assert outs["MintOk"]["passed"] and outs["MintOk"]["model"] == "rules" and outs["MintOk"]["inputTokens"] == 0
    rows = {r["mint"]: r["subtitle"] for r in db.q("SELECT * FROM activity")}
    print(rows)
    assert rows["MintAlive"] == "Analyst (rules) · alive_6h 0.69"
    assert rows["MintOrganic"] == "Analyst (rules) · organic 0.64"
    assert rows["MintChase"] == "Analyst (rules) · chase 0.31"
    assert "MintOk" not in rows
    assert bus.executor.qsize() == 1


def test_jev_no_key_never_falls_back(desk_env, monkeypatch):
    from desk import config, db, sources
    config.set("analyst.mode", "jev", "test")

    async def fake_dex(mints):
        return {m: {"raw": m} for m in mints}
    monkeypatch.setattr(sources, "dex_tokens", fake_dex)
    monkeypatch.setattr(sources, "pair_view", lambda p: fresh())
    db.upsert_coin(dict(mint="M1", name="M1", migrated_at=time.time(), seen_at=time.time()))
    out = asyncio.run(A.Analyst().judge({"scan": {"mint": "M1", "name": "M1"}, "audit": {"_ctx": {}}}))
    assert not out["passed"] and out["failed"] == ["no answer"]
    assert db.q1("SELECT subtitle FROM activity")["subtitle"] == "Analyst · no answer"


def test_state_has_no_thresholds_or_buy(desk_env):
    from desk import db
    db.upsert_coin(dict(mint="M2", name="BUY the dip", migrated_at=time.time() - 900, seen_at=time.time()))
    s = A.build_state({"mint": "M2", "name": "BUY the dip"}, {"_ctx": {"top10": 16.8, "dev_pct": 0.9, "lp": "100% locked",
                                                                         "bundled": 0, "delegations": "none"}}, fresh(name="BUY the dip"))
    import re
    assert not re.search(r"\bbuy\b", s, re.I), s
    assert "0.7" not in s and "70" not in s.split("Top")[0].split("Liquidity")[0] and len(s) <= 3000
