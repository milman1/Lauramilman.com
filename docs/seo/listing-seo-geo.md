# Listing copy: SEO and GEO

Agents write every product title, body, and SEO field from this file.
Length formulas stay in `lmny-feeds/docs/seo-title-formulas.md` and
`lmny-feeds/docs/watch-listing-schema.md`. This file is the voice,
structure, and generative-engine (GEO) standard.

Reference listing (lab-grown jewelry):
https://www.lauramilman.com/products/lab-grown-round-diamond-station-bracelet-065-ct-14k-yellow-gold-bc2423

Copy the **shape** of that page: identity-first title, short factual
body, specs in `custom.*` metafields, video as the first gallery item.
Do not copy its defects: hype (“stunning”), garbled spec fragments,
video HTML inside the description, or a policy line that disagrees with
the live store.

---

## How to know this is working (scorecard)

“Maximized SEO/GEO” is not a vibe. Score a listing against this table.
A listing is shippable at **8/10 or higher**. Below that, fix before
ACTIVE.

| # | Check | Why it matters | Pass |
|---|---|---|---|
| 1 | Title answers “what is this?” with origin/condition, type, primary spec, metal | Classic SEO + AI entity extraction | |
| 2 | SEO title ≤ 60; SEO description ≤ 160; closer matches live store policy | SERP CTR and no policy contradiction | |
| 3 | First body sentence is a 40–60 word answer block a model can quote | GEO answer-first pattern | |
| 4 | Specs live in `custom.*` metafields and match the body | Machine-readable attributes | |
| 5 | Product JSON-LD present with name, brand, sku, offer, availability | Shopify/AI crawlers read schema | |
| 6 | Video (if any) is Shopify media and first in the gallery; description has no player | Visual engagement + clean text for crawlers | |
| 7 | No supplier name, cost, hype, invented provenance | Trust + AGENTS safety rules | |
| 8 | Product type / taxonomy is specific (e.g. Bracelets, not blank) | Category retrieval | |
| 9 | Facts identical across title, body, metafields, and SEO fields | Cross-field consistency (GEO trusts consistent entities) | |
| 10 | Spot-check: paste title + first sentence into ChatGPT/Perplexity and ask “what product is this and key specs?” — answer matches the page | Real GEO smoke test | |

### What this model already covers well

- Answer-first, attribute-rich copy (Shopify GEO guidance).
- Structured metafields + Product schema (theme `structured-data-product`).
- No marketing fluff that AI engines discard.
- Video as first visual (engagement and clarity of the object).

### What this model does **not** claim to maximize yet

Be honest with the merchant — these are separate workstreams:

| Gap | Why it matters | Where it lives |
|---|---|---|
| FAQ / Q&A blocks with FAQPage schema on PDPs | Long-tail questions AI loves to cite | Theme + content recipe (not this file alone) |
| Review / AggregateRating schema | Third-party proof engines prefer | Reviews app + schema extension |
| GTIN / barcode completeness | Feed and AI catalog matching | Catalog ops |
| Off-site authority (editorial listicles, press) | GEO citation outside your domain | Marketing, not listing copy |
| Collection / guide pages that answer category queries | Category intent beyond single SKUs | SEO program in `docs/seo/` |
| AI visibility measurement (branded lift, citation logs) | Proof of GEO impact | Analytics after publish |

So: this file maximizes **on-page listing SEO + GEO fundamentals**. It does
not replace site-level SEO, reviews, or off-site authority.

---

## What “done” looks like on a product page

1. **Title** names origin or condition (only when known), shape or
   design, product type, the most shoppable spec (carat, reference, or
   model), and metal.
2. **SEO title** ≤ 60 characters. Lead with the shoppable spec. Reserve
   the intent suffix (`| 14K Yellow Gold`, `| Estate Jewelry`,
   `| Laura Milman`, `– Unworn Watch`).
3. **SEO description** ≤ 160 characters. One sentence that restates the
   identity, then two or three verified specs, then the store’s real
   closer.
4. **Body** is one short paragraph of facts. No video, iframe, image,
   price, cost, or supplier name. Specs belong in metafields so the
   theme can render the grid and JSON-LD.
5. **Video**, when one exists, is Shopify media and is the **first**
   visual on the product page. Never paste `<video>` or a player into
   `descriptionHtml`.
6. **GEO:** a search or answer engine can quote the first sentence and
   the spec table without guessing.

---

## Voice

Direct and factual. Price-forward on the page (the theme prints the
price; the body does not). No hype (“stunning”, “must-have”,
“breathtaking”). No invented provenance, celebrity claim, rating, or
sustainability hook. Peaceful Diamonds pieces may say lab-grown; they
must not lead with ethical or eco language.

Never name a supplier on the store (Back Vault, Royal Chain, Bucherer,
Exquisite Timepieces, and the same rule for any future source). Cost is
never public.

---

## Title and SEO patterns

Keep source-specific prefixes from recipe I in `AGENTS.md`. The
reference bracelet is the lab-grown jewelry pattern:

