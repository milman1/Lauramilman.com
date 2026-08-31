#!/usr/bin/env python3
"""Guard Shopify Inbox wiring for product concierge buttons."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text()


def test_custom_bubble_is_gone() -> None:
    widget = read("snippets/chat-widget.liquid")
    theme = read("assets/theme.js")
    assert "chat-trigger" not in widget
    assert "chat-panel" not in widget
    assert "ChatContactForm" not in widget
    assert "chat-trigger" not in theme
    assert "inbox-chat.js" in widget
    assert "render 'chat-widget'" in read("layout/theme.liquid")


def test_product_buttons_open_inbox() -> None:
    inquiry = read("snippets/product-inquiry.liquid")
    assert 'data-chat-intent="hold"' in inquiry
    assert 'data-chat-intent="offer"' in inquiry
    assert 'data-chat-intent="ask"' in inquiry
    assert 'data-chat-intent="message"' in inquiry
    assert 'data-chat-intent="viewing"' in inquiry
    assert 'data-chat-intent="consult"' in inquiry
    assert "Hold this piece" in inquiry
    assert "Make an offer" in inquiry
    assert "Ask about this piece" in inquiry
    assert "Direct message" in inquiry
    assert "data-product-price" in inquiry
    assert "window.lmChat" in inquiry
    assert "chat-trigger" not in inquiry
    assert "ShopifyChat" in inquiry
    assert "piece-hold" not in inquiry
    assert "LmHold" not in inquiry
    assert "data-open-hold" not in inquiry


def test_hold_modal_is_gone() -> None:
    assert not (ROOT / "snippets/piece-hold.liquid").exists()
    theme = read("assets/theme.js")
    assert "LmHold" not in theme
    assert "data-open-hold" not in theme
    js = read("assets/inbox-chat.js")
    assert "lmHold" not in js
    assert "Please hold " in js


def test_inbox_bridge_composes_offer_and_ask() -> None:
    js = read("assets/inbox-chat.js")
    assert "window.lmChat" in js
    assert "I'd like to make an offer" in js
    assert "I'm asking about" in js
    assert "Please hold " in js
    assert "private viewing" in js
    assert "book a consultation" in js
    assert "inbox-online-store-chat" in js
    assert "ShopifyChat" in js
    assert "hello@lauramilman.com" in js
    assert "Hold request" in js


def test_compose_hold_runtime() -> None:
    import json
    import subprocess

    script = r"""
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('assets/inbox-chat.js', 'utf8');
const sandbox = {
  window: {},
  document: { getElementById() { return null; }, querySelector() { return null; } },
  setTimeout,
};
sandbox.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const compose = sandbox.window.lmChat.compose;
const hold = compose({
  intent: 'hold',
  productTitle: 'Rolex Daytona',
  productUrl: 'https://www.lauramilman.com/products/rolex-daytona'
});
const offer = compose({
  intent: 'offer',
  productTitle: 'Cartier Love Bracelet',
  productPrice: '$6,800',
  productUrl: 'https://www.lauramilman.com/products/cartier-love-bracelet'
});
process.stdout.write(JSON.stringify({ hold, offer }));
"""
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    assert "Please hold Rolex Daytona" in payload["hold"]
    assert "callback number" in payload["hold"]
    assert "I'd like to make an offer on Cartier Love Bracelet (listed at $6,800)" in payload["offer"]
    assert "lm-hold" not in payload["hold"]
    assert "Phone number" not in payload["hold"]


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_")]
    failed = 0
    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except Exception as exc:
            failed += 1
            print(f"FAIL {test.__name__}: {exc}")
    raise SystemExit(failed)
