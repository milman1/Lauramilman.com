# LMNY Orchestration Playbook

Read this before starting any task in this repository. It applies to every
model and tool that works here: Claude (Claude Code, Cowork, Managed Agents),
OpenAI (ChatGPT, Codex, GPT-6 Astra), and any human-in-the-loop operator.
`CLAUDE.md` points here so Claude tools load it automatically; OpenAI tools
read `AGENTS.md` by convention.

The playbook has four jobs: describe the system so nobody re-discovers it,
state the rules that must never be broken, route each kind of work to the
model that does it best, and define how work is split across agents and
handed back.

---

## 1. The system in one screen

| Piece | Where | What it does |
|---|---|---|
| Storefront theme | repo root (`sections/`, `snippets/`, `templates/`, `config/`) | Shopify Online Store 2.0 theme for lauramilman.com. Git-connected; the live theme is deployed from `main`. |
| Feed sync | `lmny-feeds/` (TypeScript, Node 22, vitest) | Belgium Dia diamonds + watches -> Shopify, hourly. `src/sync.ts`. |
| Back Vault sync | `lmny-feeds/src/backvault/` | Estate designer jewelry from thebackvault.com -> Shopify, weekly (Sunday 00:17 UTC). Price and availability rules live here. |
| Pricing rules | `lmny-feeds/config/pricing.ts` | Single source of truth for every markup. Changes happen only by pull request against this file. |
| Automations | `.github/workflows/*.yml` | Cron schedules and one-shot backfills. Secrets live in the repo's Actions settings. |
| Feed cache | `lmny-feeds/cloudflare-worker/`, `wrangler.jsonc` | Cloudflare Worker + KV that caches the Belgium Dia feeds. |
| Stones DB (in progress) | `lmny-feeds/supabase/` | Supabase `stones` table; dual-write target for moving diamonds off Shopify products. |
| eBay | Shopify Marketplace Connect app | Lists products carrying the `ebay` tag (today: watches only, 109 of 173). Description template is `snippets/ebay-default.liquid`, pasted into the app by hand. |
| Uploadify | Shopify app | Jewelry marketplace feed. Needs ACTIVE, SKU, qty > 0, Category. Loose diamonds are deliberately kept at qty 0 so it skips them. |
| Journal (blog) | Shopify Online Store blog `journal` | Nine published articles as of 2026-09-08, linked from header and footer. No automated writer exists in this repo. |
| Setup docs | `SHOPIFY_SETUP.md`, `lmny-feeds/README.md`, `lmny-feeds/docs/` | Metafield definitions, brand collections, listing schemas, SEO title formulas. Read the relevant one before touching that area. |

Catalog shape (active products, 2026-09-08): about 10,000 loose diamonds,
732 Back Vault estate pieces (tag `backvault-feed`, handle prefix `bv-`),
266 Laura Milman fine jewelry pieces, 123 lab-grown jewelry pieces
(tag `lab-grown`), 173 watches. 221 draft duplicates of estate pieces from an
old CSV import are hidden and untouched.

### Tools available to agents in this environment

| Tool | Use it for | Notes |
|---|---|---|
| Shopify MCP (`graphql_query`, `graphql_mutation`, `search_products`, ...) | All live store reads and writes | Validate every GraphQL operation before running it. Mutations run without a prompt in autonomous sessions, so dry-run and verify. |
| GitHub MCP | PRs, issues, Actions runs and logs | Workflow dispatch returns 403 from this integration; the user must run workflows from the Actions tab. |
| Firecrawl | Reading any external site (thebackvault.com, robinsonsjewelers.com, competitors) | The sandbox egress proxy blocks those hosts for curl and WebFetch. Firecrawl is the only path. Shopify stores expose `/products.json?limit=250&page=N`. |
| Supabase MCP | Stones table, edge functions | Inspect before migrating. |
| Google Drive, Resend | Documents, transactional email | Only when the task names them. |
| n8n MCP | Non-code automations | Frequently fails to connect. Say so instead of assuming it is unconfigured. |
| Cloudflare, Stripe MCP | Worker and payments | Need authorization in an interactive session first. |

---

## 2. Rules that are never broken

