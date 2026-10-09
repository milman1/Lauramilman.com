# Belgium Dia feed-cache deployment recovery

- Issue: https://github.com/milman1/Lauramilman.com/issues/222
- Updated: 2026-10-09 15:33 UTC
- Owner: Codex, fix/cloudflare-reconnected-deploy
- Status: code merged; production deployment and full-feed verification pending.
- Scope: existing lauramilman-com Worker and Belgium Dia feed sync. No product activation or pricing changes.

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
