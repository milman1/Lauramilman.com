# LMNY finished-jewelry listing and activation checklist

Effective: 2026-10-05. Merchant-authorized standard for future uploads and
the existing ACTIVE house fine-jewelry and lab-grown finished-jewelry catalog.

## Authority and scope

Read this file before generating, importing, editing, or activating an
in-scope listing. It supersedes conflicting finished-jewelry copy formulas,
length rules, and the former 8/10 acceptance score in other listing documents.
Pricing and catalog safeguards in AGENTS.md continue to apply.

This is a mandatory operating checklist for people and agents. A Markdown
file alone does not technically block Shopify Admin or unrelated apps from
activating products. Do not claim software enforcement without implementing
and verifying an activation guard in every relevant upload path.

- Include finished house fine jewelry, house chains, finished lab-grown jewelry,
  and ring settings sold without a center stone.
- Exclude loose diamonds, watches, and vintage/estate/pre-owned jewelry.
  Keep their separate rules.
- Use explicit product type, category, current listing facts, source record,
  condition, and merchant-approved classification to establish scope. Do not
  infer diamond origin from vendor name, photo, or similar SKU.
- Uncertain scope goes to Review. Clearly excluded products go to Skipped.
- Every uploaded product must be routed to its applicable checklist before
  activation; this document does not supply rules for excluded categories.

## Current catalog operation: ACTIVE only

1. Read and paginate the current Shopify catalog; select only products whose
   status is ACTIVE and whose scope is confirmed above. Public storefront
   visibility alone is not proof of Shopify status or source specifications.
2. Save a restricted before-snapshot and a deterministic proposed-change plan
   with IDs, handles, current status, updatedAt, source facts, old/new fields,
   and per-row Pass / Review / Skipped disposition. Keep supplier costs and
   credentials out of this public repository.
3. Prepare and verify five products before expanding the batch. Every changed
   row must pass factual and copy checks; sample review never substitutes for
   checking every row. Report after the first 20 verified changes.
4. Re-read status and changed fields immediately before writing. Skip stale
   rows or any product that is no longer ACTIVE; refresh its plan first.
5. Write only the approved listing fields and verified spec metafields.
   Omit status and publication/channel mutations. Preserve handle, SKU,
   variants, prices, costs, inventory, tags, media, discounts, and channels.
6. Review products receive no listing writes. Do not automatically deactivate
   existing active products or manufacture facts to obtain a pass.
7. Independently re-read persisted fields and verify status remains ACTIVE.
   Compare all changed fields with the plan. Report mismatches and unresolved
   checks rather than calling them done.
8. DRAFT and ARCHIVED products are untouched: no copy edits, activation,
   publishing, marketplace flags, or status changes in this cleanup.

## Future uploads and activation

Use the shared executable workflow in [jewelry-activation-gate.md](jewelry-activation-gate.md). All mandatory checks below remain required; the command automates structural checks and requires evidence for semantic and preview checks. Skylab products require their matching video attached as Shopify media. Finished lab-grown pieces use cost × 2, rounded to cents; settings remain cost × 3, rounded to dollars.


Create future uploads as DRAFT. Finish the applicable listing and operational
checks before any activation or sales-channel publication. Passing this
checklist is necessary, but is not authorization to activate a product.
Activation still requires the merchant's instruction for that scope.

All applicable mandatory checks must pass. Missing optional facts are allowed
when omitted cleanly; contradictions, missing essential identity, unverified
price, or failed presentation checks block activation. There is no numerical
score that can override a failed mandatory check.

For excluded categories, use their category-specific requirements in AGENTS.md
and the associated schema documents before activation. Skipped here does not
mean approved for publication.

## Source facts and uncertainty

Merchant revision: 2026-10-04. Explicit product facts in the current title,
description, specification lists, tags, and verified metafields are accepted
as source evidence. Record the exact source of every fact in the work plan.

- Do not infer specifications from photos, filenames, SKU codes, prices, or
  another product. Accept what the listing explicitly states; do not extend
  an ambiguous statement into a more specific claim.
- If current copy and structured specs genuinely conflict, use Review.
  A design label such as Tennis in setting_style is a classification problem,
  not evidence contradicting an explicit Bezel Set description. Record the
  correction and align the field with the stated mounting style.