1. **The supplier is never named on the store.** "The Back Vault", "Back Vault", "back-vault", "thebackvault" must not appear in any title, body, tag, SEO field, alt text, handle, or metafield. `src/backvault/scrub.ts` enforces this and a run throws if a reference survives. Same discipline for any future supplier.
2. **Cost is never public.** Cost lives in Shopify "Cost per item" (`inventoryItem.cost`), `lmny_feed.cost_usd`, and `$app.cost_cents`. Never in `custom.*`, storefront copy, eBay, or a feed.
3. **Pricing changes are pull requests against `lmny-feeds/config/pricing.ts`.** Never a one-off number typed into Shopify admin, never a hardcoded value in a script. A bulk reprice done by hand must match the rule in that file, and the file must be merged before the next scheduled sync or the sync will revert it.
4. **Dry-run before live, verify after live.** Every bulk write is preceded by a read that produces a plan file, and followed by an independent read that confirms the store matches the plan. The verification is done by a different agent or a fresh query, never by trusting the write responses alone.
5. **Idempotent work files.** Bulk jobs run from a snapshot file (CSV or JSONL) with the final values precomputed. Re-running a line must produce the same result. Never compute a delta from live data mid-run.
6. **No destructive operations without an explicit instruction.** No product deletes, no theme deletes, no history rewrites on shared branches, no force-push. Archive instead of delete. Loose diamonds are the one exception already coded into the Belgium sync.
7. **Live theme is read-only from the API.** Theme edits go through git and the theme's Shopify connection. `themeFilesUpsert` to the published theme is blocked.
8. **eBay scope.** Loose stones never go to eBay. Watches, estate designer pieces, fine jewelry, and lab-grown jewelry may. Condition IDs: `3000` pre-owned, `1000` new.
9. **Do not report done until verified.** If a step could not be verified, say so first.
10. **Never send customer data to an unrelated service.** Customer records stay in Shopify, Resend, and Supabase.

---

## 3. Model roster

Prices are list prices at the time of writing (2026-09-08). Verify before
budgeting a large job.

| Model | ID | Input / output per 1M tokens | Best at |
|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | $10 / $50 | Orchestration, ambiguous multi-step tasks, code design, anything where a wrong call is expensive. Thinking always on; 1M context. |
| Claude Opus 5 | `claude-opus-5` | $5 / $25 | Default for code changes, refactors, PR reviews, writing that must be exactly right. |
| Claude Sonnet 5 | `claude-sonnet-5` | $2 / $10 | Bulk workers: paginated API scans, per-item mutations from a work file, scraping and normalizing, first-draft copy at volume. |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1 / $5 | Classification, tagging, yes/no checks over thousands of rows, cheap judges. 200K context. |
| OpenAI GPT-6 Astra | `gpt-6-astra` | $10 / $50 | Browser and computer use: operating admin UIs that have no API (Marketplace Connect template editor, eBay Seller Hub, Uploadify settings, Shopify admin screens). Independent second opinion on Claude-authored plans. |
| OpenAI GPT-5.6 Sol | `gpt-5.6-sol` | $5 / $30 | OpenAI-side equivalent of Opus 5 when the operator is in ChatGPT or Codex. |
| OpenAI GPT-5.6 Terra | `gpt-5.6-terra` | $2 / $12 | OpenAI-side bulk worker, equivalent of Sonnet 5. |
| OpenAI GPT-5.6 Luna | `gpt-5.6-luna` | $0.20 / $1.20 | OpenAI-side cheap classifier, equivalent of Haiku 4.5. |

Cross-vendor rule: whichever vendor the operator is in, the *tier* is what
matters. Orchestrator tier plans and verifies; build tier writes code;
worker tier executes fan-out; classifier tier labels. Do not use an
orchestrator-tier model for a worker-tier job, and do not let a worker-tier
model make scope decisions.

---

## 4. Routing table

| Job | Owner tier | Model (Claude / OpenAI) | Fan-out? | Notes |
|---|---|---|---|---|
| Understand a new request, plan, ask clarifying questions | Orchestrator | Fable 5.1 / Astra | No | One model owns the plan end to end. It does not do the bulk work itself. |
| Change sync logic, pricing rules, tests | Build | Opus 5 / Sol | No | Run `npm test` and `npx tsc --noEmit` in `lmny-feeds` before pushing. |
| Theme (Liquid, JSON, CSS) changes | Build | Opus 5 / Sol | No | Preview via a duplicate theme; never write to the live theme by API. |
| Paginated read of the catalog into a CSV | Worker | Sonnet 5 / Terra | One agent per 1,000 products | 50 products per GraphQL page. Append to the file after every page. |
| Bulk mutation from a work file | Worker | Sonnet 5 / Terra | One agent per 150 to 200 items | `productVariantsBulkUpdate`, `metafieldsSet`, `productUpdate`. Results CSV per agent. |
| Scrape a competitor or supplier catalog | Worker | Sonnet 5 / Terra | One agent per site or per 2,000 rows | Firecrawl only. Prefer `/products.json` over HTML. |
| Match products across two catalogs | Build then Worker | Opus 5 designs the match key; Sonnet 5 or Haiku 4.5 applies it | Yes, per 500 pairs | Exact SKU first, then normalized title + vendor + metal + stone, then fuzzy with a confidence score. Anything under the threshold goes to a review file, never auto-applied. |
| Product copy, SEO titles and descriptions at volume | Worker | Sonnet 5 / Terra | Per 100 products | Follow `lmny-feeds/docs/seo-title-formulas.md` and `watch-listing-schema.md`. Opus 5 spot-checks a 5% sample. |
| Brand voice pieces (homepage, journal articles, campaign copy) | Build | Opus 5 / Sol | No | One author, one voice. |
| Classify or tag thousands of rows | Classifier | Haiku 4.5 / Luna | Per 2,000 rows | Provide the label set and three examples per label. |
| Audit (SEO, metafields, schema.org, AI-search readiness) | Orchestrator plans, Worker collects | Fable 5.1 plans; Sonnet 5 collects; Opus 5 writes the report | Collection only | Output is a findings file with severity, evidence, and a proposed fix per row. |
| Operate an admin UI with no API | UI operator | Astra | No | Marketplace Connect template editor, eBay Seller Hub, Uploadify. Take a screenshot before and after every save. Never enter credentials from a chat transcript. |
| Second opinion on a plan or diff | Reviewer | The other vendor's build tier | No | Review-only; the reviewer does not edit. |
| Recurring job (weekly, hourly) | Build | Opus 5 writes the workflow | No | GitHub Actions cron for anything that touches code or Shopify. n8n only for glue between SaaS tools. Every cron job has a dry-run input and a report artifact. |

