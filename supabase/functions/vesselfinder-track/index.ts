// VesselFinder Container Tracking - admin-only proxy with caching in DB.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VF_BASE = "https://container.vesselfinder.com/api/1.0";

type Action = "enable" | "disable" | "refresh" | "get" | "list";

interface ReqBody {
  action: Action;
  containerId?: string;
  containerNumber?: string;     // override
  sealine?: string | null;       // optional carrier code (SCAC)
  force?: boolean;               // force refresh ignoring cache
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callVesselFinder(apiKey: string, containerNumber: string, sealine?: string | null) {
  const path = sealine
    ? `${VF_BASE}/container/${apiKey}/${encodeURIComponent(containerNumber)}/${encodeURIComponent(sealine)}`
    : `${VF_BASE}/container/${apiKey}/${encodeURIComponent(containerNumber)}`;
  const res = await fetch(path, { method: "GET" });
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  return { httpStatus: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vfKey = Deno.env.get("VESSELFINDER_API_KEY");
    if (!vfKey) return json({ error: "VESSELFINDER_API_KEY not configured" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);

    // Admin gate (use service role to bypass RLS)
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin only" }, 403);
    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const action = body.action;

    if (action === "list") {
      const { data, error } = await admin
        .from("vesselfinder_tracking")
        .select("container_id, status, enabled, last_polled_at, container_number_override");
      if (error) return json({ error: error.message }, 500);
      return json({ items: data ?? [] });
    }

    if (!body.containerId) return json({ error: "containerId required" }, 400);

    if (action === "disable") {
      const { error } = await admin
        .from("vesselfinder_tracking")
        .update({ enabled: false })
        .eq("container_id", body.containerId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "get") {
      const { data, error } = await admin
        .from("vesselfinder_tracking")
        .select("*")
        .eq("container_id", body.containerId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ tracking: data });
    }

    if (action === "enable" || action === "refresh") {
      const containerNumber = (body.containerNumber || "").trim().toUpperCase();
      if (!containerNumber) return json({ error: "containerNumber required" }, 400);
      const sealine = (body.sealine || "").trim().toUpperCase() || null;

      // Upsert row first so we always have state
      const { data: existing } = await admin
        .from("vesselfinder_tracking")
        .select("*")
        .eq("container_id", body.containerId)
        .maybeSingle();

      // Cache: skip API call if last_polled_at < 60s ago AND not force
      const now = Date.now();
      const lastPolled = existing?.last_polled_at ? new Date(existing.last_polled_at).getTime() : 0;
      const sameContainer = existing?.container_number_override === containerNumber;
      const sameSealine = (existing?.sealine || null) === sealine;
      if (
        !body.force &&
        action === "refresh" &&
        existing?.status === "success" &&
        sameContainer &&
        sameSealine &&
        now - lastPolled < 60_000
      ) {
        return json({ tracking: existing, cached: true });
      }

      // Call VesselFinder
      const { httpStatus, body: vfBody } = await callVesselFinder(vfKey, containerNumber, sealine);

      let status = "error";
      let errorCode: string | null = null;
      let errorMessage: string | null = null;
      let response: any = vfBody;

      if (httpStatus === 200 && vfBody?.status === "success") {
        status = "success";
      } else if (httpStatus === 202 && (vfBody?.status === "queued" || vfBody?.status === "processing")) {
        status = vfBody.status;
      } else {
        status = "error";
        errorCode = vfBody?.errorCode || `HTTP_${httpStatus}`;
        errorMessage = vfBody?.errorDescription || `VesselFinder error (HTTP ${httpStatus})`;
      }

      const upsertPayload = {
        container_id: body.containerId,
        container_number_override: containerNumber,
        sealine,
        enabled: true,
        status,
        error_code: errorCode,
        error_message: errorMessage,
        response,
        last_polled_at: new Date().toISOString(),
        created_by: existing?.created_by || userId,
      };

      const { data: saved, error: upErr } = await admin
        .from("vesselfinder_tracking")
        .upsert(upsertPayload, { onConflict: "container_id" })
        .select("*")
        .maybeSingle();
      if (upErr) return json({ error: upErr.message }, 500);

      return json({ tracking: saved, vfHttpStatus: httpStatus });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("vesselfinder-track error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
