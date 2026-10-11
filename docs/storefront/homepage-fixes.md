# Homepage and navigation fixes (merchant review, 2026-10-11)

Working list for PR #240 (branch `claude/sweet-fermi-83xm6l`). Tackle one
at a time; tick each item only after it is pushed and previewed.

Priority order for the store, per the merchant: (1) loose lab-grown stones —
the go-to, most trusted source on price, quality and service; (2) rings and
ring settings; (3) push presents and pieces women in the workforce buy for
themselves (under $1,000).

- [ ] 1. (Pushed; awaiting preview.) Banner and copy: lead with loose lab-grown stones, then rings and
      settings, then push presents / self-purchase.
- [ ] 2. (Pushed; awaiting preview. Feature tile + 2x2; photos come from real
      products picked per tile: Rolex Day-Date 228238, Cartier Love ring,
      lg-886886, nd-352890, lab-grown eternity band.) "Shop the house" tiles: new layout. Lab-grown diamonds and rings
      first. Rename "Pre-Owned Watches & Jewelry" to "Watches" (drop
      "Pre-Owned" up front); use a real photo of an in-stock, branded watch,
      not an AI image. Consider a "Pre-Owned Maison Jewelry" tile. Replace
      the lab-grown and natural tiles, which look AI-generated.
- [ ] 3. (Pushed: "Rings, your way" — Just because -> stackable rings. An
      "Everyday Rings" collection needs approval: it is a live store change.) Rings: present "engagement" rings that work as everyday rings as
      rings worn every day too.
- [ ] 4. (Pushed: setting pages' "lab-grown / natural diamonds" links now
      pre-filter the stone search by shape; the search also accepts the old
      link format. Walk-through on the preview theme still pending.) Ring builder: fix the flow end to end (preview and walk through).
- [ ] 5. (Pushed: promise band "14K Gold" -> "Authenticity Guaranteed";
      per-product spec lines keep their real metal.) Product rows after the tiles say "14K gold": drop it or broaden it
      (we also carry 18K, platinum and silver).
- [ ] 6. (Pushed: "The Rolex edit" row after Gold; shows the first five
      in-stock pieces from rolex-watches automatically.) Rolex spotlight section on the homepage.
- [x] 7. (Done live 2026-10-11, merchant approved; see snapshot below.
      Earrings 356->146, Rings 535->378, Bracelets 343->179, Necklaces 247->157,
      admin counts incl. drafts; no backvault-feed piece left in any.) (Was: proposal; needs approval — live collection rules. Earrings:
      299 active, 201 Back Vault estate, 39 lab-grown. Rings: 472, 150 estate,
      49 lab-grown.) Category pages (e.g. Earrings) mix high jewelry, lab-grown and
      estate/David Webb with everyday fine jewelry. Proposal needed: keep
      the everyday fine jewelry in the main category and separate the rest.
- [ ] 8. (Skipped for now, merchant 2026-10-11.) Lower-cost lab-grown (under $1,000) in rings, tennis bracelets and
      necklaces: needs a supplier and the jewelry activation gate (drafts).
- [x] 9. (Section now hidden.) Loose-diamonds homepage section points its natural example at
      `nd-k15512b`, which no longer exists; pick a current stone.
- [x] 10. (Section now hidden.) Engagement section reuses the hero's loose-diamond photo; swap it.

## Homepage mockup (2026-10-11, merchant-approved direction)

Top of the homepage now follows the merchant's mockup, in the brand palette:
cream banner "Your diamond. Your story." (mockup photo, cropped to drop the
loose-diamond tray), "Meet Laura Milman" (her real portrait), "Find a diamond
that feels like you." (compact stone search that opens the lab-grown or
natural search with the choices applied), "Rings, your way." (For your
forever -> ring builder; Just because -> stackable rings).
Hidden (disabled, not deleted): loose-diamonds comparison, engagement band,
brand story — they repeated the new sections. Re-enable in the theme editor.

- [ ] 11. (Ring photos replaced with clean full-width originals, titles now
      live text.) Banner photo is still an upscaled crop of the 1024px mockup;
      replace with the full-size original.
- [ ] 12. Catalog data: setting `round-four-prong-pave-engagement-ring-setting-in-18k-white-gold`
      has the title "Round Four-Prong Pavé ... 18K White Gold" but its SEO
      title, description and photo describe a Hidden Halo in 14K white gold.
      Two oval settings have "round" handles. Check all 9 ring settings.