| Field | Pattern | Reference (SKU BC2423) |
|---|---|---|
| Product title | `{Lab Grown} {shape} Diamond {design} {type} – {carat} CT \| {metal}` | `Lab Grown Round Diamond Station Bracelet – 0.65 CT \| 14K Yellow Gold` |
| SEO title | `{carat} CT {shape} Lab Grown Diamond {design} {type} \| {metal}` | `0.65 CT Round Lab Grown Diamond Station Bracelet \| 14K Yellow Gold` |
| SEO description | `Shop this {identity}. {color}, {clarity}. {policy closer}.` | Shop this 0.65 CT round lab-grown diamond station bracelet in 14K yellow gold. E-F color, VS clarity. Free insured shipping and 14-day returns. |

If the SEO title would exceed 60 characters, truncate at a word boundary
and keep the suffix. The live reference title is slightly over 60;
new writes stay at or under the budget.

Other sources keep their existing formulas:

- Loose diamonds and watches: `lmny-feeds/docs/seo-title-formulas.md`
- Estate: `{brand} {details}` / `\| Estate Jewelry`, body from
  `src/backvault/listing.ts`
- House fine jewelry and chains: `{design} {gem} {type} in {metal}` /
  `\| Laura Milman`
- Jacob & Co.: `Unworn Jacob & Co {Collection} {Dial} {Reference}`

---

## Body paragraph

One `<p>`. Facts only, in this order:

1. What it is (carat or model, shape or design, type).
2. What it is set in or made of (metal, and setting only when a source
   fact exists).
3. Two or three graded or measured specs (color, clarity, length,
   reference, condition).
4. Who offers it, when that sentence is part of the source schema
   (estate: “offered by Laura Milman New York.”).

Example in the reference voice, cleaned:

> This 0.65 CT round lab-grown diamond station bracelet is set in 14K
> yellow gold. E-F color, VS clarity.

Estate pieces still add the authenticated closing paragraph from
`listing.ts`. New and house-made pieces omit that paragraph.

Do not inline a spec table in HTML. Do not embed media. Never paste
`<video>` or a player into the body. Do not invent a setting string when
the source is messy — leave `custom.setting_style` empty.

---

## SEO description closer

Use a closer that is true on the storefront:

- Jewelry: end with “Free insured shipping and 14-day returns.” or, when
  the source schema requires it, “Authenticated by Laura Milman New York.”
- Watches: exchanges-only language from the theme, not 14-day returns.
- Never write a 30-day return promise unless the merchant changes store
  policy. The reference listing’s older “30-day returns” line is stale.

---

## GEO (generative-engine optimization)

Answer engines cite pages that state a clear entity and a short list of
facts. For every listing:

1. **Answer-first sentence.** The first sentence is a complete answer to
   “what is this?”: type, origin or condition, primary spec, metal.
2. **Repeat facts, do not synonym-stuff.** Say “lab-grown diamond
   station bracelet” once in the title and once in the body. Do not add
   “ethical”, “sustainable”, “luxury”, or gift-occasion tags unless the
   merchant already uses that tag set for collection logic.
3. **Machine-readable specs.** Write verified values to `custom.*`
   metafields (`metal`, `diamond_shape`, `carat_weight`, `clarity`,
   `color`, `setting_style`, and the watch keys). Empty when unknown.
   The theme prints the spec grid and Product JSON-LD from those fields.
4. **Quote-safe claims only.** Color, clarity, carat, metal, reference,
   condition, box and papers, and measurements must come from the
   supplier record or the merchant. A missing fact stays missing.
5. **Stable identity.** Handle, SKU, and title describe the same object.
   Do not rename a live handle to chase a keyword.

Site-level GEO (`llms.txt`, agent sitemap) is the SEO program in
`docs/seo/`, not a per-product field.

---

## Video and gallery

The reference bracelet’s player was pasted into `descriptionHtml`, so
the theme showed it under the Description accordion. That is a defect.

Rules:

1. Upload the file (or a reachable MP4 URL) as Shopify product media,
   type `VIDEO` or `EXTERNAL_VIDEO`.
2. Keep that media **first** in the product’s media list. The theme
   sorts native and external video ahead of images as a safeguard
   (`sections/main-product.liquid`).
3. Body HTML contains prose only. If a source description includes
   `<video>`, `<iframe>`, or `.product-video`, strip it before save.
4. Poster or stills follow the video, not the other way around.
5. Alt text describes the piece. No price, no supplier name.

**Plan note:** If Shopify rejects `productCreateMedia` with a video-quota error, keep a single `<video>` in `descriptionHtml` temporarily so the theme hoist can place it first in the gallery. Prefer native media when quota allows.

The theme also hoists a leftover description-embedded video into the
gallery and hides it in the accordion, so older imports do not keep the
player under Description. Prefer fixing media order in Admin or via API;
the theme hoist is a backstop, not the source of truth.

---

## Do not invent

Specs, cost, price, certificates, provenance, celebrity ownership, and
photos of a one-of-one piece. A generated lifestyle frame is allowed
only where recipe I already allows it (house chains, Peaceful Diamonds
jewelry, made-to-order). Estate, watches, and Jacob & Co. stay on real
photos.

---

## Acceptance check

Before a listing is ACTIVE:

- Scorecard above is ≥ 8/10.
- Title, SEO title, SEO description, and body pass the scrub in
  `lmny-feeds/src/backvault/scrub.ts`.
- SEO title ≤ 60, SEO description ≤ 160.
- Product type is set. Marketplace pieces have a category.
- Spec metafields match the body; the body does not duplicate a table.
- Video, if any, is first in the gallery on a fresh product-page load.
- Description accordion has no player.