- Missing dedicated metafields alone is not a blocker when the listing
  explicitly supplies the fact. Reassess the earlier Review list under this rule.
- For settings, identify the item as a ring setting. State center diamond not
  included when confirmed. Distinguish included accent-diamond weight from
  compatible center-stone size. Missing fit information is omitted, not guessed.
- Merchant-confirmed LMNY origin rule (2026-10-04): diamonds are natural
  unless the current listing explicitly identifies them as lab-grown or lab-created.
  Apply this to diamond-bearing products in this catalog; it does not turn
  diamond-cut metal finishes into diamond gemstones. Contradictory explicit
  origin statements still require Review.
- Merchant-confirmed correction: handle `diamond-bracelet-8` has 0.25 CTW
  total natural diamond weight. This confirmation is for that product only;
  it is not a blanket total-weight rule for other carat fields.
- Essential identity: verified product type and metal; verified stone identity
  and diamond origin established from explicit copy or the merchant rule whenever diamonds are present. Missing essential identity
  or uncertain scope goes to Review.
- Missing optional fields remain blank in the generated output and are omitted
  from copy. Missing optional facts alone do not put a row under Review.
- Conflicting populated facts go to Review with the handle, conflicting fields,
  and reason. Do not choose whichever value is most convenient.
- Ambiguous optional weight or shape is omitted and recorded as an unresolved
  fact. An ambiguity that changes what the product is requires Review.
- Do not invent provenance, certificates, ratings, celebrity ownership,
  supplier names, cost, price, availability, guarantees, or care claims.
- Never overwrite contradictory live specs with blanks. Review them instead.
  A blank output is not permission to delete an existing metafield.

## Diamond weight and shape

- CTW denotes source-confirmed total diamond weight for the piece or pair.
  For earrings, explicitly distinguish total for the pair from per-earring or
  per-stone weight. Do not imply equal stone weights without proof.
- CT denotes an explicitly identified individual stone's weight. State its
  role when relevant, such as center diamond, rather than implying piece total.
- Unspecified weight basis stays blank and is omitted from copy. Do not infer
  it from the fact that a product is a bracelet, ring, or pair of earrings.
- Keep precision, ranges, and units faithful to the source. No rounding to
  make a listing more attractive.
- "Mixed shape" is not an individual diamond shape. If dedicated fields
  explicitly list multiple shapes, those shapes may be named. Otherwise omit
  shape; do not infer it from photos or replace it with a guessed single shape.

## Titles

Product titles identify the piece naturally; SEO titles prioritize the most
useful verified attributes. Do not force every optional attribute into them.
Use "Lab-Grown" consistently in written copy when origin is verified.

Suggested patterns (omit missing optional attributes cleanly):

- Lab-grown product: `Lab-Grown {shape} Diamond {design} {type} – {weight with basis}, {metal}`
- Lab-grown SEO: `{weight with basis} {shape} Lab-Grown Diamond {design} {type} | {metal}`
- House product: `{design} {gemstone} {type} in {metal}`
- House SEO: `{metal} {design} {gemstone} {type} | Laura Milman`

The product title target is 70 characters or fewer. SEO title must be at most
60 characters, counting spaces and punctuation. The 60-character rule applies
to Shopify seo.title, not the product title. Confirm whether the theme appends
the store name to the HTML title and avoid needless brand duplication.

If a title exceeds its budget, shorten/remove the optional design at a word
boundary, then remove secondary attributes, then shorten/remove the brand
suffix. For lab-grown jewelry preserve diamond origin, diamond identity, and
product type. Prefer retaining metal over optional design or weight. Never
truncate a word or change a fact. If essential identity cannot fit, use Review.
Do not rename established handles to chase keywords.

## SEO description and body

SEO description: at most 160 characters. Start with one factual identity
sentence, then useful known specs, then exactly:

`Free insured shipping and 7-day returns.`

That closer is an authorized policy phrase, separate from row-only product
facts, and is permitted only after checking the current policy applies to the
product and intended market. Do not promise this for an exception or final-sale
piece. For policy ambiguity or a conflicting exception, use Review. Reserve
space for the entire closer; shorten the preceding copy at word boundaries.

