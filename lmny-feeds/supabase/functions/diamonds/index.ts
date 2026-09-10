/**
 * App-proxy-compatible stones search + single-stone lookup.
 *
 * Deployed as Supabase Edge Function `diamonds`. Intended front door:
 *   Shopify App Proxy  /apps/diamonds  →  https://<ref>.supabase.co/functions/v1/diamonds
 * Until the proxy is wired in the sync app, the theme may call the function
 * URL directly (CORS enabled; verify_jwt off — RLS protects reads).
 *
 * GET /?kind=lab&shape=Round&min_carat=1&max_carat=2&colors=D,E,F&clarities=VS1,VS2
 *     &cuts=Excellent,Ideal&min_price=500&max_price=10000&sort=price_asc&page=1&per_page=24
 * GET /?stock_ref=L919753
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function csv(param: string | null): string[] {
  if (!param) return [];
  return param.split(",").map((s) => s.trim()).filter(Boolean);
}

function num(param: string | null): number | null {
  if (param === null || param === "") return null;
  const n = Number(param);
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  // App Proxy forwards the subpath; tolerate both /diamonds and /
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );

  const stockRef = url.searchParams.get("stock_ref");
  if (stockRef) {
    const { data, error } = await supabase
      .from("stones")
      .select(
        "stock_ref,kind,shape,carat,color,clarity,cut,polish,symmetry,fluorescence,lab,cert_number,cert_url,measurements,table_pct,depth_pct,retail_usd,image_urls,video_urls",
      )
      .eq("stock_ref", stockRef)
      .eq("available", true)
      .not("image_urls", "eq", "{}")
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "not_found" }, 404);
    return json({ stone: data });
  }

  const kind = url.searchParams.get("kind") || "lab";
  if (kind !== "lab" && kind !== "natural") return json({ error: "invalid_kind" }, 400);

  const page = Math.max(1, Math.floor(num(url.searchParams.get("page")) ?? 1));
  const perPage = Math.min(48, Math.max(12, Math.floor(num(url.searchParams.get("per_page")) ?? 24)));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let q = supabase
    .from("stones")
    .select(
      "stock_ref,kind,shape,carat,color,clarity,cut,lab,cert_number,cert_url,retail_usd,image_urls,video_urls",
      { count: "exact" },
    )
    .eq("kind", kind)
    .eq("available", true)
    .not("image_urls", "eq", "{}");

  const shapes = csv(url.searchParams.get("shape") || url.searchParams.get("shapes"));
  if (shapes.length) q = q.in("shape", shapes);

  const colors = csv(url.searchParams.get("colors") || url.searchParams.get("color"));
  if (colors.length) q = q.in("color", colors);

  const clarities = csv(url.searchParams.get("clarities") || url.searchParams.get("clarity"));
  if (clarities.length) q = q.in("clarity", clarities);

  const cuts = csv(url.searchParams.get("cuts") || url.searchParams.get("cut"));
  if (cuts.length) q = q.in("cut", cuts);

  const minCarat = num(url.searchParams.get("min_carat"));
  const maxCarat = num(url.searchParams.get("max_carat"));
  if (minCarat !== null) q = q.gte("carat", minCarat);
  if (maxCarat !== null) q = q.lte("carat", maxCarat);

  const minPrice = num(url.searchParams.get("min_price"));
  const maxPrice = num(url.searchParams.get("max_price"));
  if (minPrice !== null) q = q.gte("retail_usd", minPrice);
  if (maxPrice !== null) q = q.lte("retail_usd", maxPrice);

  const sort = url.searchParams.get("sort") || "price_asc";
  switch (sort) {
    case "price_desc":
      q = q.order("retail_usd", { ascending: false });
      break;
    case "carat_asc":
      q = q.order("carat", { ascending: true });
      break;
    case "carat_desc":
      q = q.order("carat", { ascending: false });
      break;
    default:
      q = q.order("retail_usd", { ascending: true });
  }

  const { data, error, count } = await q.range(from, to);
  if (error) return json({ error: error.message }, 500);

  return json({
    kind,
    page,
    per_page: perPage,
    total: count ?? 0,
    total_pages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
    stones: data ?? [],
  });
});
