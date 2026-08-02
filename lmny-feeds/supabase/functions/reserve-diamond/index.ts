/**
 * Inquiry / reserve a stone — availability check + reservation row.
 *
 * POST JSON: { stock_ref, name, email, phone?, message? }
 * Returns { ok, reservation_id } or an error.
 *
 * verify_jwt is off; the function uses the service role to insert.
 * Rate-limit lightly by requiring email + stock_ref.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const stockRef = String(body.stock_ref ?? "").trim();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim() || null;
  const message = String(body.message ?? "").trim() || null;

  if (!stockRef || !name || !email) {
    return json({ error: "missing_fields", detail: "stock_ref, name, and email are required" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "invalid_email" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: stone, error: stoneErr } = await supabase
    .from("stones")
    .select("stock_ref, kind, available, shape, carat, color, clarity, retail_usd")
    .eq("stock_ref", stockRef)
    .maybeSingle();

  if (stoneErr) return json({ error: stoneErr.message }, 500);
  if (!stone || !stone.available) {
    return json({ error: "unavailable", detail: "This stone is no longer available." }, 409);
  }

  // One pending reservation per email+stone — idempotent for double-clicks.
  const { data: existing } = await supabase
    .from("reservations")
    .select("id, status")
    .eq("stock_ref", stockRef)
    .eq("customer_email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return json({
      ok: true,
      reservation_id: existing.id,
      already_pending: true,
      stone: {
        stock_ref: stone.stock_ref,
        kind: stone.kind,
        shape: stone.shape,
        carat: stone.carat,
        color: stone.color,
        clarity: stone.clarity,
        retail_usd: stone.retail_usd,
      },
    });
  }

  const { data: row, error: insErr } = await supabase
    .from("reservations")
    .insert({
      stock_ref: stockRef,
      kind: stone.kind,
      customer_name: name.slice(0, 120),
      customer_email: email.slice(0, 200),
      customer_phone: phone?.slice(0, 40) ?? null,
      message: message?.slice(0, 2000) ?? null,
    })
    .select("id")
    .single();

  if (insErr) return json({ error: insErr.message }, 500);

  return json({
    ok: true,
    reservation_id: row.id,
    stone: {
      stock_ref: stone.stock_ref,
      kind: stone.kind,
      shape: stone.shape,
      carat: stone.carat,
      color: stone.color,
      clarity: stone.clarity,
      retail_usd: stone.retail_usd,
    },
  });
});
