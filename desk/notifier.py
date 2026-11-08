"""One notifier for every channel. Same text, same FOMO buttons from links.py.

buttons: [{"label": "Buy on FOMO", "url": links.coin_url(...)}, {"label": "Bought", "callback": "bought:12"}]
Telegram gets inline buttons. Web push gets the first URL as the tap target. A channel without buttons
(webhook / plain text) gets the full links.py URL as a line under the message.
"""
import asyncio
import time

import httpx

from . import config, db, links, util

log = util.logger("notifier")
_tg_send = None      # set by telegram.py
_extra_sinks = []    # tests can add a sink(text, buttons, meta)


def register_telegram(fn):
    global _tg_send
    _tg_send = fn


def url_buttons(buttons):
    return [b for b in buttons or [] if b.get("url")]


def plain(text, buttons):
    """Plain-text rendering: message + full FOMO URL under it. Never shortened."""
    lines = [text] + [f"{b['label']}: {b['url']}" for b in url_buttons(buttons)]
    return "\n".join(lines)


def channels():
    out = []
    if config.secret("TG_TOKEN") and _tg_send is not None:
        out.append("telegram")
    if db.q1("SELECT 1 FROM push_subs LIMIT 1"):
        out.append("webpush")
    if config.get("desk.notifier") == "channel" and config.get("desk.channel_url"):
        out.append("channel")
    return out


async def notify(text, buttons=None, mint=None, kind="info", paper_prefix=True, retries=3):
    """Send 1 push to every configured channel. Returns the list of channels that delivered."""
    if paper_prefix and config.get("desk.mode") == "PAPER" and not text.startswith("PAPER · "):
        text = "PAPER · " + text
    buttons = buttons or []
    for b in url_buttons(buttons):
        assert "r=savipww" in b["url"] or b["url"] == links.SIGNUP_URL, "FOMO links only from links.py"
    first = url_buttons(buttons)[0]["url"] if url_buttons(buttons) else (links.coin_url(mint) if mint else None)
    db.insert("pushes", dict(ts=time.time(), text=text, url=first, mint=mint))
    delivered = []
    for ch in channels():
        for attempt in range(retries):
            try:
                if ch == "telegram":
                    await _tg_send(text, buttons)
                elif ch == "webpush":
                    from . import webpush
                    n = await webpush.send_all(text, first, mint)
                    if n == 0:
                        raise RuntimeError("no web push delivered")
                elif ch == "channel":
                    await _webhook(text, buttons)
                delivered.append(ch)
                break
            except Exception as e:  # noqa: BLE001
                log.warning("push via %s failed (%d/%d): %s", ch, attempt + 1, retries, e)
                await asyncio.sleep(1 + attempt)
    for sink in _extra_sinks:
        sink(text, buttons, {"mint": mint, "kind": kind})
        delivered.append("sink")
    log.info("push kind=%s mint=%s via=%s text=%r", kind, mint, delivered or "none", text)
    return delivered


async def _webhook(text, buttons):
    url = config.get("desk.channel_url")
    body = plain(text, buttons)
    async with httpx.AsyncClient(timeout=15) as c:
        payload = {"content": body} if "discord" in url else {"text": body}
        r = await c.post(url, json=payload)
        r.raise_for_status()
