"""STEP 13 #1b: 1 PAPER push through every channel set up. Each must carry the exact links.py URL with r=savipww.
Web push: a real VAPID-signed, aes128gcm-encrypted push to a local push service, decrypted here.
Webhook channel: a local webhook. Telegram: real send if TG_TOKEN is configured, else reported as not set up."""
import asyncio
import base64
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import http_ece
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

got = []


class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("content-length", 0))
        got.append((self.path, {k.lower(): v for k, v in self.headers.items()}, self.rfile.read(n)))
        self.send_response(201); self.end_headers()

    def log_message(self, *a):
        pass


def b64(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def test_notify_every_channel(desk_env, monkeypatch):
    from desk import config, db, links, notifier
    for k in ("NO_PROXY", "no_proxy"):
        monkeypatch.setenv(k, "127.0.0.1,localhost")
    srv = HTTPServer(("127.0.0.1", 0), H)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    got.clear()
    # a browser-like push subscription (receiver key pair + auth secret)
    recv = ec.generate_private_key(ec.SECP256R1())
    p256dh = recv.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    auth = os.urandom(16)
    db.x("INSERT INTO push_subs VALUES (?,?,?,?)", (f"http://127.0.0.1:{port}/push/abc", b64(p256dh), b64(auth), time.time()))
    config.set("desk.notifier", "channel", "test")
    config.set("desk.channel_url", f"http://127.0.0.1:{port}/hook", "test")
    mint = "AWaBBNoVuwQ22B8Y5nEtLne2uEfk8UaYEFws7vT7pump"
    url = links.coin_url(mint, "solana")
    via = asyncio.run(notifier.notify("Buy Elysion · $47.50 · 23.8% of stack", [{"label": "Buy on FOMO", "url": url}], mint=mint))
    print("delivered via:", via, "| telegram:", "configured" if config.secret("TG_TOKEN") else "not set up (no TG_TOKEN)")
    assert "webpush" in via and "channel" in via
    push = [g for g in got if g[0].startswith("/push")][0]
    hook = [g for g in got if g[0] == "/hook"][0]
    print("push headers:", {k: (v[:24] + "...") for k, v in push[1].items() if k in ("content-encoding", "authorization", "ttl")})
    assert push[1].get("content-encoding") == "aes128gcm" and push[1].get("authorization", "").lower().startswith("vapid t=")
    payload = json.loads(http_ece.decrypt(push[2], private_key=recv, auth_secret=auth, version="aes128gcm"))
    print("web push payload:", payload)
    assert payload["body"].startswith("PAPER · ") and payload["url"] == url and "r=savipww" in payload["url"]
    assert payload["title"] == "Grok Bot · now"
    body = json.loads(hook[2])
    text = body.get("text") or body.get("content")
    print("webhook text:", text.replace("\n", " | "))
    assert text.startswith("PAPER · ") and text.splitlines()[-1] == f"Buy on FOMO: {url}"
    srv.shutdown()


def test_webpush_410_deletes(desk_env, monkeypatch):
    from desk import db, webpush

    class G(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers.get("content-length", 0))); self.send_response(410); self.end_headers()

        def log_message(self, *a):
            pass
    for k in ("NO_PROXY", "no_proxy"):
        monkeypatch.setenv(k, "127.0.0.1,localhost")
    srv = HTTPServer(("127.0.0.1", 0), G)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    recv = ec.generate_private_key(ec.SECP256R1())
    p = recv.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    db.x("INSERT INTO push_subs VALUES (?,?,?,?)", (f"http://127.0.0.1:{srv.server_address[1]}/gone", b64(p), b64(os.urandom(16)), time.time()))
    assert asyncio.run(webpush.send_all("x", None)) == 0
    assert db.q1("SELECT COUNT(*) c FROM push_subs")["c"] == 0
    srv.shutdown()
