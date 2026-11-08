"""AGENT 3 · ANALYST. Builds a state, asks Jev 4 closed questions (or computes them in RULES MODE),
code applies the gate. Never decides itself."""
import asyncio
import hashlib
import json
import re
import time

import httpx

from .. import bus, config, db, fields, links, notifier, sources, util
from .base import Agent

JEV_URL = "https://api.typesafe.ai/v1/systemone"
QUESTIONS = {
    "alive_6h": {"type": "noul", "instructions": "This coin is still actively traded 6 hours from now"},
    "organic": {"type": "noul", "instructions": "Most buyers in the last 30 minutes are separate real wallets"},
    "flush": {"type": "noul", "instructions": "Price just flushed down and buyers are absorbing it"},
    "chase": {"type": "noul", "instructions": "This entry is chasing a green candle that already ran"},
}


class NoAnswer(Exception):
    pass


class BadAnswer(Exception):
    pass


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def _clean_name(s):
    return re.sub(r"(?i)\bbuy\b", "b.y", s or "?")


def _n(v, nd=0):
    if v is None:
        return "n/a"
    return f"{v:,.{nd}f}"


def build_state(scan, audit, fresh):
    ctx = audit.get("_ctx") or {}
    age = int((time.time() - (db.coin(scan["mint"]) or {}).get("migrated_at", time.time())) / 60)
    s = (f"Coin {_clean_name(fresh.get('name') or scan.get('name'))} on Solana, graduated {age} min ago. "
         f"Liquidity ${_n(fresh.get('liquidity'))}. Market cap ${_n(fresh.get('mcap'))}.\n"
         f"Last 5 min: {_n(fresh.get('b5'))} buys, {_n(fresh.get('s5'))} sells, volume ${_n(fresh.get('v5'))}, price {_n(fresh.get('p5'), 1)}%.\n"
         f"Last 1h: {_n(fresh.get('b1'))} buys, {_n(fresh.get('s1'))} sells, volume ${_n(fresh.get('v1'))}, price {_n(fresh.get('p1'), 1)}%.\n"
         f"Top 10 hold {_n(ctx.get('top10', scan.get('top10Pct')), 1)}%. Dev holds {_n(ctx.get('dev_pct'), 1)}%, sold 0. "
         f"LP {ctx.get('lp') or 'n/a'}. Bundled {ctx.get('bundled') if ctx.get('bundled') is not None else 'n/a'}. "
         f"Delegations {ctx.get('delegations') or 'n/a'}.")
    return s[: config.get("analyst.max_state_chars")]


def rules_answers(fresh, audit):
    g = lambda k: config.get("analyst.rules." + k)  # noqa: E731
    ctx = audit.get("_ctx") or {}
    alive = clamp((fresh.get("v1") or 0) / g("alive_volume_h1"))
    organic = clamp((fresh.get("b1") or 0) / g("organic_buys_h1"))
    if (ctx.get("bundled") or 0) >= g("bundled_from"):
        organic *= g("bundled_penalty")
    p5, b5, s5 = fresh.get("p5") or 0, fresh.get("b5") or 0, fresh.get("s5") or 0
    flush = 1.0 if (p5 <= -g("flush_drop_m5_pct") and b5 >= s5) else (0.5 if p5 < 0 else 0.0)
    chase = clamp((fresh.get("p1") or 0) / g("chase_h1_pct"))
    return {"alive_6h": round(alive, 4), "organic": round(organic, 4), "flush": flush, "chase": round(chase, 4)}


def gate(a):
    """Code only, Jev never sees it. Returns (score, passed, failed[])."""
    failed = []
    if a["alive_6h"] < config.get("analyst.min_alive_6h"):
        failed.append(f"alive_6h {a['alive_6h']:.2f}")
    if a["organic"] < config.get("analyst.min_organic"):
        failed.append(f"organic {a['organic']:.2f}")
    if a["chase"] > config.get("analyst.max_chase"):
        failed.append(f"chase {a['chase']:.2f}")
    score = round(100 * (a["alive_6h"] + a["organic"] + a["flush"] + (1 - a["chase"])) / 4)
    if score < config.get("analyst.min_score"):
        failed.append(f"score {score}")
    return score, not failed, failed


