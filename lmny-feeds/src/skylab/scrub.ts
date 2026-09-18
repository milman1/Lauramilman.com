/**
 * Strip Skylab branding from listing copy before it can reach a Laura
 * Milman product. Same storefront rule as Back Vault: the supplier is never
 * named in title, body, vendor, tags, SEO, alt, handle, or metafields.
 *
 * Matches are whitespace/hyphen/case-insensitive so "Sky Lab" and "sky-lab"
 * fail closed. Do not use a public tag that contains the supplier name.
 */
const SKYLAB_PATTERN = /\bsky[\s-]*lab\b/gi;

export function containsSkylabReference(text: string | null | undefined): boolean {
  if (!text) return false;
  return new RegExp(SKYLAB_PATTERN.source, 'i').test(text);
}

export function scrubSkylabText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(SKYLAB_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+([.,;:])/g, '$1')
    .trim();
}

export function assertSkylabScrubbed(fields: Record<string, string | null | undefined>): void {
  const hits = Object.entries(fields).filter(([, v]) => containsSkylabReference(v));
  if (hits.length > 0) {
    throw new Error(
      `Skylab reference survived scrubbing in: ${hits.map(([k]) => k).join(', ')}`,
    );
  }
}
