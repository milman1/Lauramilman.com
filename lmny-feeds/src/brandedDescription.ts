/**
 * Laura Milman New York listing body — Shopify PDPs and eBay (Marketplace
 * Connect copies descriptionHtml). Specs stay in metafields; this is the
 * branded prose every watch / estate listing should carry.
 *
 * eBay-safe: no off-eBay URLs, phone, or email. Never "New with box and papers".
 */

export type ListingKind = 'watch' | 'jewelry';

export const AUTH_LINE = 'Authenticated and hand-inspected by Laura Milman New York.';

export const HOUSE_WATCH =
  'Selected with over 30 years of New York Diamond District expertise. Every timepiece is condition-graded and photographed as it truly is. Serial numbers and construction are verified before a listing goes live.';

export const HOUSE_JEWELRY =
  'Selected with over 30 years of New York Diamond District expertise. Every piece is condition-graded and photographed as it truly is. Hallmarks, serial numbers, and construction are verified before a listing goes live.';

export const GUARANTEE_WATCH =
  'The Laura Milman New York Guarantee includes authenticity documentation and complimentary insured shipping. Watches are exchanges only.';

export const GUARANTEE_JEWELRY =
  'The Laura Milman New York Guarantee includes authenticity documentation, complimentary insured shipping, 14-day jewelry returns, and a lifetime warranty.';

const HOUSE_RE = /over 30 years of New York Diamond District/i;
const GUARANTEE_RE = /Laura Milman New York Guarantee/i;

export function houseLine(kind: ListingKind): string {
  return kind === 'watch' ? HOUSE_WATCH : HOUSE_JEWELRY;
}

export function guaranteeLine(kind: ListingKind): string {
  return kind === 'watch' ? GUARANTEE_WATCH : GUARANTEE_JEWELRY;
}

export function brandedFooterLines(
  kind: ListingKind,
  existingHtml = '',
): string[] {
  const lines: string[] = [];
  if (!existingHtml.includes(AUTH_LINE)) lines.push(AUTH_LINE);
  if (!HOUSE_RE.test(existingHtml)) lines.push(houseLine(kind));
  if (!GUARANTEE_RE.test(existingHtml)) lines.push(guaranteeLine(kind));
  return lines;
}

export function hasCanonicalBrandedFooter(html: string, kind: ListingKind): boolean {
  return (
    html.includes(AUTH_LINE) &&
    HOUSE_RE.test(html) &&
    html.includes(guaranteeLine(kind))
  );
}

export function brandedDescriptionHtml(opts: {
  opening: string;
  notes?: string | null;
  kind: ListingKind;
}): string {
  const parts = [`<p>${escapeHtml(opts.opening)}</p>`];
  const notes = opts.notes?.trim();
  if (notes) parts.push(`<p>${escapeHtml(notes)}</p>`);
  for (const line of brandedFooterLines(opts.kind)) {
    parts.push(`<p>${escapeHtml(line)}</p>`);
  }
  return parts.join('');
}

/**
 * Keep existing product copy (schema opener or unique estate prose) and attach
 * any missing branded paragraphs. Idempotent.
 */
export function applyBrandedTemplate(
  existingHtml: string,
  kind: ListingKind,
): { html: string; changed: boolean } {
  const html = existingHtml ?? '';
  const footer = brandedFooterLines(kind, html);
  if (footer.length === 0) return { html, changed: false };
  const suffix = footer.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  const next = `${html.trim()}${suffix}`;
  return { html: next, changed: next !== html };
}

export function listingKindFromProduct(opts: {
  productType?: string | null;
  tags?: string[] | null;
}): ListingKind {
  if (/\bwatch/i.test(opts.productType ?? '')) return 'watch';
  const tags = (opts.tags ?? []).join(' ').toLowerCase();
  if (/\bwatches\b/.test(tags) || /\btimepiece/.test(tags)) return 'watch';
  return 'jewelry';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