async def ask_jev(state, key, log):
    body = {"model": "jev-latest", "state": state, "questions": QUESTIONS}
    headers = {"Authorization": f"Bearer {key}"}
    t_end_429 = time.time() + config.get("analyst.queue_429_s")
    tries = 0
    while True:
        try:
            async with httpx.AsyncClient(timeout=config.get("analyst.timeout_s")) as c:
                r = await c.post(JEV_URL, json=body, headers=headers)
            if r.status_code == 429:
                if time.time() < t_end_429:
                    await asyncio.sleep(5)
                    continue
                raise NoAnswer("429 for 60s")
            r.raise_for_status()
            j = r.json()
            break
        except NoAnswer:
            raise
        except Exception as e:  # noqa: BLE001  HTTP error or no answer in [10]s: retry once after [2]s
            tries += 1
            log.info("jev error %s (try %d)", type(e).__name__, tries)
            if tries >= 2:
                raise NoAnswer(str(e))
            await asyncio.sleep(2)
    answers = {}
    for q in QUESTIONS:
        v = fields.get("jev", "answer_noul", j, q=q)
        if not isinstance(v, (int, float)) or not 0 <= v <= 1:
            log.warning("bad answer for %s, raw response: %s", q, json.dumps(j)[:2000])
            raise BadAnswer(q)
        answers[q] = float(v)
    usage = fields.get("jev", "usage", j) or {}
    in_tok = usage.get("input_tokens") if isinstance(usage, dict) else None
    return answers, fields.get("jev", "model", j), in_tok, usage


class Analyst(Agent):
    name = "analyst"

    def __init__(self):
        super().__init__()
        self.asked: set = set()

    async def run(self):
        while True:
            item = await self.next("analyst")
            await self.wait_unpaused()
            self.beat()
            try:
                await self.judge(item)
            except Exception as e:  # noqa: BLE001
                self.log.exception("judge crashed: %s", e)

    async def judge(self, item):
        scan, audit = item["scan"], item["audit"]
        mint = scan["mint"]
        if db.q1("SELECT 1 FROM verdicts WHERE mint=? AND ts>=?", (mint, db.night_start())):
            self.log.info("%s already scored tonight, never re-asked", mint)
            return None
        mode = config.get("analyst.mode")
        name = scan.get("name") or util.short(mint)
        self.current = {"mint": mint, "name": name}
        bus.emit("verdict", {"mint": mint, "name": name, "state": "scoring"})
        try:
            pairs = await sources.dex_tokens([mint])
        except Exception:  # noqa: BLE001
            await asyncio.sleep(2)
            pairs = await sources.dex_tokens([mint])
        if mint not in pairs:
            return self._out(scan, None, 0, False, ["no price"], "rules" if mode == "rules" else None, 0, None, mode)
        fresh = sources.pair_view(pairs[mint])
        state = build_state(scan, audit, fresh)
        shash = hashlib.sha256(state.encode()).hexdigest()[:12]
        model, in_tok = "rules", 0
        if mode == "jev":
            key = config.secret("TYPESAFE_API_KEY")
            try:
                if not key:
                    raise NoAnswer("no key")
                answers, model, in_tok, usage = await ask_jev(state, key, self.log)
            except NoAnswer:
                return self._out(scan, None, 0, False, ["no answer"], None, None, fresh, mode, shash)
            except BadAnswer:
                return self._out(scan, None, 0, False, ["bad answer"], None, None, fresh, mode, shash)
        else:
            answers = rules_answers(fresh, audit)
        score, passed, failed = gate(answers)
        return self._out(scan, answers, score, passed, failed, model, in_tok, fresh, mode, shash)

    def _out(self, scan, answers, score, passed, failed, model, in_tok, fresh, mode, shash=None):
        mint = scan["mint"]
        name = scan.get("name") or util.short(mint)
        out = {"agent": "analyst", "mint": mint, "answers": answers, "score": score, "passed": passed, "failed": failed,
               "model": model, "inputTokens": in_tok}
        a = answers or {}
        db.insert("verdicts", {"mint": mint, "ts": time.time(), "alive_6h": a.get("alive_6h"), "organic": a.get("organic"),
                               "flush": a.get("flush"), "chase": a.get("chase"), "score": score, "pass": int(passed),
                               "reason": failed[0] if failed else None, "input_tokens": in_tok, "model": model,
                               "price": (fresh or {}).get("price")})
        self.log.info("mint=%s state=%s answers=%s score=%s verdict=%s failed=%s input_tokens=%s", mint, shash, a, score,
                      "pass" if passed else "reject", failed, in_tok)
        self.current = None
        self.last = {"mint": mint, "name": name, "score": score, "passed": passed, "ts": time.time()}
        bus.emit("verdict", out | {"name": name})
        if passed:
            bus.executor.put_nowait({"scan": scan, "analyst": out, "price": fresh["price"], "name": name})
        else:
            label = "Analyst (rules)" if mode == "rules" else "Analyst"
            db.add_activity("rejected", mint, "analyst", f"Rejected {name}", f"{label} · {failed[0]}", "Skipped")
            if config.get("desk.push_rejects"):
                asyncio.create_task(notifier.notify(f"Rejected {name} · {label} · {failed[0]}",
                                                    [{"label": "Open on FOMO", "url": links.coin_url(mint, "solana")}],
                                                    mint=mint, kind="reject"))
        return out
