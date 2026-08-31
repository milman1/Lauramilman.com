#!/usr/bin/env python3
"""Guard branded email templates used by Shopify automations and notifications."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EMAILS = ROOT / "emails"

MARKETING = (
    "welcome.html",
    "abandoned-checkout.html",
    "abandoned-cart.html",
)
TRANSACTIONAL = (
    "order-confirmation.html",
    "shipping-confirmation.html",
    "customer-account-welcome.html",
    "customer-account-invite.html",
)
PASTE_FILES = MARKETING + TRANSACTIONAL

BRAND_TOKENS = (
    "#1E1109",
    "#C9A050",
    "Laura",
    "Milman",
    "hello@lauramilman.com",
)


def read(name: str) -> str:
    return (EMAILS / name).read_text()


def test_paste_files_exist() -> None:
    for name in PASTE_FILES:
        assert (EMAILS / name).is_file(), name
    assert (EMAILS / "README.md").is_file()


def test_accessibility_lang_dir_title_and_single_h1() -> None:
    for name in PASTE_FILES:
        html = read(name)
        assert 'lang="en"' in html and 'dir="ltr"' in html, name
        assert "<title>" in html, name
        assert html.lower().count("<h1") == 1, name
        assert html.count('lang="en"') >= 2, name
        assert 'role="presentation"' in html, name


def test_brand_chrome() -> None:
    for name in PASTE_FILES:
        html = read(name)
        for token in BRAND_TOKENS:
            assert token in html, f"{name} missing {token}"
        assert "box-sizing:border-box" in html, name
        assert len(html.encode("utf-8")) < 102_400, name


def test_marketing_compliance() -> None:
    for name in MARKETING:
        html = read(name)
        assert "{{ unsubscribe_url }}" in html, name
        assert "{{ open_tracking }}" in html, name
        assert "{{ open_tracking_block }}" in html, name
        assert "shop.address" in html, name


def test_transactional_is_not_promotional() -> None:
    for name in TRANSACTIONAL:
        html = read(name)
        assert "{{ unsubscribe_url }}" not in html, name
        assert "LMNYWELCOME" not in html, name
        assert "shop.address" in html, name


def test_welcome_offer() -> None:
    html = read("welcome.html")
    assert "LMNYWELCOME" in html
    assert "collections/all" in html
    assert "not watches" in html.lower()


def test_order_confirmation_has_line_items_and_totals() -> None:
    html = read("order-confirmation.html")
    assert "subtotal_line_items" in html
    assert "order_status_url" in html
    assert "total_price" in html
    assert '<th scope="col"' in html
    assert "14 days" in html
    assert "{{ name }}" in html
    assert "{{ order.name }}" not in html
    assert "order_number | default" not in html


def test_shipping_confirmation_has_tracking() -> None:
    html = read("shipping-confirmation.html")
    assert "fulfillment.tracking" in html
    assert "Track shipment" in html
    assert "order_status_url" in html


def test_abandoned_templates_use_shopify_email_objects() -> None:
    checkout = read("abandoned-checkout.html")
    cart = read("abandoned-cart.html")
    assert "abandoned_checkout.url" in checkout
    assert "abandoned_checkout_url" in checkout
    assert "abandoned_checkout.line_items" in checkout
    assert "abandoned_visit.url" in cart
    assert "cart_url" in cart
    assert "abandoned_visit.products_added_to_cart" in cart
    assert "first_name" in checkout
    assert "first_name" in cart


def test_account_templates_use_activation_and_account_url() -> None:
    invite = read("customer-account-invite.html")
    welcome = read("customer-account-welcome.html")
    assert "customer.account_activation_url" in invite
    assert "/account" in welcome


def test_layout_tables_marked_presentational() -> None:
    for name in PASTE_FILES:
        html = read(name)
        outer = re.findall(r"<table\b[^>]*>", html, flags=re.I)
        assert outer, name
        presentational = [tag for tag in outer if 'role="presentation"' in tag]
        assert presentational, name


def test_newsletter_forms_tag_welcome_offer() -> None:
    popup = (ROOT / "snippets/welcome-popup.liquid").read_text()
    newsletter = (ROOT / "sections/newsletter.liquid").read_text()
    banner = (ROOT / "sections/email-signup-banner.liquid").read_text()
    assert 'value="newsletter,welcome10"' in popup
    assert 'value="newsletter,welcome10"' in newsletter
    assert "welcome10" in banner
    assert "LMNYWELCOME" in popup
    assert "inbox" in popup.lower()


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
