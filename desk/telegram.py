"""Telegram: long polling, owner only, pushes with FOMO buttons, commands, [Bought]/[Skip]/[Sold] callbacks."""
import asyncio

import httpx

from . import commands, config, db, notifier, util

log = util.logger("telegram")
API = "https://api.telegram.org/bot{token}/{method}"
desk = None


def keyboard(buttons):
    rows, row = [], []
    for b in buttons or []:
        if b.get("url"):
            rows.append([{"text": b["label"], "url": b["url"]}])     # exact links.py string
        elif b.get("callback"):
            row.append({"text": b["label"], "callback_data": b["callback"]})
    if row:
        rows.append(row)
    return {"inline_keyboard": rows} if rows else None


async def call(method, **params):
    token = config.secret("TG_TOKEN")
    async with httpx.AsyncClient(timeout=70) as c:
        r = await c.post(API.format(token=token, method=method), json=params)
    j = r.json()
    if not j.get("ok"):
        raise RuntimeError(f"telegram {method}: {j.get('description')}")
    return j["result"]


def owner():
    return db.kv_get("owner_chat_id")


async def send(text, buttons=None, chat_id=None):
    chat_id = chat_id or owner()
    if not chat_id:
        raise RuntimeError("no owner yet: send /start to the bot")
    params = {"chat_id": chat_id, "text": text[:4000], "disable_web_page_preview": True}
    kb = keyboard(buttons)
    if kb:
        params["reply_markup"] = kb
    return await call("sendMessage", **params)


async def _push(text, buttons):
    await send(text, buttons)


async def on_callback(cq):
    data = cq.get("data") or ""
    kind, _, ident = data.partition(":")
    try:
        ident = int(ident)
    except ValueError:
        return "?"
    if kind == "bought":
        res = desk.agents["executor"].tap_bought(ident)
    elif kind == "skip":
        res = desk.agents["executor"].tap_skip(ident)
    elif kind == "sold":
        res = desk.agents["risk"].tap_sold(ident)
    else:
        res = "?"
    return res


async def run():
    if not config.secret("TG_TOKEN"):
        log.info("no TG_TOKEN, Telegram off")
        return
    notifier.register_telegram(_push)
    offset = db.kv_get("tg_offset", 0)
    while True:
        try:
            ups = await call("getUpdates", offset=offset, timeout=50, allowed_updates=["message", "callback_query"])
        except Exception as e:  # noqa: BLE001
            log.warning("getUpdates failed: %s", type(e).__name__)
            await asyncio.sleep(5)
            continue
        for u in ups:
            offset = u["update_id"] + 1
            db.kv_set("tg_offset", offset)
            try:
                await handle_update(u)
            except Exception as e:  # noqa: BLE001
                log.exception("update failed: %s", e)
        db.beat("telegram")


async def handle_update(u):
    msg = u.get("message")
    cq = u.get("callback_query")
    chat = (msg or {}).get("chat", {}).get("id") or ((cq or {}).get("message") or {}).get("chat", {}).get("id")
    if not chat:
        return
    own = owner()
    if own is None and msg and (msg.get("text") or "").strip().startswith("/start"):
        db.kv_set("owner_chat_id", chat)      # owner lock: first /start becomes owner
        own = chat
        log.info("owner set")
    if chat != own:
        return                                 # ignore everyone else, no reply
    if cq:
        res = await on_callback(cq)
        await call("answerCallbackQuery", callback_query_id=cq["id"], text=str(res)[:190])
        return
    for text, buttons in await commands.handle(msg.get("text") or "", who="telegram"):
        await send(text, buttons, chat)
