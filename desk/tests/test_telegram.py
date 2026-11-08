"""Telegram: owner lock (first /start = owner, everyone else ignored, no reply), commands, [Bought] callback.
Runs against a fake Bot API (no token needed)."""
import asyncio
import time


def test_owner_lock_commands_and_callbacks(desk_env, monkeypatch):
    from desk import commands, db, links, telegram
    from desk.main import Desk
    sent = []

    async def fake_call(method, **params):
        sent.append((method, params))
        return {"ok": True}
    monkeypatch.setattr(telegram, "call", fake_call)
    desk = Desk()
    telegram.desk = commands.desk = desk

    def msg(chat, text):
        return {"update_id": 1, "message": {"chat": {"id": chat}, "text": text}}

    asyncio.run(telegram.handle_update(msg(111, "/start")))
    assert db.kv_get("owner_chat_id") == 111 and sent[-1][1]["chat_id"] == 111
    n = len(sent)
    asyncio.run(telegram.handle_update(msg(222, "/start")))          # 2nd account: no reply
    asyncio.run(telegram.handle_update(msg(222, "status")))
    assert len(sent) == n and db.kv_get("owner_chat_id") == 111

    asyncio.run(telegram.handle_update(msg(111, "set stop to -8%")))
    assert sent[-1][1]["text"].startswith("stop -6% -> -8%")
    asyncio.run(telegram.handle_update(msg(111, "invite")))
    assert sent[-1][1]["reply_markup"]["inline_keyboard"][0][0]["url"] == links.SIGNUP_URL

    # a LIVE-style signal, tapped [Bought] from Telegram
    db.upsert_coin(dict(mint="MINTX", name="Xcoin", migrated_at=time.time(), seen_at=time.time()))
    sid = db.insert("signals", dict(mint="MINTX", ts=time.time(), price=1.0, size_usd=47.5, stack_pct=23.8,
                                    link=links.coin_url("MINTX"), mode="LIVE", status="sent"))
    asyncio.run(telegram.handle_update({"update_id": 2, "callback_query": {"id": "cb1", "data": f"bought:{sid}",
                                                                            "message": {"chat": {"id": 111}}}}))
    assert sent[-1][0] == "answerCallbackQuery" and sent[-1][1]["text"] == "position open"
    assert db.open_positions()[0]["mint"] == "MINTX"
    asyncio.run(telegram.handle_update(msg(111, "sell Xcoin")))
    kb = sent[-1][1]["reply_markup"]["inline_keyboard"]
    assert kb[0][0] == {"text": "Sell on FOMO", "url": links.coin_url("MINTX", "solana")}
    assert kb[1][0]["callback_data"].startswith("sold:")
    asyncio.run(telegram.handle_update(msg(111, "pause risk")))
    assert "can't be paused" in sent[-1][1]["text"]
