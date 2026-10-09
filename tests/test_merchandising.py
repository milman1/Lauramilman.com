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


def test_homepage_walks_gold_and_diamonds_before_watches() -> None:
    """Loose diamonds and settings lead, then gold; watches and signed jewelry sit lower."""
    data = load_json(ROOT / "templates/index.json")
    order = data["order"]
    sections = data["sections"]
    assert order == [
        "hero", "spotlight", "gold", "worlds", "trust-strip", "lab-grown", "loose-diamonds",
        "private-clients", "engagement", "wear-together", "pre-owned",
        "brand-story", "reviews",
    ]
    types = {key: sections[key]["type"] for key in order}
    assert types["hero"] == "lmh-hero"
    assert types["spotlight"] == "lmh-spotlight"
    assert types["worlds"] == "lmh-worlds"
    assert types["gold"] == types["lab-grown"] == "lmh-product-row"
    assert types["wear-together"] == "lmh-wear-together"
    assert types["pre-owned"] == "lmh-preowned"
    assert types["loose-diamonds"] == "lmh-diamond-choice"
    assert types["private-clients"] == "lmh-private-band"
    assert types["engagement"] == "lmh-engagement"
    # The gold row fills from the Gold Jewelry collection.
    assert sections["gold"]["settings"]["collection"] == "gold-jewelry"
    assert sections["gold"]["settings"]["all_url"] == "/collections/gold-jewelry"
    chips = [b for b in sections["gold"]["blocks"].values() if b["type"] == "chip"]
    assert len(chips) >= 4
    # No price-capped edit on the homepage: the house is not sold as "under $2,500".
    text = (ROOT / "templates/index.json").read_text()
    assert "under-2500" not in text
    for removed in ("testimonials", "closing-cta", "philosophy-quote", "diamond-destination", "collections-grid", "newsletter"):
        assert all(section["type"] != removed for section in sections.values())
    # Watch copy states only what the listing record confirms.
    assert "Timepieces, authenticated" not in text
    assert "lmny-rope-1-8-mm-ch014" not in text
    # The signup the preview puts in the footer is there.
    assert "form 'customer'" in (ROOT / "sections/footer.liquid").read_text()

def test_hero_is_the_split_layout() -> None:
    hero = load_json(ROOT / "templates/index.json")["sections"]["hero"]
    settings = hero["settings"]
    assert hero["type"] == "lmh-hero"
    assert settings["title_emphasis"]
    assert settings["primary_url"] == "/collections/lab-grown-diamonds"
    assert settings["secondary_url"] == "/collections/ring-settings"
    assert (ROOT / "assets" / settings["image_asset"]).exists()
    # Phones get the preview's pills under the header.
    pills = [b["settings"]["text"] for b in hero["blocks"].values() if b["type"] == "pill"]
    assert pills[:4] == ["Loose Diamonds", "Ring Settings", "Gold Jewelry", "High Jewelry"]
    liquid = (ROOT / "sections/lmh-hero.liquid").read_text()
    assert "lmh-hero__media" in liquid


def test_homepage_theme_images_exist() -> None:
    data = load_json(ROOT / "templates/index.json")
    keys = ("image_asset", "editorial_asset", "lab_image_asset", "natural_image_asset")
    for section in data["sections"].values():
        assets = [section.get("settings", {}).get(k) for k in keys]
        assets += [b.get("settings", {}).get("image_asset") for b in section.get("blocks", {}).values()]
        for name in filter(None, assets):
            assert (ROOT / "assets" / name).exists(), name


def test_diamond_feature_shapes_deep_link_into_the_search() -> None:
    liquid = (ROOT / "sections/diamond-feature.liquid").read_text()
    assert "?shape={{ shape }}" in liquid
    assert "render 'diamond-shape-icon'" in liquid
    js = (ROOT / "assets/diamond-storefront.js").read_text()
    assert "function hydrateShapesFromURL()" in js
    assert js.index("hydrateShapesFromURL();") < js.index("wireShapes();")


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


