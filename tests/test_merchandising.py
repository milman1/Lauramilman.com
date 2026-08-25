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
    assert data["order"][0:4] == ["hero", "trust-strip", "shop-worlds", "preowned-maison"]
    assert data["order"].index("shop-worlds") < data["order"].index("collections-grid")
    titles = [
        data["sections"]["shop-worlds"]["blocks"][block_id]["settings"]["title"]
        for block_id in data["sections"]["shop-worlds"]["block_order"]
    ]
    assert "Peaceful Diamonds" in titles
    assert "Pre-Owned Timepieces" in titles
    assert "Loose Diamonds" in titles


def test_header_nav_order_puts_differentiators_early() -> None:
    header = (ROOT / "sections/header.liquid").read_text()
    fine = header.index("            Fine Jewelry")
    diamonds = header.index("            Diamonds\n")
    peaceful = header.index("nav__item nav__item--peaceful")
    maison = header.index("estate_label")
    timepieces = header.index("            Timepieces\n")
    wedding = header.index("            Wedding\n")
    assert fine < diamonds < peaceful < maison < timepieces < wedding


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
    assert "grid-template-rows: 220px 1fr" in diamonds
    assert "aspect-ratio: 4 / 5" in maison
    assert "object-fit: cover" in maison
    image_box = theme_css.split(".collection-card__image-box {")[1].split("}")[0]
    assert "aspect-ratio: 4 / 5" in image_box
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
