"""Web Push with VAPID: sends the same pushes to subscribed devices (db.push_subs). 410 Gone = delete."""
import asyncio
import json
import time

from pywebpush import WebPushException, webpush

from . import config, db, util

log = util.logger("webpush")


def save_sub(sub: dict):
    keys = sub.get("keys") or {}
    if not (sub.get("endpoint", "").startswith("https://") and keys.get("p256dh") and keys.get("auth")):
        raise ValueError("bad subscription")
    db.x("INSERT INTO push_subs VALUES (?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth",
         (sub["endpoint"], keys["p256dh"], keys["auth"], time.time()))


def _send(row, payload):
    sub = {"endpoint": row["endpoint"], "keys": {"p256dh": row["p256dh"], "auth": row["auth"]}}
    origin = config.secret("PUBLIC_URL") or "https://localhost"
    webpush(sub, json.dumps(payload), vapid_private_key=config.secret("VAPID_PRIVATE_KEY"),
            vapid_claims={"sub": origin if origin.startswith("https://") else "https://localhost"}, ttl=600)


async def send_all(text, url, mint=None):
    payload = {"title": f"{config.APP_NAME} · now", "body": text, "url": url, "mint": mint}
    n = 0
    for row in db.q("SELECT * FROM push_subs"):
        try:
            await asyncio.to_thread(_send, row, payload)
            n += 1
        except WebPushException as e:
            code = getattr(e.response, "status_code", None)
            if code in (404, 410):
                db.x("DELETE FROM push_subs WHERE endpoint=?", (row["endpoint"],))
                log.info("subscription gone (%s), deleted", code)
            else:
                log.warning("web push failed: %s", code)
        except Exception as e:  # noqa: BLE001
            log.warning("web push error: %s", type(e).__name__)
    return n
