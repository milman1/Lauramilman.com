# Certified colored loose lab-grown diamond feed

This integration owns only products tagged `colored-stone-feed` with handles
starting `lg-color-`. It never writes Belgium-feed products, jewelry, or watches.
The supplier name and wholesale cost never appear in storefront copy or tags.

Requirements: LGD certified-color endpoint; Available status; IGI report link
with a recoverable report number; recognized loose-diamond shape, color and
clarity; positive total cost consistent with carat × per-carat cost; both
HTTPS photo and MP4/WebM video URLs. Every eligible stone is checked for actual media
bytes so HTML error pages cannot pass as photographs or videos. Shapes follow the storefront shape list
(`snippets/diamond-shape-order.liquid`): the classic shapes plus Ashoka, step
cuts, Trilliant, Kite, Hexagonal and the other stocked shapes; the colored
filter shows an extra shape only when a colored stone carries it. Unrecognized
or incomplete rows are excluded. Certified feed entries can include rings;
the scope gate excludes those. Source certificate duplicates fail closed;
certificate collisions with another catalog supplier are skipped.

Pricing is `coloredLabRetailFromCost` in `config/pricing.ts`: the same graduated
tiers as white loose lab-grown, rounded to the dollar (merchant decision
2026-10-22; was 3.5x cost from 2026-10-11).
The existing welcome discount eligibility is unchanged. Videos use the
existing diamond template's `lmny_feed.video_url` viewer; images use Shopify
media. Loose stones never carry eBay or Uploadify switches and have tracked
quantity zero with CONTINUE, consistent with the existing loose-stone policy.

## Setup and operation

- Store `LGD_API_KEY` as an Actions secret. Reuse existing Shopify credentials.
  The feed host is `api.lgdusallc.com`. On 2026-11-22 that domain was on
  registrar client hold (Porkbun, last changed 2026-11-16) and did not
  resolve, so the hourly sync failed at supplier fetch before any Shopify
  write. The key was present. Restoring the run needs the registrant to
  remove that hold, or a replacement base URL from the supplier. A failed
  fetch still writes nothing and withdraws nothing.
- Run the workflow in dry-run mode, then sample mode to create five drafts.
- Verify five draft pages, ready photos, playable videos, grading reports,
  price, source isolation and no certificate collisions before expansion.
- Sync mode creates new products as drafts and refreshes existing source-owned
  active products. Existing archived products are never reactivated.
- Activation accepts only an exact list of reviewed existing draft handles,
  requires ready Shopify image media, and publishes to Online Store and Shop.
- Hourly runs maintain approved active inventory after the verified initial import;
  new arrivals stay draft. Set `LGD_COLOR_SYNC_LIVE=false` to pause scheduled writes.
- A complete nonempty paginated source snapshot is mandatory. Withdrawals
  exceeding 150 stones, or 10% of active source-owned inventory if that is
  larger, fail closed (merchant decision 2026-10-22; was 10%, minimum five).
  Five-product previews and targeted activation never withdraw other products.
- Read-back verification checks price, cost, SKU, certificate, video, status,
  image template, inventory, and source isolation. A separate public storefront
  verification is still required after publication.

Reports contain counts, handles and retail prices; no API key or supplier costs.
Only the sanitized report is uploaded as an Actions artifact. No raw source
records, private plan inputs, credentials, or actual-cost fixtures are committed.

## Belgium Dia colored stones (second source)

Merchant decision 2026-11-20: the fancy-color rows in the Belgium Dia lab feed
(~500 pink, yellow, blue, green and brown stones in Nov 2026) are listed
alongside LGD's, not instead of them. The white Belgium sync still holds them
as `color_below_floor`; `src/lgd-color/belgium.ts` picks them up instead.

- Same pipeline as LGD: `normalizeBelgiumRow` builds the LGD stone shape, then
  `payloadFor`, `planFor` and `main` in `sync.mjs` price, write, media-check,
  verify and withdraw it. Price is `coloredLabRetailFromCost` on the cost
  `resolveStoneCost` gives the white lab sync, with the white lab $/ct floor.
- Ownership: tags `colored-stone-feed` and `belgium-color-feed`, handle
  `lg-color-bd-<stock>`. `ownsLgd` and `ownsBelgium` keep each source's
  withdrawals to its own stones. The storefront treats both the same.
- A stone whose IGI report is already listed (by LGD or any lab-grown product)
  is skipped as `duplicate_certificate`.
- Held, never guessed: modifier colors ("Yellowish Green"), unknown intensity,
  non-IGI, clarity below SI2, no IGI report number, no HTTPS photo or MP4/WebM
  video, memo / hold / sold / not-available status, or a cost below the lab $/ct floor.
  Belgium Dia sends availability as a code (`G` guaranteed, `GA`, `Available`,
  `STPS`); a blank field stays eligible. An unrecognized code is held and
  fails the run. A complete feed whose colored rows are all recognized
  unavailable logs the value counts, writes nothing, and exits 0.
- A lab feed under 5,000 rows is refused (the pager has no total to check).
- Workflow: `.github/workflows/belgium-color-sync.yml`, hourly at :07, the same
  modes as LGD (dispatch defaults to a full dry run). Shares the
  `lmny-colored-stone-sync` concurrency group with LGD. Set
  `BELGIUM_COLOR_SYNC_LIVE=false` to pause scheduled writes. Report:
  `out/belgium-color-report.json`.

## Listing copy (both sources)

`listingCopy` in `catalog.mjs` writes title, SEO title, SEO description and
body from `docs/seo/listing-seo-geo.md` and the loose-diamond formula in
`lmny-feeds/docs/seo-title-formulas.md`, the same formula as white loose stones:

- Title: `2.00ct Oval Lab-Grown Diamond — Fancy Intense Pink VS1, IGI Certified`
- SEO title (<= 60): `2.00ct Oval Lab-Grown Diamond — Fancy Intense Pink VS1 | IGI`;
  a long name drops clarity, then intensity, so the hue and `| IGI` always stay.
- SEO description (<= 160): one identity sentence with grade and IGI report.
- Body: one answer-first `<p>` of 40-60 words, facts only; specs live in the
  `custom.*` metafields the theme turns into the spec grid and Product JSON-LD.

Changed 2026-11-20 (was `2.00ct Oval Fancy Intense Pink Lab-Grown Diamond — VS1 | IGI`).
Existing LGD listings take the new copy the next time the sync rewrites them.
