# LMNY Theme — Launch & Data-Layer Setup

The theme in this repo is the **visual layer** of the PD-mirror rebuild. The
items below are the **store-side configuration** it plugs into. Work top to
bottom; nothing here edits the live (MAIN) theme.

---

## 1. Preview on an unpublished theme

Push this repo to a **new unpublished theme** (Shopify CLI: `shopify theme push
--unpublished`, or Admin → Themes → Add theme). Never push over MAIN. Review
via the preview link; publish only after §2–§5 are done.

## 2. Pages — ✅ already created (2026-07-21, via Admin API)

All eight pages below exist in Admin with the exact handles and template
suffixes, published, with brief fallback body copy (the template sections
carry the real layout and content on this theme). They are unlinked from the
live theme's navigation, so creating them changed nothing user-visible on MAIN.

| Page title            | Handle             | Template suffix    | Linked from |
|-----------------------|--------------------|--------------------|-------------|
| FAQ                   | `faq`              | `faq`              | footer, education stack |
| Fine Jewelry Buying Guide | `buying-guide` | `buying-guide`     | footer |
| Estate Authentication | `authentication`   | `authentication`   | footer, Pre-Owned Maison nav |
| Jewelry Care Guide    | `care-guide`       | `care-guide`       | footer |
| Ring Size Guide       | `ring-size-guide`  | `ring-size-guide`  | footer |
| Shipping & Returns    | `shipping-returns` | `shipping-returns` | footer |
| Private Clients       | `private-clients`  | `private-clients`  | homepage, footer, ring builder, closing CTA |
| Ring Builder          | `ring-builder`     | `ring-builder`     | Wedding nav, footer |

Already existing and linked: `lauras-story` (hero secondary CTA + brand story),
`about` (About nav).

## 3. Filters — Search & Discovery app (data layer)

The theme's "Refine By" drawer renders whatever filter groups the **Search &
Discovery** app exposes per collection. Until products carry the attributes,
groups simply don't appear (drawer degrades to Sort-only). Control styles are
chosen by group **label**, so name the filters exactly:

- Label contains **Metal** → pill toggles with literal metal swatch dots
- Label contains **Carat** → preset band buttons
- Label contains **Shape** → checkbox list
- **Price** → native min/max inputs
- Anything else (Maison, Stone Type, Setting, Style…) → checkbox list

### Facet vocabulary (DECIDED + EXECUTED 2026-07-24 — human-readable, no slug namespace)

Filters ride on the catalog's **existing human-readable vocabulary** — the one
the PD pieces and LMNY lab-grown pieces already use: `14K White Gold` /
`White Gold` (both forms, mirroring the reference products), `Round`, `Oval`,
`Emerald Cut`, `Lab Grown Diamond`, `Cartier`, `Van Cleef & Arpels`. A parallel
slug namespace (`metal:14k-white`) was considered and **rejected** — it would
have split every filter group in two.

An automated pass derived missing facet tags from titles/descriptions
(additive `tagsAdd` only — nothing removed, no status changes) and populated
the seven `custom.*` metafield definitions the PDP spec table reads
(`diamond_shape`, `carat_weight` [number_decimal], `metal`, `clarity`,
`color`, `setting_style`, `length` — all pinned, storefront-readable).
Sources: labeled description specs ("Metal Type:", "Total Carat Weight:"),
title patterns ("– 5.80 CT | 14K White Gold", "D VVS2 - IGI Certified"),
VCA's "quality DEF, IF to VVS" boilerplate → `D-F` / `IF-VVS`, and
`uploadify_product.*` metafields. Only confident extractions were written;
ambiguous products were skipped (PDP hides empty rows by design).
Rollback spec: scratchpad `facet-rollback.jsonl` (tags to remove +
metafield keys to delete per product). Maison tags were already complete
(vendor↔tag counts match exactly for all nine houses) — untouched.

Known cleanup-phase items (do NOT fix during theme/filter work): lowercase
tag variants (`14k white gold`, `White gold`) and near-duplicates
(`Lab Diamond`, `Lab Created Diamond`, `Synthetic Diamond`) still fragment
filter values — unifying them requires tag *removal*, deferred to catalog
cleanup. Carat-band tags (`1-2 Carats` vs `1-3 Carat`…) were left as-is;
the carat range filter should come from the `custom.carat_weight` decimal
metafield instead.

### Filter groups per collection type

| Collection type       | Metal | Carat | Shape | Maison | Stone Type | Category/Style |
|-----------------------|-------|-------|-------|--------|------------|----------------|
| Peaceful (lab-grown)  | ✅    | ✅    | ✅    | —      | —          | —              |
| Engagement (diamond)  | ✅    | ✅    | ✅    | —      | —          | Setting        |
| Natural diamond       | ✅    | ✅    | ✅    | —      | —          | —              |
| Colored / fashion     | ✅    | —     | —     | —      | ✅         | Style          |
| Pre-Owned Maison      | ✅    | —     | —     | ✅     | —          | ✅ (bracelet/ring/pendant) |
| Bracelets/Earrings/Pendants/Necklaces | ✅ | ✅ (if diamond) | — | — | — | Style |

Shape values: Round, Oval, Emerald, Marquise, Radiant, Cushion, Asscher, Pear.
Metal values: 14K/18K White, Yellow, Rose, Platinum, Two-Tone.