def test_header_nav_names_what_the_house_sells() -> None:
    header = strip_liquid_comments((ROOT / "sections/header.liquid").read_text())
    assert "/collections/under-2500" not in header
    gold = header.index('class="nav__item-link">Gold Jewelry')
    preowned = header.index("estate_label")
    lab = header.index("nav__item nav__item--peaceful")
    natural = header.index('class="nav__item-link">Natural Diamonds')
    story = header.index('href="/pages/about" class="nav__item-link"')
    high = header.index('class="nav__item-link">High Jewelry')
    # Lab-grown (loose stones and settings) leads, then gold and high jewelry.
    assert lab < gold < high < preowned < natural < story
    assert 'href="/collections/high-jewelry"' in header
    assert 'href="/collections/ring-settings"' in header
    # Gold links fall back to chains until gold-jewelry has pieces in it.
    assert "collections['gold-jewelry'].products_count > 0" in header
    assert header.count('<span class="nav__dropdown-label">Most popular') >= 3
    # The preview's cream header: wordmark set in type, appointment links at left.
    assert 'class="lmhh__word">Laura <em>Milman</em>' in header
    assert 'href="/pages/private-clients">Book an Appointment' in header
    for href in (
        "/collections/chains?type=Cuban",
        "/collections/stackable-rings",
        "/collections/rolex-watches",
        "/collections/bvlgari-watches",
        "/collections/time-pieces",
        "/collections/estate-jewelry",
        "/collections/lab-grown-diamonds?shape=Oval",
        "/collections/natural-diamonds?shape=Round",
        "/collections/engagement-rings",
        "/pages/ring-builder",
    ):
        assert f'href="{href}"' in header, href
    # The old dark bar's logo overrides are gone from the theme settings.
    settings = load_json(ROOT / "config/settings_data.json")["current"]["sections"]
    assert "custom_css" not in settings["header"]

def test_new_gold_collections_get_style_filters() -> None:
    bar = (ROOT / "snippets/jewelry-style-bar.liquid").read_text()
    filters = (ROOT / "snippets/jewelry-style-filters.liquid").read_text()
    drawer = (ROOT / "snippets/filter-drawer.liquid").read_text()
    for handle in ("chain-bracelets", "chain-necklaces"):
        assert f"'{handle}'" in bar, handle
    for handle in ("gold-jewelry", "chain-bracelets", "chain-necklaces"):
        assert f"'{handle}'" in filters, handle
        assert f"'{handle}'" in drawer, handle


def test_high_jewelry_pages_use_piece_and_color_chips() -> None:
    liquid = (ROOT / "sections/main-collection.liquid").read_text()
    assert "hj_page == false and section.blocks.size > 0" in liquid
    for handle in ("high-jewelry-rings", "high-jewelry-earrings", "high-jewelry-bracelets",
                   "high-jewelry-necklaces", "fancy-yellow-diamonds", "fancy-pink-diamonds",
                   "fancy-green-diamonds"):
        assert f"{handle}::" in liquid, handle


def test_gold_pages_use_gold_chips_not_budget_row() -> None:
    bar = (ROOT / "snippets/jewelry-style-bar.liquid").read_text()
    liquid = (ROOT / "sections/main-collection.liquid").read_text()
    assert "'gold-jewelry'" not in bar
    assert "gold_page == false and hj_page == false and section.blocks.size > 0" in liquid
    for handle in ("gold-chains", "gold-bracelets", "gold-rings", "first-gold-piece"):
        assert f'href="/collections/{handle}"' in liquid, handle


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



def test_product_schema_carries_offers_shipping_returns_and_specs() -> None:
    snippet = (ROOT / "snippets/structured-data-product.liquid").read_text()
    assert "for variant in product.variants" in snippet
    assert '"shippingDetails"' in snippet
    assert "MerchantReturnFiniteReturnWindow" in snippet
    assert "MerchantReturnNotPermitted" in snippet  # watches: exchange only
    assert '"additionalProperty"' in snippet
    # Loose diamonds can be final sale, so they get no return policy.
    assert "schema_is_loose == false" in snippet


def test_organization_schema_names_the_founder_and_address() -> None:
    layout = (ROOT / "layout/theme.liquid").read_text()
    assert '"founder"' in layout and "Laura Milman" in layout
    assert "1185 6th Avenue" in layout
    assert "shop.brand.logo" in layout
    article = (ROOT / "sections/main-article.liquid").read_text()
    assert "article.author == shop.name" in article


def test_reviews_are_branded_cards_of_real_reviews_only() -> None:
    sections = load_json(ROOT / "templates/index.json")["sections"]
    review_sections = [s for s in sections.values() if s["type"] in ("lmh-reviews", "client-reviews", "google-reviews-strip")]
    # One reviews section on the homepage: never both, never neither.
    assert len(review_sections) == 1
    # The live Google widget shows reviews word for word; branded cards stay
    # hidden until a real review is entered.
    assert "sk-ww-google-reviews" in (ROOT / "sections/lmh-reviews.liquid").read_text()
    liquid = (ROOT / "sections/client-reviews.liquid").read_text()
    assert "{%- if cr_count > 0 -%}" in liquid
    assert "sociablekit" not in liquid
    assert not (ROOT / "sections/testimonials.liquid").exists()
    for path in ("templates/index.json", "templates/page.shop.json"):
        text = (ROOT / path).read_text()
        for invented in ("Alexandra K.", "Catherine M.", "Victoria S."):
            assert invented not in text, (path, invented)


