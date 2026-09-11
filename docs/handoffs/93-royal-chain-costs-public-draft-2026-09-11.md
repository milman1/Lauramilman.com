# Issue #93 — Royal Chain public-cost companion draft

- Issue: https://github.com/milman1/Lauramilman.com/issues/93
- Status: prepared; source and private upload verified; completion pending Sol confirmation and PR #119 review/merge
- Canonical handoff: `docs/handoffs/93-astra-royal-chain-costs.md`
- Public branch: `codex/93-royal-chain-public-20260911`
- Public companion commit: `67aaf9e6957ba02ac3f612645e657e7c66f9e66d`
- [PR #119](https://github.com/milman1/Lauramilman.com/pull/119) is open and unmerged.
- Scope: 21 shortlist items, 93 displayed length variants
- No credentials, customer data, or private wholesale costs are in this file.

## Outputs

The public companion is `docs/suppliers/royal-chain-costs-2026-09.csv`. It has 21 rows and the public columns `item_number,url,retail,price_read,lengths_karats,error`. All rows are marked `price_read=yes` and have no error.

The private source and private output remain outside the repository:

- Source: `/Users/avimilman/Documents/Codex/2026-09-10/pu/work/royalchain-private/source-2026-09-11.txt`
- Private output: `/Users/avimilman/Documents/Codex/2026-09-10/pu/work/royalchain-private/93-royal-chain-costs-2026-09.csv`
- Public-output staging copy: `/Users/avimilman/Documents/Codex/2026-09-10/pu/work/royalchain-private/public-royal-chain-costs-2026-09.csv`

Base-cost convention: each row’s top-level cost and retail use the first displayed length variant. The public variant segments preserve the exact source order and show the retail for each displayed length. Retail uses ceil(cost × 3 / 5) × 5 for every variant.

## Sanitized source notes

- PROY018 source color is Rose although the shortlist color check says yellow.
- PCLIP095 source width is 4.1 mm while the shortlist title says 4 mm.
- HSR018 source width is 2.7 mm while the shortlist title says 2.5 mm.
- MC180 shows only an 8.5 inch variant.
- CH014 shows a 3 inch extender.
- Several other items expose bracelet lengths in the source variant list.

## Verification and remaining work

Local validation found 21 private rows, 21 public rows, 93 variants, zero errors, matching item order and URLs, and retail rounding consistent with the required formula. Root’s fresh cloud read verified the uploaded private file at 21 rows / 93 variants, and root independently re-read all 21 source pages with 0 differences. Sol’s independent normalized comparison remains the final review gate. The normalized comparison used two-decimal numeric values and matched fingerprint FNV1a64 `8362d686884797a1` (length 3937); no private values are recorded here.

Remaining work is limited to Sol confirmation and PR #119 review/merge. After merge, a separate later worker may create the 21 Shopify products as DRAFT and write Cost per item under recipe H. No Shopify writes or product creation are part of this handoff.