Note: the sort dropdown ships with Shopify's native sort keys (Featured, Best
Selling, Price ↑↓, Date, A–Z). "Sort by carat" is not a native sort key — it
can be approximated later with a carat metafield + search, or dropped.

## 4. Collection template assignments

In Admin → Collections, assign:

- `collection.peaceful` → the Peaceful Diamonds collection (navy tier styling
  + budget chips)
- `collection.estate` → `vintage-jewelry`, `cartier`, `van-cleef-arpels`,
  `bvlgari`, `tiffany` (maison chips instead of budget chips)
- default `collection` template (budget chips) → everything else

Chips are editable per template in the customizer: absolute links (landing
collections) or relative filter queries (`?filter.v.price.lte=5000`). Budget
chips work as soon as the S&D price filter is on; they degrade to an
unfiltered view before that, never to a 404.

## 5. Peaceful Diamonds migration (decided, not yet run)

1. The collection **already exists**: "Peaceful Diamonds by Laura Milman
   New York", handle `peaceful-diamonds-by-laura-milman-new-york`
   (gid://shopify/Collection/295877705799), smart rules
   `VENDOR = "Peaceful Diamonds" OR TITLE CONTAINS "Lab Grown"`, 121 products.
   Do **not** create another. Remaining move: swap the theme's Peaceful links
   (header setting, footer link, homepage block) from the `lab-grown-jewelry`
   stand-in to this handle when the user says go.
2. Tag stragglers `Lab Grown Diamond` (existing vocabulary — applied
   2026-07-24 to the 11 that were missing it; final counts in the tagging
   pass report) so filters and exclusion rules work.
3. **301-redirect peacefuldiamonds.com** to the in-site collection — do not
   run two live storefronts on one catalog.
4. Hierarchy rule stays load-bearing: navy = Peaceful only; espresso/wine/gold
   = LMNY-proper; no Peaceful cross-sell in the private-client channel.

## 6. Ring builder — porting PD's Belgium diamond feed

PD's "Start with a Diamond" path runs on a **custom Belgium diamond-supplier
API integration** (not an App Store app), and PD's nav link to
`/collections/diamonds` 404s because the feed actually mounts elsewhere. Port
checklist:

1. Locate the code on PD that calls the supplier API (custom section/page
   template or **app proxy** — find the live route, likely under `/pages/...`
   or `/apps/...`; that's why the `/collections/diamonds` nav link 404s).
2. Copy that integration into this theme, re-skinned espresso.
3. Obtain API credentials for the LMNY store (confirm with the supplier
   whether PD's key can serve both storefronts or LMNY needs its own).
4. Re-apply markup/pricing rules.
5. Point the ring-builder "Start with a Diamond" CTA (section setting) and any
   nav "Loose Diamonds" links at the live route.

Until then the diamond path routes to `/pages/private-clients` (a real,
staffed sourcing service) — nothing dead ships. **Needed on hand for the port:
the supplier API docs + credentials.**

## 7. Programmatic SEO landing collections (create later, then link chips)

LMNY equivalents of PD's carat/budget landers: "Pre-Owned Cartier Love
Bracelets", "Sapphire Engagement Rings", "Engagement Rings Under $5,000",
"1–2ct Oval Diamonds". Create as collections with keyword-rich descriptions
(the collection template renders the description as the SEO block above the
grid), then point shop-by chips and Popular Searches entries at them. PD
hygiene NOT to clone: `-copy` suffixed handles, duplicate
`wedding-bands`/`wedding-bands-1` collections. (LMNY already has a
`necklaces`/`necklaces-1` duplicate — catalog-cleanup phase.)

## 8. Agentic commerce layer — already live, nothing to build

Verified 2026-07-21: `https://www.lauramilman.com/agents.md` is served
natively by Shopify (`text/markdown`, LMNY-branded — same document PD
serves), and it advertises the UCP endpoints `/.well-known/ucp` and
`/api/ucp/mcp`. Keep policies (privacy/ToS/refund/shipping) filled in Admin —
agents.md links straight to them.

## 9. Imagery to drop in (customizer)

All image slots ship empty with graceful fallbacks — fill with finished
photography, **never screenshots** (the old theme's hero was a literal
`Screenshot_2024-03-25...` file; don't reintroduce):

- Hero campaign image (homepage)
- Shop-the-look editorial image
- Brand-story portrait
- Pre-Owned Maison card images (falls back to collection images)
- Peaceful Diamonds feature image
- Private-clients image
- Collection images for: engagement-rings, wedding-bands, bracelets,
  pendants-1 (these four have no collection image today; earrings and
  necklaces do)

## 10. Homepage defects the rebuild retires (do not reintroduce)

- Screenshot hero imagery
- Raw-SKU product titles on the homepage (e.g. "BCLIP3-2WGMD") — the
  Signature section defaults to the curated `engagement-rings` collection and
  supports hand-picked products
- Duplicate "Pre-Owned Cartier" header over Bvlgari products — maison cards
  are now labeled per collection, counts pulled live
- "NaN / of-Infinity" carousel counters — no JS-counter carousels in the
  rebuild
- The $850 house "Love Bangle" adjacent to authentic Cartier — house pieces
  and maison estate pieces no longer share a row (separate sections; rename
  handled in catalog cleanup)
