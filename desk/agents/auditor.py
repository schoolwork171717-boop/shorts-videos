"""AGENT 2 · AUDITOR. Takes every coin Scanner passes apart, 8 layers, in order. One red layer and it's dead."""
import asyncio
import time

from .. import bus, config, db, fields, links, notifier, sources, util
from .base import Agent, retry

LAYERS = ["Mint authority", "Freeze authority", "Dev wallet", "Top 10 holders", "Liquidity", "Pool age",
          "Bundled wallets", "Delegations"]


def bundled_from_graph(graph):
    """Biggest funded-together group of wallets that hold this mint. None = no data."""
    if not isinstance(graph, list):
        return None
    parent = {}

    def find(a):
        parent.setdefault(a, a)
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    holders = set()
    for net in graph:
        if not isinstance(net, dict) or not fields.has("rugcheck_graph", "edges", net):
            return None
        for n in fields.get("rugcheck_graph", "nodes", net) or []:
            nid = fields.get("rugcheck_graph", "node_id", n)
            find(nid)
            if (fields.get("rugcheck_graph", "node_holdings", n) or 0) > 0:
                holders.add(nid)
        for e in fields.get("rugcheck_graph", "edges", net) or []:
            a, b = fields.get("rugcheck_graph", "edge_source", e), fields.get("rugcheck_graph", "edge_target", e)
            if a and b:
                parent[find(a)] = find(b)
    groups = {}
    for h in holders:
        r = find(h)
        groups[r] = groups.get(r, 0) + 1
    biggest = max(groups.values()) if groups else 0
    return biggest if biggest >= 2 else 0


def delegations(accounts):
    """holders (balance > 0) and the biggest delegate group over holder accounts."""
    holders = 0
    per = {}
    for a in accounts:
        amt = int(fields.get("rpc_token_account", "amount_raw", a) or 0)
        if amt <= 0:
            continue
        holders += 1
        d = fields.get("rpc_token_account", "delegate", a)
        if d:
            per[d] = per.get(d, 0) + 1
    if not per:
        return holders, 0, None
    d, n = max(per.items(), key=lambda kv: kv[1])
    return holders, n, d


def age_text(minutes):
    m = int(minutes)
    return f"{m}m" if m < 60 else f"{m // 60}h {m % 60}m"


