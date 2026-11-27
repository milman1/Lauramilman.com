import { createHash } from 'node:crypto';
import { coloredLabRetailFromCost, LAB_GUARDS, STONE_GATES } from '../../config/pricing.ts';
import { fetchInventoryType, fetchSupplierInventory, supplierFetchError, COLOR_TYPE, WHITE_TYPE } from './client.mjs';

export { supplierFetchError };

// Separate ownership from the Belgium feed; its removal pass must never own these.
export const FEED_TAG = 'colored-stone-feed';
export const PREFIX = 'lg-color-';
// Belgium Dia colored lab stones sit alongside LGD's (merchant decision
// 2026-11-20). They share FEED_TAG, so the storefront treats them the same,
// but carry their own tag and handle prefix so each source withdraws only
// its own stones (src/lgd-color/belgium.ts).
export const BELGIUM_TAG = 'belgium-color-feed';
export const BELGIUM_PREFIX = 'lg-color-bd-';
// White stones from this supplier. The handle does not start with `lg-`
// (that space belongs to the Belgium lab sync) and the tag does not name
// the supplier. Neither sync withdraws the other's stones.
export const WHITE_TAG = 'white-stone-feed';
export const WHITE_PREFIX = 'lab-white-';
export function ownsLgd(p) { return p.tags.includes(FEED_TAG) && p.handle.startsWith(PREFIX) && !p.handle.startsWith(BELGIUM_PREFIX) && !p.tags.includes(BELGIUM_TAG); }
export function ownsBelgium(p) { return p.tags.includes(FEED_TAG) && p.tags.includes(BELGIUM_TAG) && p.handle.startsWith(BELGIUM_PREFIX); }
export function ownsWhite(p) { return p.tags.includes(WHITE_TAG) && p.handle.startsWith(WHITE_PREFIX) && !p.tags.includes(FEED_TAG) && !p.tags.includes(BELGIUM_TAG); }
const WHITE_GRADES = new Set();
for (let code = 'D'.charCodeAt(0); code <= STONE_GATES.worstColor.charCodeAt(0); code++) WHITE_GRADES.add(String.fromCharCode(code));
const LABS = new Set(STONE_GATES.allowedLabs);
export const COLORS = new Set(['BLUE', 'BROWN', 'GREEN', 'ORANGE', 'PINK', 'YELLOW']);
export const INTENSITIES = new Set(['Fancy', 'Fancy Light', 'Fancy', 'Fancy Intense', 'Fancy Vivid', 'Fancy Deep', 'Fancy Dark', 'Light', 'Very Light', 'Faint']);
export const CLARITIES = new Set(['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2']);
export const SHAPES = new Map(['ROUND','PRINCESS','CUSHION','EMERALD','OVAL','RADIANT','ASSCHER','MARQUISE','HEART','PEAR','BAGUETTE','TRILLION'].map(s => [s, titleCase(s)]));
SHAPES.set('CUSHION MODIFIED', 'Cushion');
SHAPES.set('SQUARE RADIANT', 'Radiant');
// Shapes beyond the classic list, named as the storefront shape buttons store
// them (snippets/diamond-shape-order.liquid), so each stone lands on a button.
for (const s of ['ASHOKA','OLD MINER','OLDMINE OVAL','OLDMINE PEAR','PORTUGUESE','MOVAL','TRIANGLE','TRILLIANT','CUSHION BRILLIANT',
  'DUTCH MARQUISE','DUTCH MARQUISE STEP','MARQUISE STEP','OVAL STEP','OVAL STEP CUT','PEAR STEP','HALF MOON','CRISS CUT','SHIELD',
  'BULLET','BUTTERFLY','HEXAGONAL','HEXAGONAL STEP','LOZENGE','LOZENGE STEP','LOZENGE STEP CUT','CADILLAC','PENTAGONAL','PENTAGONAL STEP',
  'HORSE','HORSE HEAD','KITE','KITE STEP','KITE STEP CUT','TRAPEZOID','EUROPEAN CUT','OLD EUROPEAN','LADY HEART','CAPSULE','OCTAGONAL']) SHAPES.set(s, titleCase(s));
