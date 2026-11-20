/**
 * Belgium Dia colored loose lab-grown diamonds, listed alongside LGD's
 * (merchant decision 2026-11-20).
 *
 * The Belgium Dia lab feed mixes fancy-color stones in with white ones; the
 * hourly Belgium sync (src/sync.ts) lists only D-Z and holds the rest as
 * `color_below_floor`. This turns those colored rows into the same stone
 * shape the LGD colored sync uses, so they are priced, titled, tagged, media-
 * checked, activated and withdrawn by the same code (catalog.mjs, sync.mjs):
 *
 * - price: `coloredLabRetailFromCost` (the white loose lab-grown tiers) on
 *   the Belgium Dia cost the white lab sync already trusts (`resolveStoneCost`),
 *   with the same $/ct floor that catches a per-carat price read as a total;
 * - ownership: tag `belgium-color-feed` and handle prefix `lg-color-bd-`, so
 *   this source only ever withdraws its own stones and LGD's run never
 *   withdraws these;
 * - duplicates: a stone whose IGI report is already listed (LGD or any other
 *   lab-grown product) is skipped by `planFor`;
 * - new stones are created as DRAFT; going live needs the reviewed
 *   activation run, exactly like LGD.
 *
 * Anything that does not fit LGD's rules (unknown intensity, modifier colors
 * such as "Yellowish Green", non-IGI, no photo or no MP4 video) is held and
 * counted, never guessed.
 */
import { pathToFileURL } from 'node:url';
import { LAB_GUARDS, coloredLabRetailFromCost } from '../../config/pricing.js';
import { fetchBelgiumDiaFeed } from '../feeds/belgiumdia.js';
import { certNumberFromUrl, collectUrls, normalizeUrl, pick, resolveStoneCost } from '../normalize.js';
import { BELGIUM_PREFIX, BELGIUM_TAG, CLARITIES, COLORS, INTENSITIES, SHAPES, ownsBelgium, titleCase } from './catalog.mjs';
import { SafeError, currentStage, main } from './sync.mjs';

type Raw = Record<string, unknown>;

const WHITE = new Set('D E F G H I J K L M N O P Q R S T U V W X Y Z'.split(' '));
const IMAGE_KEYS = ['imagelink', 'image', 'image_url', 'images', 'img', 'photo', 'diamond_image'];
const VIDEO_KEYS = ['videolink', 'video_html', 'video', 'video_url', 'videos', 'video_link', 'diamond_video'];
/** Intensity words that can lead the Color value ("FANCY VIVID GREEN"), longest first. */
const LEADING_INTENSITY = ['FANCY INTENSE', 'FANCY VIVID', 'FANCY DEEP', 'FANCY DARK', 'FANCY LIGHT', 'VERY LIGHT', 'FANCY', 'LIGHT', 'FAINT'];

function text(raw: Raw, keys: string[]): string {
  const v = pick(raw, keys);
  return v === undefined ? '' : String(v).trim();
}
function number(raw: Raw, keys: string[]): number {
  const n = Number(text(raw, keys).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function https(url: string | undefined, ext: RegExp): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && ext.test(u.pathname) ? u.href : null;
  } catch {
    return null;
  }
}

/** True for a row the white Belgium sync would never list because of its color. */
export function isColoredRow(raw: Raw): boolean {
  const color = text(raw, ['color', 'colour', 'color_grade']).toUpperCase();
  return color !== '' && !WHITE.has(color);
}

/** "FANCY VIVID GREEN" + intensity field → { color: 'GREEN', intensity: 'Fancy Vivid' }. */
export function parseColor(colorField: string, intensityField: string): { color: string; intensity: string } | null {
  let color = colorField.trim().toUpperCase().replace(/\s+/g, ' ');
  let intensity = titleCase(intensityField);
  const lead = LEADING_INTENSITY.find((w) => color.startsWith(w + ' '));
  if (lead) {
    color = color.slice(lead.length + 1);
    if (!intensity) intensity = titleCase(lead);
  }
  if (!COLORS.has(color) || !INTENSITIES.has(intensity)) return null;
  return { color, intensity };
}

