# Grok Bot desk

A private trading desk: 5 agents (Scanner, Auditor, Analyst, Executor, Risk) in one always-on Python
process, an iPhone web app, and pushes with FOMO buttons. **It never places an order and never touches funds.**
FOMO has no public order API: you tap *Buy on FOMO* / *Sell on FOMO* and trade inside FOMO yourself.
PAPER mode (the default) simulates fills, exits and FOMO fees.

Not financial advice. Graduated memecoins are extremely risky: the Auditor makes rugs rarer, not impossible.

## What runs

```
PumpPortal migrations ─► Scanner ─► Auditor (8 layers) ─► Analyst (Jev or rules) ─► Executor (size + 1 push) ─► Risk (exits)
                         waiting room   RPC + RugCheck       gate in code              PAPER fill / LIVE tap       stop / trail / timeout
```

| file | what |
|---|---|
| `main.py` | starts everything in one asyncio loop, heartbeats, balance every minute, ticket check every night |
| `config.py` | every STEP 10 setting with default, min/max, aliases; change log; secrets file; ticket check |
| `fields.py` | the raw-key mapping (STEP 2). Agents read source JSON only through it |
| `sources.py` | DexScreener (1 rate limiter for the whole desk, ≤250/min), RugCheck, Solana RPC |
| `links.py` | the only place a FOMO URL is built |
| `fees.py` | FOMO fee model for PAPER PnL |
| `agents/` | the 5 agents |
| `notifier.py` `telegram.py` `webpush.py` | pushes: Telegram buttons, Web Push (VAPID), or a webhook channel |
| `commands.py` | `buy X`, `sell X`, `why X`, `pause Scanner`, `set stop to -8%`, `stack 1240`, `status`, `paper`/`live`, `invite`, `report` |
| `api.py` | JSON + SSE for the app (plan A), morning Page at a secret path |
| `report.py` `health.py` | the 2 routines: night-report and desk-health |
| `proof.py` | STEP 2 proofs incl. the LAYER 8 proof and the mapping table |
| `web/` | the app: plain HTML/CSS/JS, charts drawn on `<canvas>` |

## Run it

```bash
cd ~/shorts-videos
python3.12 -m venv desk/.venv && desk/.venv/bin/pip install -r desk/requirements.txt
desk/.venv/bin/python -m desk.proof            # STEP 2 proofs, must say LAYER 8 PASS
desk/.venv/bin/python -m desk.main             # the desk on :8787
```

Secrets live in `$DESK_HOME/secrets.json` (default `~/.grokdesk`, chmod 600), never in the repo:
`APP_TOKEN`, the VAPID pair and `PAGE_KEY` are generated on first start. Optional: `TG_TOKEN`,
`TYPESAFE_API_KEY` (Jev) as environment variables or in that file. Without a Jev key the Analyst runs in
rules mode. Without Telegram, pushes go to Web Push (app on the home screen) and commands work in the
app's Account tab ("Talk to the desk").

Open the app once as `https://YOUR-URL/#t=APP_TOKEN` (print it with
`python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.grokdesk/secrets.json')))['APP_TOKEN'])"`).
The token is then kept in the phone's localStorage and the fragment is removed from the address bar.
Safari → Share → Add to Home Screen, then Account → Enable notifications.

### Hosting (plan A)

The process serves `web/` and `/api` itself. Put it behind HTTPS on any always-on Linux box:
`deploy/grokdesk.service` (systemd), `deploy/Caddyfile` (HTTPS reverse proxy, SSE-friendly),
`deploy/crontab` (the 2 routines). Set `PUBLIC_URL` so the morning Page link is right.

## Learning from mistakes (`learner.py`)

After every closed trade the desk writes a post-mortem (tags: `rug` = lost over half the ticket, `gap` = stop filled
more than 2 points past the line, `fast` = lost inside 2 minutes, `fee-heavy` = fees over a quarter of the loss),
then looks for lessons:

- **Rug** (one is enough): tickets are capped at 10% of the stack (`executor.max_ticket_pct`). No stop survives a rug;
  only size limits the damage. FOMO charges 2% below $47.50 *and* at $47.50, so bumping a small ticket buys no
  fee saving, only more risk.
- **Gap** (one is enough): Risk polls every 5 s (`risk.poll_s`). Risk reads the price from the pool's own two vaults
  on-chain (DexScreener caches about 30 s), as a ratio to the on-chain reading at entry so stops never mix sources.
- **Patterns**: an entry gate (min liquidity, min score, max chase, max top 10, max 1h change, max 5-minute drop) is
  tightened when at least 2 losing trades share a value that no winning trade had and they explain at least half the
  $ lost. Guards against overfitting: the threshold must sit inside the setting's range (never at its edge) and one
  lesson tightens a gate by at most 3x.

It never loosens anything. `desk.learner`: `auto` (default: apply, push "Learned #N…"), `suggest` (push, apply with
`apply lesson N`), `off`. Every lesson is in the change log as `learner`, on the Trades screen, the live app and the
morning Page; `undo lesson N` restores the old value, and an undone lesson only returns with 2 new losses.

## Tests (STEP 13)

```bash
desk/.venv/bin/python -m pytest desk/tests -q
DESK_SECRETS=~/.grokdesk/secrets.json desk/.venv/bin/python -m pytest desk/tests/test_secrets.py -q   # live secrets
desk/.venv/bin/python -m desk.tests.test_replay --minutes 120                                        # live replay
```

## Decisions where the prompt left room

- **Pool address and creator.** The PumpPortal migration message is `{signature, mint, txType:"migrate", pool:"pump-amm"}`.
  `pool` is the AMM name, not an address, so the pool comes from DexScreener `pairAddress` and the creator from
  RugCheck `creator` (both mapped in `fields.py`).
- **Kills start at pool age 10 min.** Coins sit in the waiting room for 10 minutes (prices are recorded) before
  the kill list is applied; the first kill is final. Unknown to DexScreener after 60 min: "never qualified".
- **Top 10 holders** drop accounts owned by the pool or the pump.fun bonding curve (PDA derived in code, it
  matches RugCheck's label), summed per wallet. The public RPC answered `getTokenLargestAccounts` with 429 on
  every call, so there is no raw sample of it; top 10 is read from the full `getProgramAccounts` list instead
  (the same call Layer 8 needs, cached 60 s).
- **Layer 5** reads `markets[pubkey == pool].lp.lpLockedPct` (RugCheck folds burned LP into "locked") and
  `lp.quoteUSD + lp.baseUSD` for "liquidity pulled".
- **Layer 7** joins all insider networks by their `links`, counts holders per connected group (funders that
  hold nothing still connect wallets). An empty list = no insider network = "None". A network without `links`,
  or a non-list response = red "no data: bundles".
- **Layer 8** is red when one delegate controls more than `max_delegated_accounts` (10) holder accounts.
- **Layer 3** needs the creator balance stored at migration; if that wasn't readable it is red "no data: dev".
- **WebSocket silence.** At about 20 graduations an hour the 120 s silence rule reconnects by itself; those
  reconnects are logged but only real drops count toward the ">10 reconnects in an hour" alert.
- **A night** opens when the desk starts and closes when the morning report runs. LIVE unlocks after 1 PAPER
  night of at least `desk.min_paper_night_h` (6 h) closed by a report.
- **Jev.** The `/v1/systemone` call is implemented to the prompt. No key was given, so there is no raw
  response yet: `fields.py` marks the Jev keys unverified and `input_tokens` null until one is saved.
- **Referral.** Every FOMO link carries the referral code `savipww` from the prompt (the guide author's code, as
  written in the prompt). Change it only in `links.py`.
