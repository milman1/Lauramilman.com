/**
 * Center-stone shape for house engagement-ring settings sold without a
 * center stone. The supplier SKU is preserved; it is not a shape code.
 * "RD10" on RG18YHHRD10PNS may name 1.0 mm halo diamonds. It is not a round
 * center, and that head still needs supplier or CAD confirmation of fit.
 * Matching the shape does not by itself confirm that a stone fits.
 */

export interface SettingCenterShape {
  sku: string;
  title: string;
  /** Canonical filter shape. Never "Elongated Cushion". */
  shape: 'Oval' | 'Cushion';
  /** Storefront detail. The filter and picker still use `shape`. */
  display: string;
}

export const SETTING_CENTER_SHAPES: readonly SettingCenterShape[] = [
  { sku: 'RG18YSO__PNS', title: 'Oval Four-Prong Solitaire Setting, 18K Yellow Gold', shape: 'Oval', display: 'Oval' },
  { sku: 'RG18YHH_5PNS', title: 'Oval Hidden Halo Setting, 18K Yellow Gold, 0.09 CT', shape: 'Oval', display: 'Oval' },
  { sku: 'RG18YHHRD10PNS', title: 'Oval Hidden Halo Setting, 18K Yellow Gold, 0.11 CT', shape: 'Oval', display: 'Oval' },
  { sku: 'RG18YSO__BNS', title: 'Elongated Cushion Bezel Solitaire Setting, 18K Yellow Gold', shape: 'Cushion', display: 'elongated cushion' },
];

const BY_LENGTH = [...SETTING_CENTER_SHAPES].sort((a, b) => b.sku.length - a.sku.length);
const SHAPE_WORDS = ['Round', 'Princess', 'Cushion', 'Emerald', 'Oval', 'Radiant', 'Asscher', 'Marquise', 'Heart', 'Pear'];

/** Exact base SKU, or that base plus a size suffix such as "-6" or "-8.5". */
export function settingCenterShapeForSku(sku: string | null | undefined): SettingCenterShape | null {
  const trimmed = (sku ?? '').trim();
  if (!trimmed) return null;
  for (const row of BY_LENGTH) {
    if (trimmed === row.sku || trimmed.startsWith(`${row.sku}-`)) return row;
  }
  return null;
}

export function assertHouseSettingSkuNotInFeed(sku: string | null | undefined): void {
  const row = settingCenterShapeForSku(sku);
  if (row) {
    throw new Error(`House ring setting ${row.sku} is not a feed item; the feed must not overwrite its ${row.shape} center shape`);
  }
}

export function settingShapeIssues(input: {
  skus: Array<string | null | undefined>;
  title: string;
  diamondShape?: string | null;
  tags?: string[];
  copy?: string;
}): string[] {
  const hits = input.skus.map(settingCenterShapeForSku).filter((row): row is SettingCenterShape => row != null);
  if (!hits.length) return [];
  const issues: string[] = [];
  const bases = new Set(hits.map((row) => row.sku));
  if (bases.size > 1) issues.push('Variant SKUs map to more than one center-stone setting');
  const row = hits[0]!;
  if (input.title.trim() !== row.title) issues.push(`Mapped setting ${row.sku} title must be "${row.title}"`);
  if ((input.diamondShape ?? '').trim() !== row.shape) {
    issues.push(`Mapped setting ${row.sku} custom.diamond_shape must be ${row.shape}`);
  }
  if (input.tags) {
    const tags = input.tags.map((tag) => tag.trim().toLowerCase());
    if (!tags.includes(row.shape.toLowerCase())) issues.push(`Mapped setting ${row.sku} needs the ${row.shape} tag`);
    for (const other of SHAPE_WORDS) {
      if (other !== row.shape && tags.includes(other.toLowerCase())) {
        issues.push(`Mapped setting ${row.sku} must not carry the ${other} tag`);
      }
    }
  }
  const blob = `${input.title}\n${input.copy ?? ''}`;
  for (const other of SHAPE_WORDS) {
    if (other === row.shape) continue;
    if (new RegExp(`\\b${other}\\b`, 'i').test(blob)) {
      issues.push(`Mapped setting ${row.sku} copy must not call the center ${other}`);
    }
  }
  if (!/sold without a center stone|sold separately|center stone not included/i.test(blob)) {
    issues.push(`Mapped setting ${row.sku} copy must state that the center stone is sold separately`);
  }
  return issues;
}