export function normalizeBelgiumRow(raw: Raw): { stone?: Record<string, unknown>; reason?: string } {
  const stock = text(raw, ['stock_ref', 'stockref', 'stock_no', 'stock_number', 'stock', 'stone_id', 'sku', 'ref', 'id']);
  if (!/^[a-z0-9_-]+$/i.test(stock)) return { reason: 'stock' };
  const diamondType = text(raw, ['diamond_type']);
  if (diamondType && !/lab/i.test(diamondType)) return { reason: 'scope' };
  const availability = text(raw, ['availability']);
  if (availability && !/^available$/i.test(availability)) return { reason: 'unavailable' };
  const shape = (SHAPES as Map<string, string>).get(text(raw, ['shape', 'cut_shape', 'stone_shape']).toUpperCase());
  const parsed = parseColor(text(raw, ['color', 'colour', 'color_grade']), text(raw, ['fancy_color_intensity', 'fancy_intensity', 'intensity']));
  if (!shape || !parsed) return { reason: 'scope' };
  if (text(raw, ['lab', 'cert_lab', 'certificate_lab', 'grading_lab']).toUpperCase() !== 'IGI') return { reason: 'lab_not_igi' };
  const clarity = text(raw, ['clarity', 'clarity_grade']).toUpperCase().replace(/\s+/g, '');
  const certUrl = normalizeUrl(text(raw, ['cert_url', 'certificate_url', 'report_url', 'cert_link', 'certificatelink']) || undefined);
  const certRaw = text(raw, ['cert_number', 'certificate_number', 'cert_no', 'report_number', 'report_no', 'certificate']) || certNumberFromUrl(certUrl) || '';
  const certDigits = certRaw.toUpperCase().replace(/^LG/, '');
  if (!(CLARITIES as Set<string>).has(clarity) || !/^\d{5,}$/.test(certDigits)) return { reason: 'grading_or_certificate' };

  const carat = number(raw, ['carat', 'carats', 'weight', 'carat_weight', 'size']);
  if (!(carat > 0)) return { reason: 'cost_mismatch' };
  const rap = number(raw, ['rap_price', 'rap', 'rapaport', 'rap_total', 'rap_price_total', 'list_price']);
  const resolved = resolveStoneCost(raw, 'lab', carat, rap > 0 ? rap : undefined);
  const cost = resolved?.costUsd ?? 0;
  if (!(cost > 0) || resolved?.mismatchDetail) return { reason: 'cost_mismatch' };
  // Same fail-closed floor as white loose lab-grown: a per-carat price read as
  // a total lands far below any real cost per carat.
  const floor = (LAB_GUARDS.minCostPerCarat.find((b) => carat <= b.maxCarat) ?? LAB_GUARDS.minCostPerCarat.at(-1)!).minUsd;
  if (!(cost / carat >= floor)) return { reason: 'cost_mismatch' };
  const retail = coloredLabRetailFromCost(cost);
  if (carat >= LAB_GUARDS.minCaratForRetailFloor && retail < LAB_GUARDS.minRetailUsd) return { reason: 'cost_mismatch' };

  const image = collectUrls(raw, IMAGE_KEYS).map((u) => https(u, /\.(jpg|jpeg|png|webp)$/i)).find(Boolean) ?? null;
  const video = collectUrls(raw, VIDEO_KEYS).map((u) => https(u, /\.(mp4|webm)$/i)).find(Boolean) ?? null;
  if (!image || !video) return { reason: 'photo_or_video' };

  const stone = {
    stock,
    handle: BELGIUM_PREFIX + stock.toLowerCase(),
    shape,
    color: titleCase(parsed.color),
    intensity: parsed.intensity,
    clarity,
    carat,
    cost,
    certificate: 'LG' + certDigits,
    certUrl: https(certUrl, /\.pdf$/i),
    image,
    video,
    measurements: text(raw, ['measurements', 'measurement', 'dimensions']),
    polish: text(raw, ['polish']),
    symmetry: text(raw, ['symmetry', 'sym']),
    fluorescence: text(raw, ['fluorescence_intensity', 'fluorescence', 'fluor']),
    table: number(raw, ['table_per', 'table_pct', 'table_percent', 'table']),
    depth: number(raw, ['depth_per', 'depth_pct', 'depth_percent', 'depth']),
    sourceTag: BELGIUM_TAG,
    retail,
  };
  return { stone };
}

/** Colored rows only; white rows belong to the hourly Belgium sync. */
export function normalizeBelgiumFeed(rows: Raw[]): { stones: Record<string, unknown>[]; holds: Record<string, number> } {
  const stones: Record<string, unknown>[] = [];
  const holds: Record<string, number> = {};
  const stocks = new Set<string>();
  const certs = new Set<string>();
  for (const raw of rows.filter(isColoredRow)) {
    const result = normalizeBelgiumRow(raw);
    if (!result.stone) {
      holds[result.reason!] = (holds[result.reason!] ?? 0) + 1;
      continue;
    }
    const { stock, certificate } = result.stone as { stock: string; certificate: string };
    if (stocks.has(stock)) throw new SafeError('Duplicate stock number in Belgium Dia colored snapshot');
    if (certs.has(certificate)) throw new SafeError('Duplicate certificate in Belgium Dia colored snapshot');
    stocks.add(stock);
    certs.add(certificate);
    stones.push(result.stone);
  }
  return { stones, holds };
}

/**
 * The Belgium Dia pager has no total to check against, so a short feed is
 * refused outright: it lists ~29,000 lab stones, and a truncated read would
 * otherwise look like colored stones selling.
 */
export const MIN_LAB_ROWS = 5000;
export async function fetchBelgiumLabRows(fetchFeed = fetchBelgiumDiaFeed): Promise<Raw[]> {
  const rows = await fetchFeed('lab');
  if (rows.length < MIN_LAB_ROWS) throw new SafeError(`Belgium Dia lab feed returned ${rows.length} rows (< ${MIN_LAB_ROWS}); refusing to sync`);
  return rows;
}

export const BELGIUM_SOURCE = {
  name: 'Belgium Dia',
  fetchRows: () => fetchBelgiumLabRows(),
  normalize: normalizeBelgiumFeed,
  owns: ownsBelgium,
  reportPath: 'out/belgium-color-report.json',
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), BELGIUM_SOURCE).catch((err: unknown) => {
    console.error(JSON.stringify({
      failedStage: currentStage(),
      ...(err instanceof SafeError ? { reason: err.message } : {}),
      message: 'Belgium Dia colored-diamond sync failed; no secrets or supplier costs are logged.',
    }));
    process.exitCode = 1;
  });
}