def test_lab_grown_rail_mixes_categories_in_a_carousel() -> None:
    lab = load_json(ROOT / "templates/index.json")["sections"]["lab-grown"]
    assert lab["settings"]["style"] == "navy"
    handles = [b["settings"]["product"] for b in lab["blocks"].values() if b["type"] == "product"]
    assert len(handles) >= 4
    for kind in ("earrings", "bracelet", "necklace"):
        assert any(kind in h for h in handles), kind
    # Cards scroll sideways on phones.
    assert "lmh-scroll" in (ROOT / "sections/lmh-product-row.liquid").read_text()


def test_section_schemas_pass_shopify_upload_rules() -> None:
    # Shopify rejects a section on upload when a url setting defaults to
    # anything but /collections or /collections/all, and then rejects every
    # template that uses it.
    for path in sorted((ROOT / "sections").glob("*.liquid")):
        match = re.search(r"\{%-?\s*schema\s*-?%\}(.*?)\{%-?\s*endschema\s*-?%\}", path.read_text(), re.S)
        if not match:
            continue
        schema = json.loads(match.group(1))
        settings = list(schema.get("settings", [])) + [s for b in schema.get("blocks", []) for s in b.get("settings", [])]
        for setting in settings:
            if setting.get("type") == "url" and "default" in setting:
                assert setting["default"] in ("/collections", "/collections/all"), (path.name, setting["id"])


def test_homepage_pairs_watches_with_signed_jewelry() -> None:
    data = load_json(ROOT / "templates/index.json")
    order = data["order"]
    pre = data["sections"]["pre-owned"]
    assert order.index("lab-grown") < order.index("wear-together") < order.index("pre-owned")
    blocks = list(pre["blocks"].values())
    watch_chips = [b["settings"]["text"] for b in blocks if b["type"] == "watch_chip"]
    jewelry_chips = [b["settings"]["text"] for b in blocks if b["type"] == "jewelry_chip"]
    assert {"Rolex", "Cartier"} <= set(watch_chips)
    assert {"Cartier", "Van Cleef & Arpels"} <= set(jewelry_chips)
    assert sum(b["type"] == "watch_product" for b in blocks) == 4
    assert sum(b["type"] == "jewelry_product" for b in blocks) == 4
    # Brand chips point at real collections, not query strings the theme ignores.
    for b in blocks:
        if b["type"].endswith("_chip"):
            assert "?" not in b["settings"]["url"], b["settings"]["url"]

def test_lab_grown_collection_uses_the_clean_handle() -> None:
    for path in (
        "sections/header.liquid",
        "sections/footer.liquid",
        "sections/main-collection.liquid",
        "sections/popular-searches.liquid",
        "sections/page-about.liquid",
        "snippets/breadcrumbs.liquid",
        "snippets/collection-guide.liquid",
        "snippets/filter-drawer.liquid",
        "snippets/jewelry-style-bar.liquid",
        "snippets/jewelry-style-filters.liquid",
        "templates/index.json",
        "templates/list-collections.json",
        "templates/page.google-reviews.liquid",
        "templates/page.shop.json",
        "layout/theme.liquid",
    ):
        text = (ROOT / path).read_text()
        assert "peaceful-diamonds-by-laura-milman-new-york" not in text, path
    assert (ROOT / "templates/collection.lab-grown.json").exists()
    assert (ROOT / "templates/collection.lab-grown-category.json").exists()
    assert not (ROOT / "templates/collection.peaceful.json").exists()
    assert not (ROOT / "templates/collection.peaceful-category.json").exists()


def test_lab_grown_sections_are_not_merchant_labeled_peaceful() -> None:
    hero_schema = extract_schema(ROOT / "sections/lab-grown-hero.liquid")
    assert hero_schema["name"] == "Lab-Grown Hero"
    feature_schema = extract_schema(ROOT / "sections/lab-grown-diamonds-feature.liquid")
    assert feature_schema["name"] == "Lab-Grown Diamonds Feature"
    assert not (ROOT / "sections/peaceful-hero.liquid").exists()
    assert not (ROOT / "sections/peaceful-diamonds.liquid").exists()
