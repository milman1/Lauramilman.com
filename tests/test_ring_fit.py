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


def _chart_rows() -> list[list[str]]:
    text = (ROOT / "snippets/ring-size-chart.liquid").read_text()
    start = text.index("{%- capture size_data -%}")
    end = text.index("{%- endcapture -%}", start)
    block = text[start:end].split("size_data -%}", 1)[1]
    rows = []
    for part in block.split("||"):
        line = part.strip()
        if "|" not in line:
            continue
        cells = line.split("|")
        assert len(cells) == 9, line
        rows.append(cells)
    return rows


def test_size_chart_keeps_the_house_half_sizes_and_converts() -> None:
    """Half sizes stay the numbers already on the product page. Quarter
    sizes and country columns are the trade chart, with inches = mm / 25.4.
    """
    rows = _chart_rows()
    assert len(rows) == 41
    by_size = {cells[0]: cells for cells in rows}
    house = {
        "3": ("14.1", "44.2"),
        "3.5": ("14.5", "45.5"),
        "4": ("14.9", "46.8"),
        "4.5": ("15.3", "48.0"),
        "5": ("15.7", "49.3"),
        "5.5": ("16.1", "50.6"),
        "6": ("16.5", "51.9"),
        "6.5": ("16.9", "53.1"),
        "7": ("17.3", "54.4"),
        "7.5": ("17.7", "55.7"),
        "8": ("18.1", "57.0"),
        "8.5": ("18.5", "58.3"),
        "9": ("19.0", "59.5"),
        "9.5": ("19.4", "60.8"),
        "10": ("19.8", "62.1"),
        "10.5": ("20.2", "63.4"),
        "11": ("20.6", "64.6"),
        "11.5": ("21.0", "65.9"),
        "12": ("21.4", "67.2"),
        "12.5": ("21.8", "68.5"),
        "13": ("22.2", "69.7"),
    }
    for size, (diameter, circ) in house.items():
        assert by_size[size][1] == diameter
        assert by_size[size][2] == circ
    assert by_size["6"][4:] == ["L ½", "52", "16 ½", "12", "11 ½"]
    assert by_size["7"][4:] == ["N ½", "54.5", "17 ¼", "14", "14"]
    assert by_size["4.25"][6:8] == ["—", "—"]
    assert by_size["13"][4] == "—"
    previous = -1.0
    for cells in rows:
        diameter = float(cells[1])
        circ = float(cells[2])
        assert diameter > previous
        previous = diameter
        assert abs(float(cells[3]) - round(circ / 25.4, 2)) < 0.001
    # The dialog stays on the half-size US table. The guide page adds the rest.
    assert "render 'ring-size-chart', class: 'pdp-fit-dialog__table'" in FIT.read_text()
    guide = (ROOT / "sections/size-guide.liquid").read_text()
    assert "view: 'us'" in guide
    assert "view: 'convert'" in guide
    assert "view: 'sizer'" in guide
    assert "chart_view == 'convert'" in (ROOT / "snippets/ring-size-chart.liquid").read_text()


def test_size_guide_states_the_published_resizing_policy() -> None:
    guide = (ROOT / "sections/size-guide.liquid").read_text().lower()
    page = (ROOT / "templates/page.ring-size-guide.json").read_text().lower()
    combined = guide + "\n" + page
    assert "one complimentary resizing" in combined
    assert "eternity" in combined
    assert "14 days" in combined
    assert "30-day" not in combined
    assert "30 days" not in combined
    assert "free ring sizer" not in combined
    assert "mail you" not in combined
    assert "FAQPage" in (ROOT / "sections/size-guide.liquid").read_text()
    assert "Ring Size Chart | Laura Milman" in (ROOT / "layout/theme.liquid").read_text()


def test_estate_rings_never_promise_complimentary_resizing() -> None:
    fit = FIT.read_text()
    estate_branch = fit.index("{%- if estate -%}")
    complimentary = fit.index("One complimentary resizing included")
    # The complimentary note lives in the non-estate else branch of the same if.
    assert estate_branch < fit.index("{%- elsif no_resize != '' -%}") < complimentary
