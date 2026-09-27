#!/usr/bin/env python3
"""Guard the merchandising IA: women buying fine jewelry for themselves.

The homepage leads with gold and lab-grown diamonds under $2,500, then
Laura's story and signed estate as the next step. Loose diamonds, watches
and bridal stay one click away.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path) -> dict:
    text = path.read_text()
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return json.loads(text)


def extract_schema(path: Path) -> dict:
    text = path.read_text()
    match = re.search(r"\{%\s*schema\s*%\}(.*?)\{%\s*endschema\s*%\}", text, re.S)
    assert match, f"No schema in {path}"
    return json.loads(match.group(1))











def test_new_section_schemas_are_valid_json() -> None:
    worlds = extract_schema(ROOT / "sections/shop-worlds.liquid")
    diamonds = extract_schema(ROOT / "sections/diamond-destination.liquid")
    assert worlds["name"] == "Shop Worlds"
    assert diamonds["name"] == "Diamond Destination"
    setting_ids = {item["id"] for item in worlds["settings"]}
    assert {"eyebrow", "heading", "subheading"} <= setting_ids
    worlds_html = (ROOT / "sections/shop-worlds.liquid").read_text()
    assert "lm-worlds__rail" in worlds_html
    assert ".lm-worlds__rail" in worlds_html


def test_worlds_cards_stack_photo_above_text() -> None:
    """Titles sit in a band below the photo so they never overlap jewelry."""
    worlds = (ROOT / "sections/shop-worlds.liquid").read_text()
    assert "lm-worlds__info" in worlds
    assert "lm-worlds__overlay" not in worlds
    assert "flex-direction: column" in worlds
    assert "object-fit: cover" in worlds
    assert "padding: 16%" not in worlds
    assert "aspect-ratio: 3 / 4" not in worlds
    info_css = worlds.split(".lm-worlds__info")[1].split("@media")[0]
    assert "position: absolute" not in info_css
    assert "border-top" in info_css
    media_css = worlds.split(".lm-worlds__media {")[1].split("}")[0]
    assert "position: relative" in media_css
    assert "aspect-ratio: 1 / 1" in media_css
    assert "flex-basis: 46%" not in worlds
    assert "grid-template-columns: 1fr" in worlds


def test_related_merchandising_photos_fill_their_frames() -> None:
    diamonds = (ROOT / "sections/diamond-destination.liquid").read_text()
    maison = (ROOT / "sections/preowned-maison.liquid").read_text()
    theme_css = (ROOT / "assets/theme.css").read_text()
    assert "object-fit: cover" in diamonds
    assert "grid-template-rows: auto 1fr" in diamonds
    assert "aspect-ratio: 16 / 9" in diamonds
    for asset in [
        "diamond-destination-natural.webp",
        "diamond-destination-lab.webp",
    ]:
        assert asset in diamonds
        assert (ROOT / "assets" / asset).exists()
    assert "aspect-ratio: 4 / 5" in maison
    assert "object-fit: cover" in maison
    image_box = theme_css.split(".collection-card__image-box {")[1].split("}")[0]
    assert "aspect-ratio: 1 / 1" in image_box
    image_css = theme_css.split(".collection-card__image-box img")[1][:250]
    assert "object-fit: cover" in image_css




def test_diamond_filter_offers_lab_and_natural_origin() -> None:
    liquid = (ROOT / "sections/diamond-filter.liquid").read_text()
    assert 'aria-label="Diamond origin"' in liquid
    assert 'href="/collections/lab-grown-diamonds"' in liquid
    assert 'href="/collections/natural-diamonds"' in liquid
    assert "lm-dfilter__origin" in liquid
    assert "overflow: hidden" in liquid
    storefront = (ROOT / "assets/diamond-storefront.js").read_text()
    assert "Math.min(100" in storefront
    assert "data-add-handle" in storefront
    assert "data-buy-handle" in storefront
    pdp = (ROOT / "sections/main-product-diamond.liquid").read_text()
    assert "data-buy-now" in pdp
    assert "Buy now" in pdp
    theme_js = (ROOT / "assets/theme.js").read_text()
    assert "window.lmAddToCart" in theme_js
    assert "/checkout" in theme_js


def test_refine_drawer_hides_mismatched_and_low_value_filters() -> None:
    drawer = (ROOT / "snippets/filter-drawer.liquid").read_text()
    assert "fd_is_watch" in drawer
    assert "fd_is_estate" in drawer
    assert "diamond shape" in drawer
    assert "useful_values" in drawer
    collection = (ROOT / "sections/main-collection.liquid").read_text()
    assert "Shop by brand" in collection
    assert "/collections/rolex-watches" in collection


def test_only_shopify_inbox_chat_is_rendered() -> None:
    layout = (ROOT / "layout/theme.liquid").read_text()
    settings = load_json(ROOT / "config/settings_data.json")
    assert "render 'chat-widget'" not in layout
    app_blocks = settings["current"]["blocks"].values()
    inbox_blocks = [
        block
        for block in app_blocks
        if "shopify://apps/inbox/blocks/chat/" in block["type"]
    ]
    assert inbox_blocks
    assert inbox_blocks[0]["settings"]["show_featured_products"] is False
    theme_js = (ROOT / "assets/theme.js").read_text()
    assert "querySelector('shopify-chat')" in theme_js
    assert "host.show" in theme_js
    assert "inbox-online-store-chat" in theme_js
    assert "dummy-chat-button" in theme_js
    assert "window.lmChat" in theme_js
    assert "js-open-product-chat" in theme_js
    assert "productTitle" in theme_js
    assert "I'm looking at" in theme_js
    assert "getElementById('chat-trigger')" not in theme_js
    assert "showFeaturedProducts = false" in layout
    assert "shopify-chat-app-embed-data" in layout
    inquiry = (ROOT / "snippets/product-inquiry.liquid").read_text()
    assert "js-open-product-chat" in inquiry
    assert "Make an offer" in inquiry
    assert "Direct message" in inquiry
    assert "Ask about this piece" in inquiry
    assert "lmChat.open" in inquiry
    assert "chat-trigger" not in inquiry
    assert "Hold this piece" not in inquiry
    assert "piece-hold" not in inquiry
    assert "data-product-id=" in inquiry
    assert inquiry.count("js-open-product-chat") >= 3
    assert "lm-chat-piece" in theme_js
    assert "brandJacobCo" in theme_js
    assert "Jacob & Co." in (ROOT / "snippets/jacob-co-name.liquid").read_text()
    assert "display_title" in inquiry
    main_product = (ROOT / "sections/main-product.liquid").read_text()
    assert "assign display_title" in main_product
    assert '<h1 class="product-title">{{ display_title }}</h1>' in main_product
    consult = (ROOT / "sections/private-client.liquid").read_text()
    assert "interest === 'jewelry'" in consult
    assert "Fine jewelry" in consult


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


def strip_liquid_comments(text: str) -> str:
    return re.sub(r"\{%-?\s*comment\s*-?%\}.*?\{%-?\s*endcomment\s*-?%\}", "", text, flags=re.S)


def test_homepage_leads_with_the_self_purchase_edit() -> None:
    data = load_json(ROOT / "templates/index.json")
    order = data["order"]
    assert order[:4] == ["hero", "trust-strip", "first-piece", "build-the-stack"]
    assert order.index("brand-story") < order.index("estate")
    assert order.index("estate") < order.index("also-from-the-house")
    assert data["sections"]["first-piece"]["settings"]["collection"] == "under-2500"
    for removed in ("testimonials", "closing-cta", "philosophy-quote", "diamond-destination"):
        assert all(section["type"] != removed for section in data["sections"].values())


def test_hero_speaks_to_women_buying_for_themselves() -> None:
    hero = load_json(ROOT / "templates/index.json")["sections"]["hero"]["settings"]
    assert hero["layout"] == "split"
    assert "for yourself" in hero["heading"]
    assert hero["primary_cta_url"] == "/collections/under-2500"
    assert (ROOT / "assets" / hero["image_asset"]).exists()
    liquid = (ROOT / "sections/hero.liquid").read_text()
    assert "lm-hero--split" in liquid


def test_estate_links_use_the_single_estate_hub() -> None:
    for path in ("sections/header.liquid", "sections/footer.liquid", "templates/index.json", "snippets/breadcrumbs.liquid"):
        text = (ROOT / path).read_text()
        assert "/collections/vintage-jewelry" not in text, path
        assert "estate-jewelry" in text, path
    for path in ("sections/header.liquid", "sections/footer.liquid", "templates/index.json"):
        assert "Pre-Owned Maison" not in (ROOT / path).read_text(), path


def test_category_links_use_rule_based_collections() -> None:
    header = (ROOT / "sections/header.liquid").read_text()
    collection = (ROOT / "sections/main-collection.liquid").read_text()
    for handle in ("all-earrings", "all-bracelets", "all-pendants"):
        assert f'href="/collections/{handle}"' in header
        assert f'href="/collections/{handle}"' in collection
    for stale in ('href="/collections/earrings"', 'href="/collections/bracelets"', 'href="/collections/pendants-1"'):
        assert stale not in header
        assert stale not in collection


def test_header_nav_leads_with_price_and_keeps_watches_one_click_away() -> None:
    header = strip_liquid_comments((ROOT / "sections/header.liquid").read_text())
    under = header.index('href="/collections/under-2500" class="nav__item-link"')
    jewelry = header.index("            Jewelry\n")
    lab = header.index("nav__item nav__item--peaceful")
    estate = header.index("estate_label")
    story = header.index('href="/pages/about" class="nav__item-link"')
    more = header.index("nav__item nav__item--end")
    assert under < jewelry < lab < estate < story < more
    more_panel = header[more:]
    for href in ("/collections/natural-diamonds", "/collections/time-pieces", "/collections/jacob-co", "/collections/engagement-rings", "/blogs/journal"):
        assert f'href="{href}"' in more_panel


def test_all_jewelry_is_a_real_paginated_collection() -> None:
    liquid = (ROOT / "sections/main-collection.liquid").read_text()
    assert "jewelry_handles" not in liquid
    assert "shown_count" not in liquid
    assert "{%- if paginate.pages > 1 -%}" in liquid


def test_watch_pages_get_watch_education() -> None:
    liquid = (ROOT / "sections/product-education.liquid").read_text()
    assert "product-is-watch" in liquid
    assert "watch_point" in liquid
    template = load_json(ROOT / "templates/product.json")
    types = [block["type"] for block in template["sections"]["education"]["blocks"].values()]
    assert types.count("watch_point") == 3


def test_storefront_never_names_suppliers() -> None:
    pattern = re.compile(r"royal.?chain|back.?vault|belgium ?dia\b|robinson'?s jewel|bucherer|exquisite timepieces", re.I)
    paths = list((ROOT / "sections").glob("*.liquid")) + list((ROOT / "snippets").glob("*.liquid"))
    paths += list((ROOT / "templates").glob("*.json")) + [ROOT / "layout/theme.liquid", ROOT / "config/settings_data.json"]
    for path in paths:
        if path.name == "ebay-default.liquid":
            continue
        text = strip_liquid_comments(path.read_text())
        assert not pattern.search(text), path.name


def test_header_menus_work_with_a_keyboard() -> None:
    header = (ROOT / "sections/header.liquid").read_text()
    layout = (ROOT / "layout/theme.liquid").read_text()
    assert '<span class="nav__item-link' not in header
    assert 'aria-expanded="false" class="nav__item-link' in header
    assert ".nav__item:focus-within .nav__dropdown" in header
    assert 'href="#MainContent"' in layout