### When to use OpenAI GPT-6 Astra specifically

Use Astra when the work is in a browser rather than an API:

- Pasting and saving the eBay description template inside Marketplace Connect.
- Mapping metafields to eBay item specifics in the Marketplace Connect UI.
- Checking how a listing renders on eBay, Google Shopping, or the Shop app.
- Reproducing a storefront bug that only appears with a real browser session.

Do not use Astra for bulk API work, code changes, or anything a Shopify
GraphQL call can do; Sonnet 5 is a fifth of the price and leaves an audit
trail. Astra outputs are screenshots plus a written log of every click and
save; those go into the task's results folder like any other evidence.

---

## 5. When to spawn agents

Spawn when at least one of these is true:

- **Fan-out:** more than about 50 independent items that each need a tool call (reprice 732 products, scan 16 pages, scrape 40 vendor pages).
- **Read-heavy:** a scan that would fill the orchestrator's context with data it only needs a summary of.
- **Parallel research:** two or more independent questions (blog status, eBay tag coverage, competitor catalog shape).
- **Independent verification:** the write was done by one agent, so the verification read is done by another.

Do not spawn when the task is a single decision, a single file edit, a
question answered by one query, or when the pieces depend on each other in
sequence. Coordination costs more than it saves below ~50 items.

### Fan-out protocol

1. **Snapshot.** One worker reads the full set into `scratchpad/<job>-source.csv`. The orchestrator computes the target values and writes `scratchpad/<job>-N.jsonl`, one file per worker, with every value the worker needs precomputed.
2. **Workers.** Each worker gets one file, one validated operation, and a results path `scratchpad/<job>-N.results.csv`. It appends one line per item, retries a failed call once, never skips, never recomputes, never asks questions. It reports counts and every error handle.
3. **Sizing.** 150 to 200 mutations per worker keeps a run under ten minutes. Four to six workers in parallel is safe against Shopify's throttle; more is not faster.
4. **Verification.** A fresh worker re-reads the whole set into `scratchpad/<job>-verify.csv`. The orchestrator diffs source, plan, and verify with a script and reports the mismatch count. Zero mismatches is the only "done".
5. **Report.** Counts in a table, errors listed by handle, files named. Nothing pasted from the CSVs.

### Job brief template (what the orchestrator hands to a worker)

```
Goal:        one sentence
Tool:        exact tool name and the validated operation, verbatim
Input file:  path and field list
Output file: path and column list, header row required, append per item
Rules:       in order, one per line; include "do not stop early" and "do not ask"
Report:      the three or four numbers you want back
```

### Result report template (what a worker hands back)

```
OK: n    ERROR: n    SKIPPED: n (reason)
Errors: handle -> message (one per line)
Files:  paths and row counts
Anomalies: anything that looked wrong even if it succeeded
```

---

## 6. Job recipes

### A. Bulk Shopify price or cost update
Snapshot with `products(query: "tag:...")` including `variants.price` and
`inventoryItem.unitCost`. Plan file with `product_id`, `variant_id`,
`new_price`, `cost`. Workers run `productVariantsBulkUpdate` with
`inventoryItem.cost`. Verify. Then make sure `config/pricing.ts` matches the
rule you applied and that the sync's content hash includes price and cost so
the next scheduled run confirms rather than reverts.

### B. Competitor price matching (Back Vault vs a retailer)
1. Sonnet 5 pulls both catalogs via Firecrawl `/products.json` into two CSVs.
2. Opus 5 defines the match key. Retailers rarely share the supplier SKU, so
   expect title, vendor, metal, stone, and reference number matching with a
   confidence score.
