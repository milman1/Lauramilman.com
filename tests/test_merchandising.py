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
    chips = (ROOT / "snippets/watch-brand-chips.liquid").read_text()
    jacob_link = 'href="/collections/jacob-co"'
    assert jacob_link in header
    assert "Jacob &amp; Co." in header
    assert jacob_link in chips
    assert "Jacob &amp; Co." in chips
    # Keep Jacob with the lead brands so it is not clipped under Other Brands.
    assert header.index('href="/collections/cartier-watches"') < header.index(jacob_link)
    assert header.index(jacob_link) < header.index('href="/collections/other-watch-brands"')
    assert "max-height: 500px" not in header
    assert chips.index('href="/collections/cartier-watches"') < chips.index(jacob_link)


def test_watch_brand_pages_link_back_to_all_timepieces() -> None:
    chips = (ROOT / "snippets/watch-brand-chips.liquid").read_text()
    collection = (ROOT / "sections/main-collection.liquid").read_text()
    assert 'href="/collections/time-pieces"' in chips
    assert "All Timepieces" in chips
    assert "watch-brand-chips" in collection
    assert "lm-watch-nav" in chips
    assert "lm-watch-nav" in collection


def test_mobile_popular_searches_are_sticky() -> None:
    popular = (ROOT / "sections/popular-searches.liquid").read_text()
    mobile = popular.split("@media (max-width: 768px)")[1]
    assert "position: sticky" in mobile
    assert "var(--header-height" in mobile


def test_fine_jewelry_mixes_lab_grown_collections() -> None:
    collection = (ROOT / "sections/main-collection.liquid").read_text()
    mix = (ROOT / "snippets/collection-mix-lab.liquid").read_text()
    assert "lab-grown-rings" in collection
    assert "lab-grown-necklaces" in collection
    assert "lab-grown-bracelets" in collection
    assert "lab-grown-earrings" in collection
    assert "lab-grown-pendants" in collection
    assert "lab-grown-engagement-rings" in collection
    assert "collection-mix-lab" in collection
    assert "peaceful-diamonds-by-laura-milman-new-york" in mix
    assert "Peaceful Diamonds remains the dedicated lab-grown home" in collection
    header = (ROOT / "sections/header.liquid").read_text()
    fine_block = header.split("All Fine Jewelry")[1].split("Loose stones")[0]
    assert "lab-grown-rings" not in fine_block


def test_diamond_grade_scale_selects_individual_grades() -> None:
    storefront = (ROOT / "assets/diamond-storefront.js").read_text()
    facet = (ROOT / "sections/diamond-filter.liquid").read_text()
    scale = (ROOT / "snippets/diamond-grade-scale.liquid").read_text()
    assert "VS2 means VS2, not VS2 and better" in storefront
    assert "Click VS2 to select VS2 only" in facet
    assert 'addEventListener("change", paint)' in storefront.replace("'", '"')
    assert "preventDefault" not in storefront.split("function wireScales")[1].split("function wireShapes")[0]
    assert "event.preventDefault()" not in facet.split("Grade scales are independent")[1].split("Shape tiles")[0]
    assert "VS2 and better" in scale
    assert "relaxing a grade by one step" not in facet



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
    chips = (ROOT / "snippets/watch-brand-chips.liquid").read_text()
    assert "Shop by brand" in chips
    assert "/collections/rolex-watches" in chips
    assert "watch-brand-chips" in collection


def test_gemological_filters_live_only_on_loose_diamonds() -> None:
    """Clarity / shape / GIA color / cut are loose-diamond 4Cs, not jewelry."""
    drawer = (ROOT / "snippets/filter-drawer.liquid").read_text()
    diamonds = (ROOT / "sections/diamond-filter.liquid").read_text()
    jewelry_templates = (ROOT / "templates/collection.json").read_text()
    diamond_templates = (ROOT / "templates/collection.diamonds.json").read_text()
    lab_templates = (ROOT / "templates/collection.diamonds-lab.json").read_text()

    assert 'title: \'Clarity\'' in diamonds or "title: 'Clarity'" in diamonds
    assert "type: diamond-filter" in diamond_templates.replace('"', "")
    assert "diamond-filter" in lab_templates
    assert "diamond-filter" not in jewelry_templates

    skip_block = drawer.split("Shape / color / clarity / cut belong on loose diamonds only.")[1].split(
        "fd_is_watch"
    )[0]
    for needle in ("clarity", "diamond shape", "cut grade", "'color'", "'colour'"):
        assert needle in skip_block

    assert "natural-diamonds or lab-grown-diamonds" in drawer



def test_only_shopify_inbox_chat_is_rendered() -> None:
    layout = (ROOT / "layout/theme.liquid").read_text()
    settings = load_json(ROOT / "config/settings_data.json")
    assert "render 'chat-widget'" not in layout
    app_blocks = settings["current"]["blocks"].values()
    assert any("shopify://apps/inbox/blocks/chat/" in block["type"] for block in app_blocks)
    theme_js = (ROOT / "assets/theme.js").read_text()
    assert "querySelector('shopify-chat')" in theme_js
    assert "host.show" in theme_js
    assert "inbox-online-store-chat" in theme_js
    assert "dummy-chat-button" in theme_js
    assert "window.lmChat" in theme_js
    assert "js-open-product-chat" in theme_js
    assert "getElementById('chat-trigger')" not in theme_js
    inquiry = (ROOT / "snippets/product-inquiry.liquid").read_text()
    assert "js-open-product-chat" in inquiry
    assert "Make an offer" in inquiry
    assert "lmChat.open" in inquiry
    assert "chat-trigger" not in inquiry


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
