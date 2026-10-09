# Belgium Dia feed-cache deployment recovery

- Issue: https://github.com/milman1/Lauramilman.com/issues/222
- Updated: 2026-10-09 16:20 UTC
- Owner: Codex, fix/bounded-media-recovery
- Status: complete-cache Worker deployed and dry-run verified; approved live sync paused for bounded media recovery fix.
- Scope: existing lauramilman-com Worker and Belgium Dia feed sync, including merchant-approved loose-diamond reconciliation. No pricing rule changes or unrelated jewelry activations.

## Verified work

PR #223 merged as ad634b416e49fc184896a7a04e19d0e99c44fa2f. The Worker collects all supplier pages before storing a versioned complete snapshot. The sync blocks all writes if at least 20 diamonds and more than 20% of a diamond segment would be removed. All 823 tests passed; typecheck has previously documented errors in unchanged files.

Dry run https://github.com/milman1/Lauramilman.com/actions/runs/37891747203 exposed a partial cache (3,000 rows per diamond segment) and 22,703 proposed deletions. That run did not write. The repository variable BELGIUMDIA_API_URL was restored to https://belgiumdia.com; leave it there until the Worker passes verification.

## Deployment findings

The merchant's Cloudflare Settings > Builds screenshot showed the correct repository milman1/Lauramilman.com, production branch main, root directory /, no build command, and deploy command npx wrangler deploy, but also a disconnected Git-account warning. The merchant reported reconnecting at approximately 15:28 UTC.

Production /__version still returned HTTP 403 after reconnection. The displayed deployments and successful build #1182e18a were two months old. Do not retry an old commit to recover the new fix. This documentation commit through a PR supplies a fresh main push after reconnection; a push requests a build but does not prove that it ran or succeeded.

The non-production version command in the screenshot was also npx wrangler deploy. Review that separately before making runtime changes on preview branches; this documentation-only branch carries the same Worker code as current main.

## Next checks

1. Verify the new Cloudflare main build succeeded, inspecting logs if it failed.
2. Confirm https://lauramilman-com.milmanavi.workers.dev/__version returns feed-cache-v2-complete-pages.
3. Keep the direct supplier URL until deployment is confirmed.
4. Switch the repository variable to the Worker endpoint, run a dry-run sync, and inspect complete natural/lab feed counts and removal decisions.
5. Run live only after the dry run passes completeness and removal checks. Never treat a truncated nonempty response as safe.
6. If refresh fails from supplier rate limits or Worker CPU limits, retain the direct URL and investigate logs. Do not silently serve partial data or change the paid plan without authorization.

No claim of production recovery or completed live synchronization.


## 2026-10-09 16:20 UTC recovery progress

The historical next checks above have advanced: Cloudflare main build f9d4a40d-a36a-43a7-92bf-921332db9e38 succeeded; production version 590b80c5-cc48-42df-89f7-a4caee5817c2 returns feed-cache-v2-complete-pages. BELGIUMDIA_API_URL is now https://lauramilman-com.milmanavi.workers.dev. LMNY_SYNC_LIVE=false pauses scheduled writes pending live verification.

Dry run #952 passed with zero writes: natural 3,678 fetched / 3,589 publishable; lab 25,308 fetched / 24,923 publishable. Proposed 105 creates, 1,062 updates, and 141 permanent removals (61 natural, 80 lab), no archives. Watch feed unavailable (cache 503 and direct supplier empty); its catalog segment is protected. Dry run: https://github.com/milman1/Lauramilman.com/actions/runs/37953765104 . Report artifact 11627357305 holds the exact approved removal handles; raw report contains costs and must not be committed publicly.

Merchant approved the above live scope at 15:57 UTC. Live #953 matched those decisions exactly, but was cancelled at approximately 16:19 UTC during image recovery, before bulk product reconciliation, publication, or deletion. Its prior recovery writes remain in Shopify; more than 550 active feed listings changed during recovery. Run: https://github.com/milman1/Lauramilman.com/actions/runs/37955632237 . Do not claim the approved product reconciliation completed.

The existing 15-attempt image recovery budget counted only failed rehosts, so hundreds of successful recoveries were delaying the requested sync. This fix counts every source attempt, successful or failed, and logs attempted count; remaining source-backed media waits for subsequent runs. All 823 tests passed. Typecheck still reports errors in unchanged Shopify, Uploadify, and theme tests.

Next: merge this fix, compare a fresh dry run to the approved removal handles, execute only the approved live scope, inspect report writeErrors and verify Shopify samples (create nd-220229, update nd-205200, delete nd-222890), then restore LMNY_SYNC_LIVE=true. Keep watch recovery separate and do not claim it is resolved. No paid Cloudflare plan upgrade authorized.
