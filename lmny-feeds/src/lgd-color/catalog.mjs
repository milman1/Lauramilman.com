import { createHash } from 'node:crypto';
import { SyncError } from './errors.mjs';
import { LGD_COLOR_DIAMONDS } from '../../config/pricing.ts';

// Separate ownership from the Belgium feed; its removal pass must never own these.
export const FEED_TAG = 'colored-stone-feed';
export const PREFIX = 'lg-color-';
const COLORS = new Set(['BLUE', 'BROWN', 'GREEN', 'ORANGE', 'PINK', 'YELLOW']);
const INTENSITIES = new Set(['Fancy', 'Fancy Light', 'Fancy', 'Fancy Intense', 'Fancy Vivid', 'Fancy Deep', 'Fancy Dark', 'Light', 'Very Light', 'Faint']);
const CLARITIES = new Set(['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2']);
const SHAPES = new Map(['ROUND','PRINCESS','CUSHION','EMERALD','OVAL','RADIANT','ASSCHER','MARQUISE','HEART','PEAR','BAGUETTE','TRILLION'].map(s => [s, titleCase(s)]));
SHAPES.set('CUSHION MODIFIED', 'Cushion');
SHAPES.set('SQUARE RADIANT', 'Radiant');
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
  if (!/^[a-z0-9_-]+$/i.test(stock)) return { reason: 'stock' };
  if (text(r.Diamond_Type) !== 'Lab Grown' || text(r.Lab) !== 'IGI' || !shape || !COLORS.has(color)) return { reason: 'scope' };
  if (text(r.Availability) !== 'Available') return { reason: 'unavailable' };
  const gradingChecks=[...(!INTENSITIES.has(intensity)?['unrecognized_intensity']:[]),...(!CLARITIES.has(clarity)?['unrecognized_clarity']:[]),...(!certificate?['unrecognized_certificate_link']:[])];
  if (gradingChecks.length) return { reason: 'grading_or_certificate',checks:gradingChecks };
  if (!Number.isFinite(carat) || carat <= 0 || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(perCarat) || perCarat <= 0 || Math.abs(cost - carat * perCarat) > Math.max(0.02, cost * 0.001)) return { reason: 'cost_mismatch' };
  const image = safeUrl(r.ImageLink, /\.(jpg|jpeg|png|webp)$/i);
  const video = safeUrl(r.Video_HTML, /\.(mp4|webm)$/i) || safeUrl(r.VideoLink, /\.(mp4|webm)$/i);
  if (!image || !video) return { reason: 'photo_or_video' };
  const stone = { stock, handle: PREFIX + stock.toLowerCase(), shape, color: titleCase(color), intensity, clarity, carat, cost, certificate, certUrl: safeUrl(r.CertificateLink, /\.pdf$/i), image,
    video, measurements: text(r.Measurements), polish: text(r.Polish), symmetry: text(r.Symmetry), fluorescence: text(r.Fluorescence_Intensity), table: number(r.TABLE_PER), depth: number(r.DEPTH_PER) };
  stone.retail = Math.round(cost * LGD_COLOR_DIAMONDS.costMultiple * 100) / 100;
  return { stone };
}
export function normalizeFeed(rows) {
  const stones = [], holds = {}, exclusions = [], stocks = new Set(), certs = new Set();
  for (const row of rows) {
    const stock = text(row.Stock_No);
    if (stocks.has(stock.toLowerCase())) throw new SyncError('duplicate_source_stock');
    stocks.add(stock.toLowerCase());
    const result = normalizeRow(row);
    if (!result.stone) {
      holds[result.reason] = (holds[result.reason] || 0) + 1;
      if (/^[a-z0-9_-]+$/i.test(stock)) exclusions.push({handle:PREFIX+stock.toLowerCase(),reason:result.reason,...(result.checks?{checks:result.checks}:{})});
      continue;
    }
    if (certs.has(result.stone.certificate)) throw new SyncError('duplicate_source_certificate');
    certs.add(result.stone.certificate); stones.push(result.stone);
  }
  return { stones, holds, exclusions };
}
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function payloadFor(s, existing, status = 'DRAFT', locationId) {
  if (status === 'ACTIVE' && (!existing || existing.status === 'ARCHIVED' || !existing.readyImage)) throw new SyncError('active_product_requires_ready_owned_media');
  const color = `${s.intensity} ${s.color}`;
  const title = `${s.carat.toFixed(2)}ct ${s.shape} ${color} Lab-Grown Diamond — ${s.clarity} | IGI`;
  const seoTitle = `${s.carat.toFixed(2)}ct ${s.color} ${s.shape} Lab-Grown Diamond | IGI`.slice(0,60);
  const descriptionHtml = `<p>This ${s.carat.toFixed(2)}ct ${escape(s.shape.toLowerCase())} lab-grown diamond has ${escape(color)} color and ${escape(s.clarity)} clarity. Its IGI report is ${escape(s.certificate)}. This is a loose diamond, sold without a setting. Review its individual photograph, video, and grading report before choosing a setting.</p>`;
  const metafields = [
    ['lmny_feed','cert_number','single_line_text_field',s.certificate],['lmny_feed','cert_url','url',s.certUrl],['lmny_feed','lab','single_line_text_field','IGI'],
    ['lmny_feed','measurements','single_line_text_field',s.measurements],['custom','diamond_shape','single_line_text_field',s.shape],
    ['custom','color','single_line_text_field',color],['custom','clarity','single_line_text_field',s.clarity],['custom','carat_weight','number_decimal',String(s.carat)],
    ['lmny_feed','video_url','url',s.video],['lmny_feed','table_pct','number_decimal',s.table > 0 ? String(s.table) : ''],['lmny_feed','depth_pct','number_decimal',s.depth > 0 ? String(s.depth) : ''],
  ].filter(f => f[3]).map(([namespace,key,type,value]) => ({namespace,key,type,value}));
  metafields.push({namespace:'colored_feed',key:'content_hash',type:'single_line_text_field',value:snapshotHash(s)});
  const input = { handle:s.handle, title, vendor:'Laura Milman New York', productType:'Lab-Grown Diamond', category:'gid://shopify/TaxonomyCategory/aa-6', templateSuffix:'diamond', status,
    descriptionHtml, tags:[FEED_TAG,'Colored Lab-Grown Diamond',s.shape,s.color,s.intensity,s.clarity,'IGI'],
    seo:{title:seoTitle,description:`${s.carat.toFixed(2)}ct ${color} ${s.shape.toLowerCase()} lab-grown diamond. ${s.clarity} clarity, IGI certified. Sold loose by Laura Milman New York.`.slice(0,160)},
    metafields, productOptions:[{name:'Title',values:[{name:'Default Title'}]}],
    variants:[{...(existing?.variantId ? {id:existing.variantId}:{}),optionValues:[{optionName:'Title',name:'Default Title'}],sku:s.stock,price:s.retail.toFixed(2),taxable:true,inventoryPolicy:'CONTINUE',inventoryItem:{tracked:true,requiresShipping:true,cost:s.cost.toFixed(2)},...(locationId ? {inventoryQuantities:[{locationId,name:'available',quantity:0}]}:{})}] };
  if (!existing?.readyImage) input.files = [{originalSource:s.image,contentType:'IMAGE',alt:title}];
  return input;
}
export function snapshotHash(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export async function fetchInventory(key, fetcher = fetch) {
  if (!key) throw new SyncError('supplier_credentials_missing');
  const rows = []; let totalPages, totalResults;
  for (let page=1; page<=100; page++) {
    const u = new URL('https://api.lgdusallc.com/api/v1/inventory/diamond');
    u.search = new URLSearchParams({type:'certified_color',page:String(page),key}).toString();
    let response;
    try { response = await fetcher(u, {headers:{Accept:'application/json'},signal:AbortSignal.timeout(60000),redirect:'error'}); }
    catch (error) { throw new SyncError(error?.name==='TimeoutError' ? 'supplier_timeout' : 'supplier_transport_failed',{page}); }
    if (!response.ok) throw new SyncError('supplier_http_error',{httpStatus:response.status,page});
    let data; try { data = await response.json(); } catch { throw new SyncError('supplier_invalid_json',{page}); }
    if (!data || !Array.isArray(data.data) || Number(data.page_no)!==page || !Number.isInteger(Number(data.total_page)) || Number(data.total_page)<1 || Number(data.total_page)>100 || !Number.isInteger(Number(data.total_results)) || Number(data.total_results)<=0) throw new SyncError('supplier_invalid_snapshot',{page});
    if (page===1) { totalPages=Number(data.total_page); totalResults=Number(data.total_results); }
    if (Number(data.total_page)!==totalPages || Number(data.total_results)!==totalResults || !data.data.length) throw new SyncError('supplier_snapshot_changed',{page});
    rows.push(...data.data);
    if (page===totalPages) { if (rows.length!==totalResults) throw new SyncError('supplier_snapshot_incomplete',{fetched:rows.length,expected:totalResults}); return rows; }
  }
  throw new Error('Feed page limit exceeded');
}
