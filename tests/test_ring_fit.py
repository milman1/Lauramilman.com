#!/usr/bin/env python3
"""Guard ring size help on product pages (snippets/ring-fit.liquid).

Rings get a Find your size dialog, a resizing note, and size fields that
ride the product form as line-item properties.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIT = ROOT / "snippets/ring-fit.liquid"


def section_schema(path: Path) -> dict:
    match = re.search(r"\{%-?\s*schema\s*-?%\}(.*?)\{%-?\s*endschema\s*-?%\}", path.read_text(), re.S)
    assert match, f"No schema in {path}"
    return json.loads(match.group(1))


def test_ring_fit_sits_inside_the_product_form_above_add_to_cart() -> None:
    # Inside the form so its properties reach Add to Cart and the diamond pairing.
    pdp = (ROOT / "sections/main-product.liquid").read_text()
    form_at = pdp.index("{%- form 'product'")
    fit_at = pdp.index("render 'ring-fit'")
    atc_at = pdp.index('id="PdpAtcRow"')
    end_at = pdp.index("{%- endform -%}")
    assert form_at < fit_at < atc_at < end_at


def test_ring_fit_is_switchable_in_the_product_section() -> None:
    ids = {s.get("id") for s in section_schema(ROOT / "sections/main-product.liquid")["settings"]}
    assert {"ring_fit_enabled", "ring_fit_ask_size"} <= ids


def test_guide_page_and_dialog_share_one_size_chart() -> None:
    assert "render 'ring-size-chart'" in (ROOT / "sections/size-guide.liquid").read_text()
    assert "render 'ring-size-chart'" in FIT.read_text()
    assert "<table" not in (ROOT / "sections/size-guide.liquid").read_text()


def test_unsure_note_is_off_until_ticked() -> None:
    # An enabled hidden field would put "Size check" on every ring order.
    fit = FIT.read_text()
    prop = re.search(r'<input type="hidden" name="properties\[Size check\]"[^>]*>', fit)
    assert prop and " disabled" in prop.group(0)
    assert "unsureProp.disabled = !unsure.checked" in fit


def test_one_size_rings_require_a_size_before_adding() -> None:
    # The size buttons fill one hidden property; it starts empty, and both
    # add paths stop until it has a value.
    fit = FIT.read_text()
    assert '<input type="hidden" name="properties[Ring size]" value="" data-fit-size-prop>' in fit
    assert "<select" not in fit
    assert "e.stopPropagation();" in fit.split("form.addEventListener('submit'")[-1]
    assert "closest('[data-pair-buy]') && missingSize()" in fit
    assert "}, true);" in fit  # capture phase, ahead of the pairing panel's own click handler


def test_condition_shows_only_on_vintage_pieces_and_watches() -> None:
    # "Condition: New" on a new house ring reads as a pre-owned listing.
    pdp = (ROOT / "sections/main-product.liquid").read_text()
    loop = pdp[pdp.index("for def in spec_defs"):pdp.index("endfor", pdp.index("for def in spec_defs"))]
    assert "render 'product-is-vintage'" in pdp
    assert "def_parts[0] == 'condition'" in loop
    assert "is_watch != 'true' and is_vintage != 'true'" in loop


def test_ring_fit_buttons_never_submit_the_product_form() -> None:
    fit = FIT.read_text()
    buttons = re.findall(r"<button\b[^>]*>", fit)
    assert buttons
    for tag in buttons:
        assert 'type="button"' in tag, tag


def test_estate_rings_never_promise_complimentary_resizing() -> None:
    fit = FIT.read_text()
    estate_branch = fit.index("{%- if estate -%}")
    complimentary = fit.index("One complimentary resizing included")
    # The complimentary note lives in the non-estate else branch of the same if.
    assert estate_branch < fit.index("{%- elsif no_resize != '' -%}") < complimentary
