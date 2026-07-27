import type { Kind } from './types.js';

export const ALL_KINDS: Kind[] = ['natural', 'lab', 'watch'];

/**
 * Per-feed enable gate. SYNC_FEEDS is a comma-separated list of feeds to
 * process; feeds not listed are skipped entirely (never fetched), so a
 * naturals-only go-live never pays the API cost of the 19.9k lab rows.
 * Defaults to `natural` only. Unknown tokens are ignored; an empty/all-invalid
 * value falls back to `natural`.
 */
export function parseEnabledFeeds(raw: string | undefined = process.env.SYNC_FEEDS): Set<Kind> {
  const set = new Set<Kind>();
  for (const token of (raw ?? 'natural').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)) {
    if ((ALL_KINDS as string[]).includes(token)) set.add(token as Kind);
  }
  if (set.size === 0) set.add('natural');
  return set;
}