## #7 collection rules — before snapshot (2026-10-11), for rollback

- all-earrings (gid://shopify/Collection/349096902727): ANY of TYPE = Earrings, TYPE = Earring
- rings (gid://shopify/Collection/168312406087): ANY of TYPE = Ring, TYPE = Rings, TYPE = Solitaire Ring
- necklaces (gid://shopify/Collection/269851328583): ALL of TITLE contains "necklace", TITLE not contains "pre-owned", TITLE not contains "vintage"
- all-bracelets (gid://shopify/Collection/349097590855): ANY of TYPE = Bracelet, Bracelets, Bangle, Tennis Bracelet

After (merchant approved 2026-10-11): each is ALL-of, keeps its types and adds
TAG not equal `backvault-feed`, so Back Vault estate pieces show only in
Estate Jewelry and the designer collections. Bracelets uses TYPE starts with
"B" and not contains "Brooch" (store types starting with B: Bangle, Bracelet,
Bracelets, Brooch, Brooches); a new B-type would need adding to the exclusions.
- [x] 13. Gold row: holiday campaign photo (2026 holiday marketing PDF,
      image 2) beside a two-by-two product grid.

## #12 ring-setting audit (2026-10-11) — read only, nothing changed

Collection `ring-settings`, 9 active products. Photos could not be checked by
machine (an image reader only echoed the file names), so shape/style needs a
human look at each hero photo.

| # | Handle | Problem | Proposed fix |
|---|---|---|---|
| 1 | round-four-prong-pave-engagement-ring-setting-in-18k-white-gold | Duplicate of #7's 18K variants (same photos, video, $1,600; SKU RG18WHH_40RDP_S vs RG18WHH_40RDP). SEO title/description and metal metafield say 14K; title says 18K. | Archive; redirect URL to #7. |
| 3 | round-hidden-halo-engagement-ring-setting-in-18k-yellow-gold-0-11-ct | Title/description "Oval"; handle, shape metafield, tag, image alt "Round"; SKU has RD (round). | Confirm from photo; align all fields. |
| 4 | round-hidden-halo-engagement-ring-setting-in-18k-yellow-gold-0-09-ct | Title/description "Oval"; handle, shape metafield, tag "Round". | Confirm from photo; align all fields. |
| 7 | round-four-prong-pave-engagement-ring-setting-in-white-gold-0-40-ct | Title "Four-Prong Pavé"; tag, photos, video and SKU (HH) say hidden halo. | Confirm style; align title/SEO or tag. |
| 8 | north-south-solitaire-bezel-engagement-ring-setting-in-18k-yellow-gold | Title "Elongated Cushion"; shape metafield "Oval". | Confirm from photo; align. |
| 9 | north-south-solitaire-prong-engagement-ring-setting-in-18k-yellow-gold | Title "Oval"; shape metafield "Round". | Confirm from photo; align. |
| 6 | round-hidden-halo-engagement-ring-setting-in-yellow-gold-0-10-ct | Description typo "labor included.14K is the default" (missing space). | Add the space. |
| 2, 5 | — | Consistent. | None. |

The shape metafield drives the "Make it a ring" pairing, so a wrong value
offers the wrong diamonds with the setting.

### #12 update (2026-10-11): shapes fixed in another session, verified here

A fresh Admin read confirms titles, SEO titles, tags, `custom.diamond_shape` and
descriptions: RG18YSO__PNS, RG18YHH_5PNS and RG18YHHRD10PNS are Oval;
RG18YSO__BNS is Cushion (display "elongated cushion"). Code lock:
`cursor/setting-shape-fix-8591` (keyed by SKU, not handle); it merges
cleanly with this PR.

Still open:
- RG18YHHRD10PNS: supplier/CAD confirmation of center fit.
- Handles `round-hidden-halo-...-0-09-ct` / `-0-11-ct` still say "round".
  Shopify's productUpdate can rename with an automatic 301 (needs approval).
- Duplicate 18K white-gold setting (9080621432903): SEO title still "14K";
  proposed archive + redirect to 9073582866503 (needs approval).
- "labor included.14K" missing space on 9073582866503 and 9073616650311.
- 9073582866503 / 9080621432903: title "Four-Prong Pavé" vs tag, photos,
  video and SKU "Hidden Halo"; style unconfirmed.
- [ ] 14. (Pushed.) Reviews spotlight: the live Google reviews widget moved up
      under the promise band, titled "Recent reviews". Newest-first order is
      set in the SociableKit dashboard (embed 25717519), not in the theme.

### #12 live changes (2026-10-11, merchant approved) — verified on the storefront
- 9073631952967 handle -> `oval-hidden-halo-engagement-ring-setting-in-18k-yellow-gold-0-09-ct` (301 from the old round- handle).
- 9073636409415 handle -> `oval-hidden-halo-engagement-ring-setting-in-18k-yellow-gold-0-11-ct` (301 from the old round- handle).
- 9080621432903 (duplicate 18K white-gold setting) ARCHIVED; redirect
  /products/round-four-prong-pave-engagement-ring-setting-in-18k-white-gold
  -> /products/round-four-prong-pave-engagement-ring-setting-in-white-gold-0-40-ct
  (UrlRedirect 413239083079). The sibling sells 18K at the same $1,600.
- "labor included.14K" was not a typo: descriptionHtml has two <p> paragraphs;
  only the plain-text API field joins them. No change.
- Still open: 0.40 ct white-gold style (four-prong pavé vs hidden halo); 0.11 ct
  oval head fit (supplier/CAD).

## Homepage round 2 (2026-10-11, merchant feedback on the live page)
- Brand palette (espresso, wine, gold, navy, warm white): the banner is back
  to the dark espresso style with gold buttons; the Rings section uses navy.
  Both have a color setting in the theme editor.
- "Find a diamond that feels like you." now uses the real diamond filter
  section (same shapes, sliders, grade scales and its lab-grown wine/gold
  look) in a new "Search only" mode: View Diamonds opens the stone search with
  the choices applied. My earlier compact search was deleted.
- "Rings, your way." has a third tile, "For every day" -> all bracelets
  (holiday campaign photo, `home-bracelets.webp`). Titles sit under the photos.
- [ ] 15. Optional: a matching pedestal-style bracelet photo to replace the
      campaign crop.

## Round 3 list (2026-10-11, merchant feedback from the live mobile page)
Work one at a time; tick when pushed.

- [x] R1. "Rings, your way." on phones: tiles must stack one per row (the phone
      CSS was lost in the last cleanup, so three columns squeezed the text).
- [x] R2. Same section, colors: navy block clashes with the warm page. Use the
      warm-white/cream ground with wine titles and gold accents, matching the
      diamond filter above it.
- [x] R3. Same section, copy: tile 2 "For work" (links to Rings, link text
      "Shop rings", not stackable rings); tile 3 "For play" (bracelets).
- [x] R4. Tile 2 gets a new image: a regular ring, not the stack.
- [x] R5. Under the three tiles, a "Shop all fine jewelry" link.
- [x] R6. "Shop the house" tiles: the real diamond stills are zoomed and out of
      proportion; show the whole stone, centered, on a quiet warm background.
- [x] R7. New scrollable product rows (swipe on phones, arrows on desktop):
      gold bracelets, lab-grown tennis necklaces, rings, etc.
- [x] R8. Background audit: merchant chose to keep the navy lab-grown row as is.
      feel busy and cheap; settle on one warm ground with gold rules.

R7 detail: new "Shop by piece" shelf after the promise band, tabs Rings / Gold
bracelets / Tennis necklaces / Earrings / Gold chains (in-stock pieces only, from
rings, gold-bracelets, lab-grown-tennis-necklaces, all-earrings, chain-necklaces).
New live collection `lab-grown-tennis-necklaces` (smart: tags "Tennis Necklace" +
"Lab Grown Diamond"; Online Store only), created while building the shelf.
R8 is a proposal awaiting the merchant's choice (see chat).
- [x] R9. Meet Laura on the homepage: portrait removed; heading, line and the
      "Read Laura's Story" link centered. Phone rules for the section restored.
- [x] R10. Espresso kept only for the banner and footer (merchant 2026-10-11):
      "Wear it together" and the private-clients band now default to a warm
      style; each has a Color setting (Espresso still available). The navy
      lab-grown row stays.
- [x] R11. Menu and dropdowns follow the homepage: Loose Diamonds | Rings | Fine
      Jewelry | Watches & Estate | Our Story. Lab-grown and natural stones share
      one dropdown; gold and lab-grown jewelry sit under Fine Jewelry. Dropdown
      photos are the approved real/campaign images; the watch card pulls a real
      in-stock Rolex photo (w-t3757). The AI-generated Rolex asset is not used.
      Python tests updated to the new homepage and menu (1 older failure remains:
      "backvault-feed" tag name in main-product.liquid, not customer-facing).
