# Orchestration

This file governs how AI-assisted work is chosen and finished for Laura
Milman New York. Copy it into other repos (including Lazrbeam) as the
shared operating doc. Project-specific facts stay in that repo’s
`AGENTS.md`.

Its purpose is to complete business outcomes quickly, accurately, and
economically. Orchestration means choosing the right execution method. It
is not a requirement to create agents, code, workflows, handoffs, or
infrastructure.

If this file and `AGENTS.md` disagree on **how work is done**, this file
wins. If they disagree on **store safety, pricing, or catalog facts**,
`AGENTS.md` wins.

Read this file first, then `AGENTS.md`.

---

## 1. Highest-priority rule: deliver the outcome

Before taking action, define four things:

1. Requested outcome: What does the merchant actually need completed?
2. Definition of done: What observable result proves completion?
3. Smallest viable method: What is the fastest reliable way to produce that result?
4. Approval boundary: What decision, cost, publication, or destructive action requires merchant approval?

Supporting work is not the outcome. A plan, audit, script, workflow,
branch, handoff, or test suite does not count as completion unless that
artifact was explicitly requested.

Clearly distinguish prepared, uploaded, Active, marketplace-published, and
publicly verified. Never report “done” from only a plan, write response,
commit, or unverified browser action.

---

## 2. Simplicity gate

For every assignment, compare these approaches in order:

1. Direct computer use in the existing platform.
2. A one-time deliverable such as a CSV, spreadsheet, report, image set, or copy document.
3. A small script or API operation.
4. A reusable integration or recurring automation.

Choose the first approach that completes the outcome reliably.

Do not build recurring infrastructure for a one-time task. Do not create
a new workflow when a manual upload, platform bulk editor, or existing
app can complete the job faster. Do not introduce an agent team for work
one capable model can finish in the current session.

If the proposed method is more complex, slower, or more expensive than
the manual alternative, stop and obtain approval before proceeding.

---

## 3. The selected model executes

The merchant is the only orchestrator. The model already running does
the work.

- Do not spawn a committee (Terra, Luna, Sol, or unnamed workers) because
  a roster named them.
- Do not write a brief or handoff instead of the deliverable.
- Do not stop ordinary repo work to ask the merchant to switch models.
- If a different **surface** is required (a logged-in browser, or a
  design pass the merchant should start on Fable/Opus), stop and say
  which session to open. Do not spawn it.

Cursor Auto may route among Cursor models when Auto is selected. A named
model (Grok, Sonnet, Opus, Fable) stays that model until the merchant
changes the picker. `AGENTS.md` cannot change the picker.

---

## 4. Surfaces and models

Two choices. Do not mix them up.

**Surface** is where the hands work:

| Surface | Use it for |
|---|---|
| Cursor (this repo, git, APIs, tests, PRs) | Default for code, Shopify GraphQL, CSVs, copy, SaaS product work |
| Astra / Codex computer use | Logged-in screens only: Shopify admin, Marketplace Connect, eBay Seller Hub, supplier portals, a short live visual check |
| Fable in a fresh Cursor chat | Rare design pass when a wrong architectural choice is expensive |

**Model** is who thinks inside Cursor: Auto, Grok, Sonnet, Opus, Fable,
or others. Anthropic models inside Cursor are still Cursor work. They
are not Astra.

### Astra

Use for authenticated browser workflows and visual verification of live
pages. Astra executes those tasks itself. It does not hire cheaper
agents, does not write strategy docs unless asked, and does not stay
open to “orchestrate” Cursor.

Astra is a poor fit for generated product images. Render in Higgsfield
(or image gen directly). Use Astra only to glance at 1–2 live PDPs after
the files are on the product.

Close the Astra session when the screen matches the definition of done.

### Fable

Use once, for design only, when all three are true: the method is not
obvious after the simplicity gate, a wrong choice is expensive to undo,
and the merchant will implement the result in a cheaper Cursor model.

Fable does not implement, does not spawn workers, and does not remain
in the loop to adjudicate. Routine uploads, copy, CSVs, and ordinary
admin never need Fable.

### Cursor (including Auto and Anthropic)

Default for almost all product and repo work. Auto may pick Opus; it
will not always. For auth, billing, migrations, or other hard-to-undo
design, the merchant selects Opus or Fable. Cloud Agents use the model
chosen at start; they do not hop to Astra.

---

## 5. Scope and cost

- Complete one business objective at a time.
- Use one accountable lead.
- Use no worker unless delegation clearly saves time or context.
- Use no independent reviewer for low-risk, reversible work that can be checked directly.
- Use at most two workers and one reviewer for genuinely large work.
- Workers may not spawn additional agents.
- Do not create documentation unless it is the requested deliverable or is necessary for another session to continue unfinished work.
- Do not create new architecture, recurring automation, integrations, encryption systems, media pipelines, or model-routing layers without explicit approval.
- Before a meaningful scope or cost expansion, report the reason, expected benefit, estimated effort, and simpler alternative.
- Stop when the requested outcome is complete.

Astra and Fable sessions should be short spikes. Hours of implementation
belong on a cheaper Cursor model.

---

## 6. Progress checkpoints

Every task must produce early evidence that the method works.

- Product catalog work: prepare and verify the first 5 products before the full set.
- Large catalog work: report after the first 20 verified products and at sensible batch intervals.
- Storefront work: preview the smallest complete section or page before expanding.
- Marketplace work: validate one listing end to end before publishing the batch.
- Bulk changes: dry-run when a mistake could affect prices, inventory, publication status, or listings.
- Generated images: approve one SKU’s set before rendering a batch. Estate, watches, Jacob & Co., and one-of-one pieces use real photos only.