SHAPES.set('HALFMOON', 'Half Moon');
SHAPES.set('EUROPEANCUT', 'European Cut');
// Supplier abbreviations of shapes the buttons already have.
SHAPES.set('MARQUISE MODIFIED BRILLI', 'Marquise');
SHAPES.set('MARQUISE MODIFIED BRILLIANT', 'Marquise');
SHAPES.set('OCTAGONAL STEP CUT', 'Octagonal');
for (const s of ['OLDMINE MOVAL','OLD MOVAL','TYCOON','TYCOON CUT','ROUND STAR','TRUMP','CROSS','OLDMINE ASSCHER','DUCK','OLDMINE CUSHION','ANGEL CUT','ROUND ROSE CUT','OLDMINE MARQUISE','OVAL POLYGON STEP CUT','SQUARE CUSHION STEPCUT']) SHAPES.set(s, titleCase(s));
SHAPES.set('OLD MOVAL', 'Oldmine Moval');
function text(v) { return String(v ?? '').trim(); }
const number = v => Number(text(v));
export function titleCase(v) { return text(v).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()); }
function safeUrl(v, extension) {
  try { const u = new URL(text(v)); return u.protocol === 'https:' && extension.test(u.pathname) && !u.username && !u.password ? u.href : null; }
  catch { return null; }
}
export function certificateFromUrl(v) {
  const url = safeUrl(v, /\.pdf$/i);
  if (!url) return null;
  const m = new URL(url).pathname.match(/\/(LG\d{5,})\.pdf$/i);
  return m ? m[1].toUpperCase() : null;
}
export function normalizeRow(r) {
  const stock = text(r.Stock_No), shape = SHAPES.get(text(r.Shape).toUpperCase());
  const color = text(r.Color).toUpperCase(), intensity = titleCase(text(r.Fancy_Color_Intensity));
  const clarity = text(r.Clarity).toUpperCase(), carat = number(r.Weight);
  const cost = number(r.Buy_Price_Total), perCarat = number(r.Buy_Price);
  const certificate = certificateFromUrl(r.CertificateLink);
  // A `bd-` stock would land in the Belgium handle space (lg-color-bd-…).
  if (!/^[a-z0-9_-]+$/i.test(stock) || /^bd-/i.test(stock)) return { reason: 'stock' };
  if (text(r.Diamond_Type) !== 'Lab Grown' || text(r.Lab) !== 'IGI' || !shape || !COLORS.has(color)) return { reason: 'scope' };
  if (text(r.Availability) !== 'Available') return { reason: 'unavailable' };
  if (!INTENSITIES.has(intensity) || !CLARITIES.has(clarity) || !certificate) return { reason: 'grading_or_certificate' };
  if (!Number.isFinite(carat) || carat <= 0 || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(perCarat) || perCarat <= 0 || Math.abs(cost - carat * perCarat) > Math.max(0.02, cost * 0.001)) return { reason: 'cost_mismatch' };
  const image = safeUrl(r.ImageLink, /\.(jpg|jpeg|png|webp)$/i);
  const video = safeUrl(r.Video_HTML, /\.(mp4|webm)$/i) || safeUrl(r.VideoLink, /\.(mp4|webm)$/i);
  if (!image || !video) return { reason: 'photo_or_video' };
  const stone = { stock, handle: PREFIX + stock.toLowerCase(), shape, color: titleCase(color), intensity, clarity, carat, cost, certificate, certUrl: safeUrl(r.CertificateLink, /\.pdf$/i), image,
    video, measurements: text(r.Measurements), polish: text(r.Polish), symmetry: text(r.Symmetry), fluorescence: text(r.Fluorescence_Intensity), table: number(r.TABLE_PER), depth: number(r.DEPTH_PER) };
  stone.retail = coloredLabRetailFromCost(cost);
  return { stone };
}
export function normalizeFeed(rows) {
  const stones = [], holds = {}, stocks = new Set(), certs = new Set();
  for (const row of rows) {
    const stock = text(row.Stock_No);
    if (stocks.has(stock)) throw new Error('Duplicate stock number in source snapshot');
    stocks.add(stock);
    const result = normalizeRow(row);
    if (!result.stone) { holds[result.reason] = (holds[result.reason] || 0) + 1; continue; }
    if (certs.has(result.stone.certificate)) throw new Error('Duplicate certificate in source snapshot');
    certs.add(result.stone.certificate); stones.push(result.stone);
  }
  return { stones, holds };
}
function costGuard(carat, cost) {
  const floor = (LAB_GUARDS.minCostPerCarat.find((band) => carat <= band.maxCarat) ?? LAB_GUARDS.minCostPerCarat.at(-1)).minUsd;
  if (!(cost / carat >= floor)) return false;
  const retail = coloredLabRetailFromCost(cost);
  if (carat >= LAB_GUARDS.minCaratForRetailFloor && retail < LAB_GUARDS.minRetailUsd) return false;
  return true;
}
function whiteCertificate(row, lab) {
  const fromUrl = certificateFromUrl(row.CertificateLink);
  const certUrl = safeUrl(row.CertificateLink, /\.pdf$/i);
  if (fromUrl && certUrl) return { certificate: fromUrl, certUrl };
  if (!certUrl) return null;
  const match = new URL(certUrl).pathname.match(/\/([A-Za-z0-9]{5,})\.pdf$/i);
  if (!match) return null;
  let certificate = match[1].toUpperCase();
  if (lab === 'IGI' && /^\d{5,}$/.test(certificate)) certificate = `LG${certificate}`;
  return { certificate, certUrl };
}
/** White lab-grown row from type=certified. Fancy colors stay on normalizeRow. */
export function normalizeWhiteRow(r) {
  const stock = text(r.Stock_No);
  const shape = SHAPES.get(text(r.Shape).toUpperCase());
  const color = text(r.Color).toUpperCase();
  const clarity = text(r.Clarity).toUpperCase();
  const lab = text(r.Lab).toUpperCase();
  const carat = number(r.Weight);
  const cost = number(r.Buy_Price_Total);
  const perCarat = number(r.Buy_Price);
  if (!/^[a-z0-9_-]+$/i.test(stock)) return { reason: 'stock' };
  if (text(r.Diamond_Type) !== 'Lab Grown' || !shape) return { reason: 'scope' };
  if (!LABS.has(lab)) return { reason: 'grading_or_certificate' };
  if (text(r.Availability) !== 'Available') return { reason: 'unavailable' };
  if (!WHITE_GRADES.has(color)) return { reason: WHITE_GRADES.size && color >= 'M' && color <= 'Z' && color.length === 1 ? 'color_below_floor' : 'scope' };
  if (!CLARITIES.has(clarity)) return { reason: 'grading_or_certificate' };
  const certificate = whiteCertificate(r, lab);
  if (!certificate) return { reason: 'grading_or_certificate' };
  if (!Number.isFinite(carat) || carat <= 0 || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(perCarat) || perCarat <= 0 || Math.abs(cost - carat * perCarat) > Math.max(0.02, cost * 0.001) || !costGuard(carat, cost)) return { reason: 'cost_mismatch' };
  const image = safeUrl(r.ImageLink, /\.(jpg|jpeg|png|webp)$/i);
  const video = safeUrl(r.Video_HTML, /\.(mp4|webm)$/i) || safeUrl(r.VideoLink, /\.(mp4|webm)$/i);
  if (!image) return { reason: 'photo_or_video' };
  const stone = {
    inventory: 'white', stock, handle: WHITE_PREFIX + stock.toLowerCase(), shape, color, intensity: '', clarity, lab, carat, cost,
    certificate: certificate.certificate, certUrl: certificate.certUrl, image, video: video || '',
    measurements: text(r.Measurements), polish: text(r.Polish), symmetry: text(r.Symmetry), fluorescence: text(r.Fluorescence_Intensity),
    table: number(r.TABLE_PER), depth: number(r.DEPTH_PER), sourceTag: WHITE_TAG,
  };
  stone.retail = coloredLabRetailFromCost(cost);
  return { stone };
}
/**
 * Colored rows, plus white rows when the fetch tagged them. Untagged rows
 * stay on the colored path so the existing checks keep their meaning.
 * `manageWhite` is set by the fetcher when the white snapshot was complete,
 * including a legitimate empty one. It is left unset when that class is
 * not offered, so those products are left alone.
 */
