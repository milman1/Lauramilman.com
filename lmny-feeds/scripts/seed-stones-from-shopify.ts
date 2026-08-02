#!/usr/bin/env npx tsx
/**
 * One-shot bootstrap: pull stones from the live Shopify Ajax API into
 * public.stones so the filter works before the next dual-write sync.
 *
 * Incomplete vs the sync (no cost_usd / cert URLs from tags alone) but
 * enough to exercise the App Proxy filter. Re-run after configuring
 * SUPABASE_* on the sync for authoritative rows.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/seed-stones-from-shopify.ts
 */

import { createInterface } from "node:readline";

const STORE = process.env.SHOPIFY_STOREFRONT_URL || "https://www.lauramilman.com";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
  process.exit(1);
}

const COLOR = new Set("DEFGHIJKLMNOPQRSTUVWXYZ".split(""));
const CLARITY = new Set(["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "SI3", "I1", "I2", "I3"]);
const CUT = new Set(["Ideal", "Excellent", "Very Good", "Good", "Fair", "Poor"]);
const SHAPE = new Set([
  "Round", "Princess", "Cushion", "Emerald", "Oval", "Radiant", "Asscher", "Marquise", "Heart", "Pear", "Trilliant", "Baguette",
]);
const LAB = new Set(["GIA", "IGI", "HRD", "GCAL", "AGS"]);

interface ShopifyProduct {
  handle: string;
  title: string;
  product_type: string;
  tags: string[];
  variants: Array<{ price: string; sku: string }>;
  images: Array<{ src: string }>;
}

function parseTitle(title: string): { carat?: number; shape?: string; color?: string; clarity?: string; lab?: string } {
  // "1.22ct Round, F VVS2 — IGI"
  const m = title.match(/^([\d.]+)\s*ct\s+([^,]+),\s*([A-Z]+)\s+([A-Z0-9]+)\s*[—\-–]\s*([A-Z]+)/i);
  if (!m) return {};
  return {
    carat: Number(m[1]),
    shape: m[2]!.trim(),
    color: m[3]!.toUpperCase(),
    clarity: m[4]!.toUpperCase(),
    lab: m[5]!.toUpperCase(),
  };
}

function fromProduct(p: ShopifyProduct) {
  const kind = p.product_type === "Natural Diamond" ? "natural" : p.product_type === "Lab-Grown Diamond" ? "lab" : null;
  if (!kind) return null;
  const stockRef = (p.variants[0]?.sku || p.handle.replace(/^(lg|nd)-/, "")).trim();
  if (!stockRef) return null;
  const parsed = parseTitle(p.title);
  const tags = p.tags || [];
  const shape = parsed.shape && SHAPE.has(parsed.shape) ? parsed.shape : tags.find((t) => SHAPE.has(t));
  const color = parsed.color && COLOR.has(parsed.color) ? parsed.color : tags.find((t) => COLOR.has(t) && t.length === 1);
  const clarity = parsed.clarity && CLARITY.has(parsed.clarity) ? parsed.clarity : tags.find((t) => CLARITY.has(t));
  const cut = tags.find((t) => CUT.has(t));
  const lab = parsed.lab && LAB.has(parsed.lab) ? parsed.lab : tags.find((t) => LAB.has(t)) || "IGI";
  const carat = parsed.carat;
  if (!shape || !color || !clarity || !carat) return null;
  const retail = Number(p.variants[0]?.price);
  if (!Number.isFinite(retail) || retail <= 0) return null;
  return {
    stock_ref: stockRef,
    kind,
    shape,
    carat,
    color,
    clarity,
    cut: cut ?? null,
    polish: null,
    symmetry: null,
    fluorescence: null,
    lab,
    cert_number: null,
    cert_url: null,
    measurements: null,
    table_pct: null,
    depth_pct: null,
    cost_usd: Math.round(retail * 0.65 * 100) / 100, // placeholder until sync dual-write
    rap_price_usd: null,
    retail_usd: retail,
    image_urls: (p.images || []).map((i) => i.src).filter(Boolean).slice(0, 4),
    video_urls: [],
    content_hash: `shopify-seed:${p.handle}`,
    synced_at: new Date().toISOString(),
    available: true,
  };
}

async function fetchCollection(handle: string): Promise<ShopifyProduct[]> {
  const out: ShopifyProduct[] = [];
  for (let page = 1; page <= 200; page++) {
    const url = `${STORE}/collections/${handle}/products.json?limit=250&page=${page}`;
    let body: { products: ShopifyProduct[] } | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        const wait = Math.min(60_000, 1500 * 2 ** attempt);
        console.warn(`\n${handle} page ${page}: HTTP ${res.status}, retry in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
      body = (await res.json()) as { products: ShopifyProduct[] };
      break;
    }
    if (!body) throw new Error(`${url} → exhausted retries`);
    if (!body.products?.length) break;
    out.push(...body.products);
    process.stdout.write(`\r${handle} page ${page}: ${out.length} products`);
    if (body.products.length < 250) break;
    // Stay under the Ajax API budget.
    await new Promise((r) => setTimeout(r, 350));
  }
  process.stdout.write("\n");
  return out;
}

async function upsert(rows: unknown[]) {
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/stones?on_conflict=stock_ref`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`upsert HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
    process.stdout.write(`\rupserted ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  const products = [
    ...(await fetchCollection("lab-grown-diamonds")),
    ...(await fetchCollection("natural-diamonds")),
  ];
  const rows = products.map(fromProduct).filter(Boolean);
  console.log(`Parsed ${rows.length} of ${products.length} products`);
  await upsert(rows);
  console.log("Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