Body: one HTML `<p>` only. First state what it is, then the metal ("crafted in"
for plain gold; describe a gemstone setting only if documented), then known
color, clarity, and other useful dimensions. Aim for 40–60 words, but stay
shorter if fewer facts exist. Never pad or repeat specs to hit a word count.
Escape HTML text, including ampersands, angle brackets, and quotation marks.

No FAQ, schema JSON, headings, bullet lists, spec table, extra paragraph,
image, video, iframe, price, or supplier information in the body. Do not remove
an existing description-only video until it is safely retained as Shopify
media; flag that migration for Review if it cannot be verified.

Avoid these words/phrases, case-insensitively, in generated listing copy:
stunning, must-have, breathtaking, beautiful, exquisite, killer, exceptional,
spectacular, elegant, luxury, ethical, sustainable.

## Spec columns and Shopify mapping

Generate these six columns from verified source values, blank when unknown:

| Column | Meaning |
| --- | --- |
| custom.diamond_shape | Verified diamond shape(s); no guessed mixed-shape value |
| custom.carat_weight | Verified diamond weight with its source-confirmed basis retained in copy and work plan |
| custom.color | Diamond color grade/range; not metal color |
| custom.clarity | Diamond clarity grade/range |
| custom.metal | Verified metal purity and color |
| custom.setting_style | Documented gemstone setting style |

All columns must agree with title, SEO, and body. Preserve source semantics;
do not collapse a range into a single grade. Check metafield definitions/types
before writing: never put a text unit suffix into a numeric metafield.

The existing theme uses custom.metal and falls back to custom.metal_type;
some legacy records also use custom.diamond_weight. Read all relevant keys
before writing. Do not create conflicting aliases or overwrite old factual
values. Check the rendered spec grid and existing theme-generated Product data
so total weight is not presented as one stone's weight.

## Mandatory pre-activation checks

- [ ] Scope and essential identity confirmed; no unresolved contradiction.
- [ ] Every copy claim traceable to verified facts or applicable store policy.
- [ ] Product title identifies the piece; SEO title <=60 and description <=160.
- [ ] Body is one valid factual paragraph; no padding, prohibited words, media, or supplier/cost exposure.
- [ ] Six spec fields agree with all copy; missing optional fields omitted.
- [ ] Metal, shape, diamond origin, and weight basis are consistent across variants.
      If variants differ, copy must describe supported options without implying
      all variants share one metal, size, or weight.
- [ ] Specific product type and accurate Shopify category exist; SKU on every
      sellable variant; real inventory or documented made-to-order setup.
- [ ] Price confirmed under the existing source-specific rule; no repricing in
      this copy task; discount eligibility and availability are unchanged.
- [ ] Correct product media retained; at least three accurate images for future
      activation under AGENTS.md; descriptive alt text. Video, when present,
      is retained as Shopify media and first in the gallery.
- [ ] Product preview has readable identity, matching specs, purchase options,
      accurate price, and applicable shipping/return details on mobile and desktop.
- [ ] Existing theme-generated Product/Offer data agrees with visible content.
      No schema JSON is added to listing fields.
- [ ] Intended public URL and canonical are correct; no accidental noindex or
      crawl block for intended public listings. After authorized publication,
      verify sitemap/internal links and applicable merchant-feed consistency.
- [ ] Independent read-back confirms persisted fields and intended status;
      public verification follows any separately authorized activation.

Catalog writing does not guarantee Google indexing, rank, rich results, or LLM
citations. Merchant Center, crawler access, collections, guides, genuine reviews,
and off-site authority remain separate site-level workstreams.

## Required output and completion report

Output one table with:

`Handle | Title | SEO title | SEO description | Body HTML | custom.diamond_shape | custom.carat_weight | custom.color | custom.clarity | custom.metal | custom.setting_style`

Then list Review (handle + reason) and Skipped (handle + reason).
Never recommend importing or applying a Review row. Preserve a restricted
change log showing prepared, applied, verified, unchanged, Review, and Skipped
counts separately. Report exact blockers. A plan, commit, or write response
alone is not proof that live products have been updated.
