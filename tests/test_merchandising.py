#!/usr/bin/env python3
"""Guard the merchandising IA: worlds first, jewelry types second."""

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


def test_homepage_leads_with_worlds_not_jewelry_types() -> None:
    data = load_json(ROOT / "templates/index.json")
    order = data["order"]
    assert order[:6] == [
        "hero",
        "trust-strip",
        "shop-worlds",
        "preowned-maison",
        "diamond-destination",
        "preowned-timepieces",
    ]
    assert order.index("peaceful-diamonds") < order.index("collections-grid")
    assert order.index("shop-worlds") < order.index("collections-grid")


def test_shop_worlds_cover_the_five_business_lines() -> None:
    data = load_json(ROOT / "templates/index.json")
    worlds = data["sections"]["shop-worlds"]
    titles = [
        worlds["blocks"][block_id]["settings"]["title"]
        for block_id in worlds["block_order"]
    ]
    assert titles == [
        "Peaceful Diamonds",
        "Loose Diamonds",
        "Pre-Owned Maison",
        "Pre-Owned Timepieces",
        "Fine Jewelry",
    ]


def test_diamond_destination_splits_natural_and_lab() -> None:
    data = load_json(ROOT / "templates/index.json")
    dest = data["sections"]["diamond-destination"]
    titles = [
        dest["blocks"][block_id]["settings"]["title"]
        for block_id in dest["block_order"]
    ]
    assert titles == ["Natural Loose Diamonds", "Lab-Grown Loose Diamonds"]
    assert dest["blocks"]["dest-natural"]["settings"]["collection"] == "natural-diamonds"
    assert dest["blocks"]["dest-lab"]["settings"]["collection"] == "lab-grown-diamonds"


def test_timepieces_use_watch_only_collections() -> None:
    data = load_json(ROOT / "templates/index.json")
    watches = data["sections"]["preowned-timepieces"]
    handles = [
        watches["blocks"][block_id]["settings"]["collection"]
        for block_id in watches["block_order"]
    ]
    assert handles == [
        "rolex-watches",
        "cartier-watches",
        "audemars-piguet-watches",
        "bvlgari-watches",
    ]
    assert all(handle.endswith("-watches") for handle in handles)


def test_jewelry_type_grid_is_secondary_and_uses_title_override() -> None:
    data = load_json(ROOT / "templates/index.json")
    grid = data["sections"]["collections-grid"]
    assert grid["settings"]["title"] == "Necklaces, Rings & More"
    assert grid["settings"]["eyebrow"] == "Shop by Jewelry Type"
    handles = [
        grid["blocks"][block_id]["settings"]["collection"]
        for block_id in grid["block_order"]
    ]
    assert handles == ["necklaces", "rings", "bracelets", "pendants-1", "earrings"]
    assert grid["blocks"]["cat-pendants"]["settings"]["title"] == "Pendants"
    liquid = (ROOT / "sections/collections-grid.liquid").read_text()
    assert "block.settings.title | default: collection.title" in liquid


def test_shop_page_mirrors_worlds_first() -> None:
    data = load_json(ROOT / "templates/page.shop.json")
    order = data["order"]
    assert order[:8] == [
        "hero",
        "trust-strip",
        "shop-worlds",
        "preowned-maison",
        "diamond-destination",
        "preowned-timepieces",
        "peaceful-diamonds",
        "collections-grid",
    ]
    assert order.index("shop-worlds") < order.index("collections-grid")
    titles = [
        data["sections"]["shop-worlds"]["blocks"][block_id]["settings"]["title"]
        for block_id in data["sections"]["shop-worlds"]["block_order"]
    ]
    assert titles == [
        "Peaceful Diamonds",
        "Loose Diamonds",
        "Pre-Owned Maison",
        "Pre-Owned Timepieces",
        "Fine Jewelry",
    ]
    tones = [
        data["sections"]["shop-worlds"]["blocks"][block_id]["settings"]["tone"]
        for block_id in data["sections"]["shop-worlds"]["block_order"]
    ]
    assert tones == ["navy", "warm", "warm", "warm", "warm"]
    dest = data["sections"]["diamond-destination"]
    assert dest["blocks"]["dest-natural"]["settings"]["collection"] == "natural-diamonds"
    assert dest["blocks"]["dest-lab"]["settings"]["collection"] == "lab-grown-diamonds"
    watches = [
        data["sections"]["preowned-timepieces"]["blocks"][block_id]["settings"]["collection"]
        for block_id in data["sections"]["preowned-timepieces"]["block_order"]
    ]
    assert "jacob-co" in watches
    assert "rolex-watches" in watches
    hero = data["sections"]["hero"]["settings"]
    assert hero["primary_cta_text"] == "Shop Fine Jewelry"
    assert hero["secondary_cta_url"] == "/collections/natural-diamonds"
    grid = data["sections"]["collections-grid"]
    assert grid["settings"]["title"] == "Necklaces, Rings & More"
    handles = [
        grid["blocks"][block_id]["settings"]["collection"]
        for block_id in grid["block_order"]
    ]
    assert handles == ["necklaces", "rings", "bracelets", "pendants-1", "earrings"]
    pd = data["sections"]["peaceful-diamonds"]
    assert "Certified lab-grown diamonds" in pd["settings"]["description"]
    assert "pd-point-1" in pd["block_order"]
    liquid = (ROOT / "sections/collections-grid.liquid").read_text()
    assert "collection-card__cta" in liquid
    assert ">Explore<" in liquid


