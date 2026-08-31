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
    assert 'data-chat-intent="offer"' in inquiry
    assert 'data-chat-intent="ask"' in inquiry
    assert 'data-chat-intent="message"' in inquiry
    assert "Make an offer" in inquiry
    assert "Ask about this piece" in inquiry
    assert "Direct message" in inquiry
    assert "data-product-price" in inquiry
    assert "window.lmChat" in inquiry
    assert "chat-trigger" not in inquiry
    assert "ShopifyChat" in inquiry


def test_inbox_bridge_composes_offer_and_ask() -> None:
    js = read("assets/inbox-chat.js")
    assert "window.lmChat" in js
    assert "I'd like to make an offer" in js
    assert "I'm asking about" in js
    assert "inbox-online-store-chat" in js
    assert "ShopifyChat" in js
    assert "hello@lauramilman.com" in js


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