3. Haiku 4.5 or Sonnet 5 applies the key and writes `matches.csv` with
   `confidence`, `bv_price`, `competitor_price`, `proposed_price`.
4. Everything at or above the confidence threshold goes to the reprice
   recipe (A). Everything below goes to `review.csv` for the user.
5. The rule (for example "midpoint between supplier and competitor, floor at
   supplier + markup") is written into `config/pricing.ts` first.

### C. Change to a sync pipeline
Opus 5 edits code and tests, runs `npm test` and `npx tsc --noEmit`, pushes to
a feature branch, and asks the user to run the matching workflow from the
Actions tab with dry run on. Read the run's summary artifact. Only then
merge. Scheduled runs execute `main`; an unmerged branch never runs on
schedule.

### D. eBay listing and template work
The description template (`snippets/ebay-default.liquid`) is a Marketplace
Connect (Codisto) template with `{placeholders}`; it is not rendered by the
theme. The repo copy only carries `{defaultcss}` and unstyled `lm-*`
classes, which is why brand colors never appeared. eBay allows inline
`<style>` and inline CSS, no external stylesheets, no JavaScript. Opus 5
writes the styled template using the brand tokens from
`config/settings_data.json` (espresso `#1E1109`, wine `#4A1428`, gold
`#C9A050`, cream `#FAF6F0`, warm white `#FDFAF6`, text `#2C1810`, rule
`#DDD5C5`). Astra pastes it into Marketplace Connect and screenshots the
preview. Listing scope changes (which products carry the `ebay` tag) are a
Shopify mutation and follow recipe A's protocol.

### E. SEO and AI-search audit
Collect per product: title, SEO title, SEO description, handle, product
type, category, the seven `custom.*` metafields, image alt text, structured
data emitted by the theme (`snippets/` JSON-LD), canonical, and whether the
page is indexable. Collect per page and collection the same plus H1 and
internal links. Check `robots.txt`, `sitemap.xml`, and the theme's
`llms.txt` if any. Score against `docs/seo-title-formulas.md`. Report is a
findings file plus a prioritized fix list; fixes are separate tasks.

### F. Journal (blog) pipeline
Articles are Shopify `Article` objects on blog `journal`. Check
`isPublished`, `publishedAt`, and the storefront page before concluding
anything is "not live". If a writing cadence is wanted, the recurring-job
rule applies: a workflow with a dry-run input that drafts (never publishes)
and a human publishes.

### G. Recurring automations
GitHub Actions cron, off the top of the hour, with `workflow_dispatch`
inputs for dry run and limit, a report written to `out/` and uploaded as an
artifact, and a `concurrency` group so two runs never overlap. Secrets come
from repo settings, never from a file.

---

## 7. Environment facts that cost time when forgotten

- The sandbox cannot reach thebackvault.com or robinsonsjewelers.com. Use Firecrawl, or run the code in GitHub Actions.
- The GitHub integration cannot dispatch workflows. Ask the user to run them, or touch the documented trigger file on `main`.
- `lmny-feeds` has a pre-existing type error in `test/theme-chat-opener.test.ts`. Tests pass; the typecheck is one error away from clean. Do not treat it as your regression.
- `productsCount` caps at 10,000. Loose diamonds alone exceed it.
- Shopify search filters are limited to the documented fields. Unknown fields are silently ignored and return everything.
- Back Vault's new-arrivals collection had 1,177 rows on 2026-09-06, 734 matched top designers. The full catalog is larger; the sync now checks it for availability.

---

## 8. Handoff between vendors

When Claude hands a task to an OpenAI model or the reverse, the handoff is a
file in the repo or scratchpad, never a chat summary alone:

- `scratchpad/<job>/brief.md` using the job brief template.
- Any source, plan, and verify CSVs.
- `scratchpad/<job>/log.md` with what was run, when, and the result report.

The receiving model reads this file, does not redo finished steps, and
appends to the same log.

---

## 9. Backlog (owner tier, status)

| Task | Owner | Status |
|---|---|---|
| Reprice Back Vault pieces to the midpoint between supplier and Robinson's Jewelers; cost = supplier price | Orchestrator plans, recipe B | Awaiting clarification (see session notes) |
| Restyle the eBay description template with brand colors and get it saved in Marketplace Connect | Opus 5 writes, Astra pastes, recipe D | Awaiting go-ahead |
| Metafield, SEO, and AI-search audit | Recipe E | Awaiting go-ahead |
| Journal cadence: why nothing since Aug 26, whether drafts exist, propose a schedule | Recipe F | Awaiting clarification |
| Push fine jewelry and lab-grown jewelry to eBay (no loose stones) | Recipe A for tagging, Astra for app-side mapping | Awaiting clarification |