def test_header_nav_order_puts_differentiators_early() -> None:
    header = (ROOT / "sections/header.liquid").read_text()
    fine = header.index("            Fine Jewelry")
    diamonds = header.index("            Diamonds\n")
    peaceful = header.index("nav__item nav__item--peaceful")
    maison = header.index("estate_label")
    timepieces = header.index("            Timepieces\n")
    wedding = header.index("            Wedding\n")
    assert fine < diamonds < peaceful < maison < timepieces < wedding


def test_timepieces_navigation_includes_jacob_and_co() -> None:
    header = (ROOT / "sections/header.liquid").read_text()
    collection = (ROOT / "sections/main-collection.liquid").read_text()
    jacob_link = 'href="/collections/jacob-co"'
    assert jacob_link in header
    assert "Jacob &amp; Co." in header
    assert jacob_link in collection
    assert "Jacob &amp; Co." in collection
    # Keep Jacob with the lead brands so it is not clipped under Other Brands.
    assert header.index('href="/collections/cartier-watches"') < header.index(jacob_link)
    assert header.index(jacob_link) < header.index('href="/collections/other-watch-brands"')
    assert "max-height: 500px" not in header
    assert collection.index('href="/collections/cartier-watches"') < collection.index(jacob_link)


def test_footer_and_search_surface_the_worlds() -> None:
    footer = (ROOT / "sections/footer.liquid").read_text()
    assert 'href="/collections/natural-diamonds"' in footer
    assert 'href="/collections/time-pieces"' in footer
    assert ">Fine Jewelry<" in footer
    header = (ROOT / "sections/header.liquid").read_text()
    assert ">Loose Diamonds<" in header
    assert ">Peaceful Diamonds<" in header
    popular = (ROOT / "sections/popular-searches.liquid").read_text()
    assert "Peaceful Diamonds" in popular
    assert "Loose Diamonds" in popular
    assert "Timepieces" in popular


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


def test_hero_copy_names_the_full_assortment() -> None:
    data = load_json(ROOT / "templates/index.json")
    sub = data["sections"]["hero"]["settings"]["subheading"].lower()
    assert "diamond" in sub
    assert "maison" in sub
    assert "timepiece" in sub
    assert data["sections"]["hero"]["settings"]["primary_cta_text"] == "Shop Fine Jewelry"
    assert data["sections"]["hero"]["settings"]["secondary_cta_url"] == "/collections/natural-diamonds"


def test_worlds_cards_use_category_images_and_theme_tones() -> None:
    worlds = (ROOT / "sections/shop-worlds.liquid").read_text()
    generated_assets = [
        "shop-world-loose-diamonds.webp",
        "shop-world-preowned-maison.webp",
        "shop-world-preowned-timepieces.webp",
        "shop-world-fine-jewelry.webp",
    ]
    for asset in generated_assets:
        assert asset in worlds
        assert (ROOT / "assets" / asset).exists()

    data = load_json(ROOT / "templates/index.json")
    tones = [
        data["sections"]["shop-worlds"]["blocks"][block_id]["settings"]["tone"]
        for block_id in data["sections"]["shop-worlds"]["block_order"]
    ]
    assert tones == ["navy", "warm", "warm", "warm", "warm"]
    warm_css = worlds.split(".lm-worlds__card {")[1].split("}")[0]
    assert "cream" in warm_css
    assert "navy-deep" not in warm_css


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
