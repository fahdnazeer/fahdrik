// Peach (finance_manager) posts the Samboer snapshot here so Fahdrik phones can read it.
// Secret: FAHDRIK_ICS_TOKEN (same value as window.FAHDRIK_ICS_TOKEN in config.js)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const expected = Deno.env.get("FAHDRIK_ICS_TOKEN") || "";
  if (!expected || token !== expected) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: cors });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return new Response("Expected Samboer snapshot object", { status: 400, headers: cors });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const data = { ...(body as Record<string, unknown>), savedAt: Date.now() };
  const { error } = await sb.from("fahdrik").upsert({
    id: "fahdrik.samboer",
    data,
    updated_at: new Date().toISOString(),
    updated_by: "peach",
  });
  if (error) return new Response(error.message, { status: 500, headers: cors });
  return new Response("ok", { status: 200, headers: cors });
});