class Auditor(Agent):
    name = "auditor"

    def __init__(self):
        super().__init__()
        self.layer8_alerted_night = None

    async def run(self):
        while True:
            item = await self.next("auditor")
            await self.wait_unpaused()
            self.beat()
            try:
                await self.audit(item)
            except Exception as e:  # noqa: BLE001
                self.log.exception("audit crashed for %s: %s", item.get("mint"), e)

    def rejected_tonight(self, mint):
        return db.q1("SELECT 1 FROM audits WHERE mint=? AND ts>=? AND pass=0", (mint, db.night_start())) is not None

    async def audit(self, scan, forward=True):
        mint = scan["mint"]
        if self.rejected_tonight(mint):
            self.log.info("%s already rejected tonight, not re-audited", mint)
            return None
        coin = db.coin(mint) or {}
        name = scan.get("name") or coin.get("name") or util.short(mint)
        R, G = config.get("auditor.retries"), config.get("auditor.retry_gap_s")
        self.current = {"mint": mint, "name": name, "layers": [], "started": time.time()}
        bus.emit("audit_start", {"mint": mint, "name": name})
        ctx = {"bundled": None, "dev_pct": None, "lp": None, "delegations": None}
        results = []

        if not config.get("auditor.enabled"):
            for i, ln in enumerate(LAYERS, 1):
                results.append({"n": i, "name": ln, "pass": None, "value": "not checked", "source": "off"})
            out = self._finish(scan, name, results, passed=True, reason=None, holders=None, ctx=ctx, forward=forward)
            return out

        # fetch each source once per audit and reuse it
        acct, acct_err = await retry(lambda: sources.account_info(mint), R, G, self.log, f"{mint} getAccountInfo")
        report, rep_err = await retry(lambda: sources.rugcheck(mint, "report"), R, G, self.log, f"{mint} rugcheck report")
        graph = None
        holders = None

        async def layer(n):
            nonlocal graph, holders
            if n in (1, 2):
                key = "mint_authority" if n == 1 else "freeze_authority"
                if acct is None or not fields.has("rpc_account_info", key, acct):
                    return False, f"no data: {LAYERS[n-1].lower()}", "rpc"
                auth = fields.get("rpc_account_info", key, acct)
                if auth is None:
                    return True, "Revoked", "rpc"
                return False, "mint not revoked" if n == 1 else "freeze not revoked", "rpc"
            if n == 3:
                creator = coin.get("creator") or fields.get("rugcheck_report", "creator", report)
                if creator and not coin.get("creator"):
                    db.upsert_coin(dict(mint=mint, creator=creator))
                sup, err = await retry(lambda: sources.token_supply(mint), R, G, self.log, f"{mint} supply")
                if not sup or not sup[0]:
                    return False, "no supply", "rpc"
                ctx["supply"] = sup[0]
                if not creator:
                    return False, "no data: dev", "rpc"
                bal, err = await retry(lambda: sources.owner_balance(creator, mint), R, G, self.log, f"{mint} dev balance")
                if bal is None:
                    return False, "no data: dev", "rpc"
                at_mig = coin.get("creator_balance_at_migration")
                if at_mig is None:
                    return False, "no data: dev", "rpc"
                p = 100 * bal / sup[0]
                ctx["dev_pct"] = round(p, 2)
                if p >= config.get("auditor.max_dev_pct"):
                    return False, f"dev holds {p:.0f}%", "rpc"
                if bal < at_mig:
                    return False, "dev sold", "rpc"
                return True, f"{p:.1f}% · sold 0", "rpc"
            if n == 4:
                pool = scan.get("pool") or coin.get("pool")
                res, err = await retry(lambda: sources.top10_pct(mint, pool, ctx.get("supply")), R, G, self.log, f"{mint} top10")
                if not res or res[0] is None:
                    return False, "no data: top 10", "rpc"
                t = res[0]
                ctx["top10"] = t
                if t >= config.get("auditor.max_top10_pct"):
                    return False, f"top 10 hold {t:.0f}%", "rpc"
                return True, f"{t:.1f}%", "rpc"
            if n == 5:
                pool = scan.get("pool") or coin.get("pool")
                mk = None
                for m in fields.get("rugcheck_report", "markets", report) or []:
                    if fields.get("rugcheck_report", "market_pool", m) == pool:
                        mk = m
                        break
                if mk is None or not fields.has("rugcheck_report", "market_lp_locked_pct", mk):
                    return False, "no data: liquidity", "rugcheck"
                va, vb = fields.get("rugcheck_report", "market_vault_a", mk), fields.get("rugcheck_report", "market_vault_b", mk)
                if va and vb:
                    base_is_a = fields.get("rugcheck_report", "market_mint_a", mk) == mint
                    db.upsert_coin(dict(mint=mint, vault_base=va if base_is_a else vb, vault_quote=vb if base_is_a else va))
                locked = fields.get("rugcheck_report", "market_lp_locked_pct", mk) or 0
                ctx["lp"] = f"{locked:g}% locked"
                if locked < config.get("auditor.min_lp_locked_pct"):
                    return False, "liquidity unlocked", "rugcheck"
                q_usd = fields.get("rugcheck_report", "market_quote_usd", mk)
                b_usd = fields.get("rugcheck_report", "market_base_usd", mk)
                liq_now = (q_usd or 0) + (b_usd or 0) if (q_usd is not None or b_usd is not None) else None
                liq_scan = scan.get("liquidityUsd")
                if liq_now is not None and liq_scan:
                    if liq_now < liq_scan * (1 - config.get("auditor.max_liq_drop_pct") / 100):
                        return False, "liquidity pulled", "rugcheck"
                return True, f"{locked:g}% locked", "rugcheck"
            if n == 6:
                mig = coin.get("migrated_at")
                if not mig:
                    return False, "no data: pool age", "rpc"
                age = (time.time() - mig) / 60
                if age < config.get("auditor.min_pool_age_min"):
                    return False, "pool too young", "rpc"
                return True, age_text(age), "rpc"
            if n == 7:
                graph, err = await retry(lambda: sources.rugcheck(mint, "graph"), R, G, self.log, f"{mint} rugcheck graph")
                b = bundled_from_graph(graph)
                if b is None:
                    return False, "no data: bundles", "rugcheck"
                ctx["bundled"] = b
                if b >= config.get("auditor.max_bundled"):
                    return False, f"{b} bundled wallets", "rugcheck"
                return True, "None" if b == 0 else f"{b} linked", "rugcheck"
            if n == 8:
                accs, err = await retry(lambda: sources.token_accounts(mint, max_age=0), R, G, self.log, f"{mint} getProgramAccounts")
                if accs is None:
                    await self._layer8_down()
                    return False, "no data: delegations", "rpc"
                holders, nmax, dlg = delegations(accs)
                db.upsert_coin(dict(mint=mint, holders=holders))
                ctx["holders"] = holders
                ctx["delegations"] = "none" if nmax == 0 else f"max {nmax} accounts on 1 delegate"
                if nmax > config.get("auditor.max_delegated_accounts"):
                    return False, f"{nmax} wallets → {util.short(dlg)}", "rpc"
                return True, "None" if nmax == 0 else f"{nmax} → {util.short(dlg)}", "rpc"

        reason = None
        for n in range(1, 9):
            self.current["layer"] = n
            bus.emit("audit_layer", {"mint": mint, "n": n, "name": LAYERS[n - 1], "state": "reading"})
            t0 = time.time()
            try:
                ok, val, src = await layer(n)
            except Exception as e:  # noqa: BLE001  # no data is never a pass
                self.log.warning("%s layer %d error %s", mint, n, e)
                ok, val, src = False, f"no data: {LAYERS[n-1].lower()}", "rpc"
            ms = int((time.time() - t0) * 1000)
            row = {"n": n, "name": LAYERS[n - 1], "pass": ok, "value": val, "source": src}
            results.append(row)
            self.current["layers"].append(row)
            db.insert("audits", {"mint": mint, "ts": time.time(), "layer": n, "name": LAYERS[n - 1], "value_text": val,
                                 "pass": int(ok), "source": src})
            self.log.info("mint=%s layer=%d %s value=%r pass=%s ms=%d", mint, n, LAYERS[n - 1], val, ok, ms)
            bus.emit("audit_layer", {"mint": mint, **row, "ms": ms})
            if not ok:
                reason = val
                break
        for n in range(len(results) + 1, 9):
            results.append({"n": n, "name": LAYERS[n - 1], "pass": None, "value": "not checked", "source": None})
        return self._finish(scan, name, results, reason is None, reason, holders, ctx, forward)

    def _finish(self, scan, name, results, passed, reason, holders, ctx, forward):
        mint = scan["mint"]
        out = {"agent": "auditor", "mint": mint, "ts": util.iso(), "passed": passed,
               "layersChecked": sum(1 for r in results if r["pass"] is not None), "layers": results,
               "holders": holders, "reason": reason, "_ctx": ctx}
        self.log.info("mint=%s verdict=%s reason=%s", mint, "pass" if passed else "red", reason)
        self.current = None
        self.last = {"mint": mint, "name": name, "passed": passed, "reason": reason, "ts": time.time()}
        bus.emit("audit", {k: v for k, v in out.items() if k != "_ctx"} | {"name": name})
        if passed:
            if forward:
                bus.analyst.put_nowait({"scan": scan, "audit": out})
        else:
            db.add_activity("rejected", mint, "auditor", f"Rejected {name}", f"Auditor · {reason}", "Skipped")
            if config.get("desk.push_rejects") and forward:
                asyncio.create_task(notifier.notify(f"Rejected {name} · Auditor · {reason}",
                                                    [{"label": "Open on FOMO", "url": links.coin_url(mint, "solana")}],
                                                    mint=mint, kind="reject"))
        return out

    async def _layer8_down(self):
        night = db.current_night()["id"]
        n = (db.kv_get(f"layer8_kills.{night}", 0) or 0) + 1
        db.kv_set(f"layer8_kills.{night}", n)
        if self.layer8_alerted_night != night:
            self.layer8_alerted_night = night
            await notifier.notify("layer 8 down, every coin is red until rpc_url changes", [], kind="alert",
                                  paper_prefix=False)
