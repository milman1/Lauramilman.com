/**
 * Hourly start for the LMNY feed sync (.github/workflows/lmny-feed-sync.yml).
 *
 * WHY: GitHub's own schedule is best-effort. From 14 to 27 November 2026 the
 * '17 * * * *' schedule ran 40 times in 13 days (about 3 a day, gaps of 6-14
 * hours), so sold stones stayed listed for hours. Cloudflare cron triggers
 * fire on time, so this Worker starts the run at :17 instead.
 *
 * The run is a workflow_dispatch with `scheduled: true`. The workflow treats
 * that exactly like its own schedule: live only while the repo variable
 * LMNY_SYNC_LIVE is 'true', otherwise a dry run. The Worker cannot force a
 * live run. The GitHub schedule stays as a backup; the workflow's concurrency
 * group queues a second start behind a running one instead of overlapping.
 *
 * Needs the Worker secret GITHUB_DISPATCH_TOKEN: a fine-grained token limited
 * to this repository with "Actions: Read and write". Without it the cron logs
 * a skip and does nothing.
 */

export const SYNC_DISPATCH_CRON = '17 * * * *';
const REPO = 'milman1/Lauramilman.com';
const WORKFLOW = 'lmny-feed-sync.yml';

export async function dispatchSync(env, fetchImpl = fetch) {
  const token = env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    console.log('Sync dispatch skipped: GITHUB_DISPATCH_TOKEN is not set');
    return { dispatched: false, reason: 'no_token' };
  }
  const res = await fetchImpl(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lmny-feed-cache-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: { scheduled: 'true' } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status !== 204 && res.status !== 200) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Sync dispatch failed: HTTP ${res.status} ${detail}`);
  }
  console.log('Sync dispatch sent');
  return { dispatched: true };
}