export function normalizeLgdFeed(rows) {
  if (![...rows].some((row) => row && row._lgdType)) return normalizeFeed(rows);
  const stones = [];
  const holds = {};
  const stocks = new Set();
  const certs = new Set();
  const counts = { color: 0, white: 0 };
  for (const row of rows) {
    const stock = text(row.Stock_No);
    if (stocks.has(stock)) throw new Error('Duplicate stock number in source snapshot');
    stocks.add(stock);
    const result = row._lgdType === WHITE_TYPE ? normalizeWhiteRow(row)
      : row._lgdType === COLOR_TYPE ? normalizeRow(row)
      : null;
    if (!result) throw new Error('Unrecognized LGD inventory class');
    if (!result.stone) { holds[result.reason] = (holds[result.reason] || 0) + 1; continue; }
    if (certs.has(result.stone.certificate)) throw new Error('Duplicate certificate in source snapshot');
    certs.add(result.stone.certificate);
    stones.push(result.stone);
    if (result.stone.inventory === 'white') counts.white += 1;
    else counts.color += 1;
  }
  return { stones, holds, counts, manageWhite: rows.manageWhite === true };
}
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Listing copy per docs/seo/listing-seo-geo.md and the loose-diamond formula in
// lmny-feeds/docs/seo-title-formulas.md (same as white loose stones, src/product.ts):
//   title     {carat}ct {shape} Lab-Grown Diamond — {color} {clarity}, IGI Certified
//   SEO title {carat}ct {shape} Lab-Grown Diamond — {color} {clarity} | IGI  (<= 60, suffix and hue kept)
//   SEO desc  one identity sentence with verified specs (<= 160)
//   body      one <p>, answer-first, 40-60 words, facts only, no table or media
// where {color} is the intensity and hue ("Fancy Intense Pink").
function truncateAtWord(v, max) { if (v.length <= max) return v; const cut = v.slice(0, max); const i = cut.lastIndexOf(' '); return (i > 0 ? cut.slice(0, i) : cut).trim(); }
function fitWithSuffix(lead, suffix, max) { return `${truncateAtWord(lead, max - suffix.length - 1)} ${suffix}`.trim(); }
export function listingCopy(s) {
  if (s.inventory === 'white') return whiteListingCopy(s);
  const carat = Number(s.carat).toFixed(2), color = `${s.intensity} ${s.color}`, shape = s.shape.toLowerCase();
  const measurements = text(s.measurements).replace(/\s*mm$/i, '');
  const title = `${carat}ct ${s.shape} Lab-Grown Diamond — ${color} ${s.clarity}, IGI Certified`;
  // Long shapes or intensities drop clarity, then intensity, before any word is
  // cut, so the hue (the colored-stone search term) always survives.
  const leads = [`${carat}ct ${s.shape} Lab-Grown Diamond — ${color} ${s.clarity}`, `${carat}ct ${s.shape} Lab-Grown Diamond — ${color}`,
    `${carat}ct ${s.shape} Lab-Grown Diamond — ${s.color}`, `${carat}ct ${s.color} ${s.shape} Lab-Grown Diamond`];
  const seoTitle = fitWithSuffix(leads.find(l => l.length + 6 <= 60) ?? leads[3], '| IGI', 60);
  const seoDescription = truncateAtWord(`Shop this ${carat}ct ${shape} lab-grown diamond in ${color}, graded ${s.clarity} clarity and certified by IGI under report ${s.certificate}.`, 160);
  const body = `This ${carat}ct ${shape} lab-grown diamond is graded ${color} color and ${s.clarity} clarity by IGI under report ${s.certificate}` +
    (measurements ? `, and measures ${measurements} mm` : '') +
    '. It is a loose stone, sold without a setting. Its own photograph, 360° video and IGI grading report are on this page.';
  return { title, seoTitle, seoDescription, descriptionHtml: `<p>${escape(body)}</p>` };
}
function whiteListingCopy(s) {
  const carat = Number(s.carat).toFixed(2);
  const shape = s.shape.toLowerCase();
  const lab = s.lab;
  const measurements = text(s.measurements).replace(/\s*mm$/i, '');
  const title = `${carat}ct ${s.shape} Lab-Grown Diamond — ${s.color} ${s.clarity}, ${lab} Certified`;
  const lead = `${carat}ct ${s.shape} Lab-Grown Diamond — ${s.color} ${s.clarity}`;
  const seoTitle = fitWithSuffix(lead.length + lab.length + 3 <= 60 ? lead : `${carat}ct ${s.shape} Lab-Grown Diamond — ${s.color}`, `| ${lab}`, 60);
  const seoDescription = truncateAtWord(`Shop this ${carat}ct ${shape} lab-grown diamond, graded ${s.color} ${s.clarity} and certified by ${lab} under report ${s.certificate}.`, 160);
  const videoWords = s.video ? ' Its photograph and 360° video are on this page.' : ' Its photograph is on this page.';
  const body = `This ${carat}ct ${shape} lab-grown diamond is graded ${s.color} color and ${s.clarity} clarity by ${lab} under report ${s.certificate}` +
    (measurements ? `, and measures ${measurements} mm` : '') +
    '. It is a loose stone, sold without a setting.' + videoWords;
  return { title, seoTitle, seoDescription, descriptionHtml: `<p>${escape(body)}</p>` };
}
export function payloadFor(s, existing, status = 'DRAFT', locationId) {
  if (status === 'ACTIVE' && (!existing || existing.status === 'ARCHIVED' || !existing.readyImage)) throw new Error('Activation requires an existing reviewed draft with ready image');
  const white = s.inventory === 'white';
  const color = white ? s.color : `${s.intensity} ${s.color}`;
  const lab = white ? s.lab : 'IGI';
  const copy = listingCopy(s);
  const title = copy.title;
  const seoTitle = copy.seoTitle;
  const descriptionHtml = copy.descriptionHtml;
  const metafields = [
    ['lmny_feed','cert_number','single_line_text_field',s.certificate],['lmny_feed','cert_url','url',s.certUrl],['lmny_feed','lab','single_line_text_field',lab],
    ['lmny_feed','measurements','single_line_text_field',s.measurements],['custom','diamond_shape','single_line_text_field',s.shape],
    ['custom','color','single_line_text_field',color],['custom','clarity','single_line_text_field',s.clarity],['custom','carat_weight','number_decimal',String(s.carat)],
    ['lmny_feed','video_url','url',s.video],['lmny_feed','table_pct','number_decimal',s.table > 0 ? String(s.table) : ''],['lmny_feed','depth_pct','number_decimal',s.depth > 0 ? String(s.depth) : ''],
  ].filter(f => f[3]).map(([namespace,key,type,value]) => ({namespace,key,type,value}));
  metafields.push({namespace:'colored_feed',key:'content_hash',type:'single_line_text_field',value:snapshotHash(s)});
  const input = { handle:s.handle, title, vendor:'Laura Milman New York', productType:'Lab-Grown Diamond', category:'gid://shopify/TaxonomyCategory/aa-6', templateSuffix:'diamond', status,
    descriptionHtml, tags: (white
      ? [WHITE_TAG, s.shape, s.color, s.clarity, lab]
      : [FEED_TAG, ...(s.sourceTag ? [s.sourceTag] : []), 'Colored Lab-Grown Diamond', s.shape, s.color, s.intensity, s.clarity, 'IGI']).filter(Boolean),
    seo:{title:seoTitle,description:copy.seoDescription},
    metafields, productOptions:[{name:'Title',values:[{name:'Default Title'}]}],
    variants:[{...(existing?.variantId ? {id:existing.variantId}:{}),optionValues:[{optionName:'Title',name:'Default Title'}],sku:s.stock,price:s.retail.toFixed(2),taxable:true,inventoryPolicy:'CONTINUE',inventoryItem:{tracked:true,requiresShipping:true,cost:s.cost.toFixed(2)},...(locationId ? {inventoryQuantities:[{locationId,name:'available',quantity:0}]}:{})}] };
  if (!existing?.readyImage) input.files = [{originalSource:s.image,contentType:'IMAGE',alt:title}];
  return input;
}
export function snapshotHash(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
/** Colored inventory only. The scheduled sync uses fetchLgdInventory for both classes. */
export async function fetchInventory(key, fetcher = fetch) {
  const snapshot = await fetchInventoryType(key, COLOR_TYPE, { fetcher });
  return snapshot.rows;
}
/** Colored feed plus a complete white feed. `manageWhite` is false when white is not offered. */
export async function fetchLgdInventory(key, fetcher = fetch) {
  return fetchSupplierInventory(key, { fetcher });
}