If the first checkpoint reveals a simpler method, switch to it. If the
checkpoint fails twice for the same reason, stop and report the blocker
instead of building around it.

---

## 7. LMNY product, pricing, and publication

Follow `AGENTS.md` for the exact safety rules, pricing matrix, source
recognition, and title formulas. The summary here is only so a session
that skips the facts file still fails closed:

- Never invent specifications, provenance, condition, certification, inventory, cost, or price.
- Supplier names that are not for customers never appear on the store.
- Cost is never public. Pricing is source-specific; never borrow a multiplier. Changes go through `lmny-feeds/config/pricing.ts`.
- Loose stones and drafts never get the `ebay` tag. Watch eBay condition is `1000` / `1500` / `3000` from structured source facts, never from the title.
- New or materially changed products stay Draft until facts, price, images, and presentation are verified. Activating or marketplace-publishing requires merchant authorization or a clearly stated instruction that already grants it.
- No product becomes Active while its price is unconfirmed.

---

## 8. Standard workflows

### A. One-time supplier catalog import

Default deliverable: a Shopify-ready CSV, not a permanent integration.

1. Extract exact product facts, SKU/reference, cost, inventory, and image URLs.
2. Normalize to the existing LMNY product structure in `AGENTS.md`.
3. Apply the correct source-specific pricing rule.
4. Generate titles, descriptions, SEO fields, alt text, taxonomy, tags, and metafields from verified facts. Follow `docs/seo/listing-seo-geo.md` (voice, GEO, video-first gallery). Length formulas stay in `lmny-feeds/docs/seo-title-formulas.md`.
5. Prepare 5 sample products for review.
6. After approval, complete the CSV with products set to Draft.
7. Validate row counts, required fields, image matches, and prices.
8. Deliver the CSV for manual Shopify upload unless the merchant asked for direct upload.

Build recurring automation only when the merchant confirms updates repeat
often enough to justify it.

If drafts for that supplier already exist in Shopify, use workflow B.
Do not scrape the portal again.

### B. Existing Shopify drafts going live

1. Identify the exact draft scope.
2. Verify images, title, description, SEO, taxonomy, metafields, SKU, price, inventory, condition, and sales channels.
3. Present unresolved items to the merchant.
4. Activate only approved products.
5. Read the public pages and confirm collection, product pages, images, prices, and availability.

### C. Small eBay batch through Marketplace Connect

1. Confirm the Shopify products are correct and Active.
2. Confirm the LMNY eBay description template and field mappings.
3. Prepare one listing and verify its public result (Astra).
4. Publish the remaining approved products as a controlled batch.
5. Confirm inventory and order syncing remain connected to Shopify.

### D. Theme or storefront improvement

1. Define the customer-facing problem and measurable acceptance check.
2. Make the smallest coherent theme change in git (never the live theme API).
3. Preview on mobile and desktop.
4. Verify links, merchandising, accessibility, and performance affected by the change.
5. Deploy only after authorization.

### E. Product listing copy (SEO + GEO)

1. Read `docs/product-page-standards.md` and `docs/seo/listing-seo-geo.md` before writing any title, body, or SEO field.
2. Use only verified facts. Specs go in `custom.*` metafields, not an HTML table.
3. Put any video in Shopify media, first in the gallery. Never embed a player in `descriptionHtml`.
4. Keep SEO title ≤ 60 and SEO description ≤ 160. Use the store’s real policy closer, not a copied 30-day returns line.
5. Run the supplier scrub. Do not invent provenance, ratings, or a sustainability hook.

---

## 9. Task brief

Every substantive assignment begins with this compact brief:

```text
Outcome:
Definition of done:
Exact scope:
Fastest viable method:
Customer-facing or revenue impact:
Approval required for:
First checkpoint:
Estimated effort/cost tier: low, medium, or high
Explicitly out of scope:
```

If any field is unknown and materially changes the work, ask the merchant
before execution. Do not fill the uncertainty with infrastructure.

---

## 10. Completion report

```text
Completed:
Verified:
Not completed:
Blocked by:
Merchant action required:
```

---

## 11. Prompts that keep capabilities on

**Astra (computer use only):**

```text
Read ORCHESTRATION.md and AGENTS.md.
You are Astra. Do the screen work yourself.
Do not spawn agents. Do not write a handoff.

Outcome:
Done when: the live page or listing shows … (screenshot after).
If you need a code change, stop and write 5 lines for Cursor.
```

**Fable (design only):**

```text
Read ORCHESTRATION.md and AGENTS.md.
You are Fable. Design only. Do not implement. Do not spawn.

Question:
Return: the chosen approach, why simpler options lose,
and a Cursor implementation brief. Then stop.
```

**Cursor (default):**

```text
Read ORCHESTRATION.md and AGENTS.md.
Do the work in this session. Do not spawn agents.
Do not write a plan instead of the deliverable.
When you need a logged-in admin or live visual check, stop and
give a 5-line Astra brief.
```

---

## 12. Other repos (Lazrbeam and anything else)

Copy this file as `ORCHESTRATION.md`. Do not copy LMNY pricing, eBay
rules, or supplier names.

Write a local `AGENTS.md` with only that project’s facts: stack, how
production deploys, what must not be deleted, where secrets live, and
the equivalent of “never-broken” rules.

Lazrbeam default: Cursor for almost all product work (including
Anthropic models inside Cursor). Astra only for a real-browser QA pass
or a third-party dashboard with no API. Fable only for hard-to-undo
design (auth, billing, tenancy).

---

## 13. Final operating principle

The best orchestration is the smallest amount of coordination that
reliably completes the merchant’s requested outcome. Use Astra’s
computer use and Fable’s judgment to reduce work, not multiply it.
