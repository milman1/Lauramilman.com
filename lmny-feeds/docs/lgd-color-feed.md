# Certified colored loose lab-grown diamond feed

This integration owns only products tagged `colored-stone-feed` with handles
starting `lg-color-`. It never writes Belgium-feed products, jewelry, or watches.
The supplier name and wholesale cost never appear in storefront copy or tags.

Requirements: LGD certified-color endpoint; Available status; IGI report link
with a recoverable report number; recognized loose-diamond shape, color and
clarity; positive total cost consistent with carat × per-carat cost; both
HTTPS photo and MP4/WebM video URLs. Each planned write checks actual media
bytes so HTML error pages cannot pass as photographs or videos. Unrecognized
or incomplete rows are excluded. Certified feed entries can include rings;
the scope gate excludes those. Source certificate duplicates fail closed;
certificate collisions with another catalog supplier are skipped.

Pricing is `LGD_COLOR_DIAMONDS` in `config/pricing.ts`, approved 2026-10-11.
The existing welcome discount eligibility is unchanged. Videos use the
existing diamond template's `lmny_feed.video_url` viewer; images use Shopify
media. Loose stones never carry eBay or Uploadify switches and have tracked
quantity zero with CONTINUE, consistent with the existing loose-stone policy.

## Setup and operation

- Store `LGD_API_KEY` as an Actions secret. Reuse existing Shopify credentials.
- Run the workflow in dry-run mode, then sample mode to create five drafts.
- Verify five draft pages, ready photos, playable videos, grading reports,
  price, source isolation and no certificate collisions before expansion.
- Sync mode creates new products as drafts and refreshes existing source-owned
  active products. Existing archived products are never reactivated.
- Activation accepts only an exact list of reviewed existing draft handles,
  requires ready Shopify image media, and publishes to Online Store and Shop.
- Enable `LGD_COLOR_SYNC_LIVE=true` only after the first verified checkpoint.
  Hourly runs then maintain approved active inventory; new arrivals stay draft.
- A complete nonempty paginated source snapshot is mandatory. Withdrawals
  exceeding 10% of active source-owned inventory (minimum five) fail closed.
  Five-product previews and targeted activation never withdraw other products.
- Read-back verification checks price, cost, SKU, certificate, video, status,
  image template, inventory, and source isolation. A separate public storefront
  verification is still required after publication.

Reports contain counts, handles and retail prices; no API key or supplier costs.
Only the sanitized report is uploaded as an Actions artifact. No raw source
records, private plan inputs, credentials, or actual-cost fixtures are committed.
