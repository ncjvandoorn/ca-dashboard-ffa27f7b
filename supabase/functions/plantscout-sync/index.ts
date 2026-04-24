// Sync Vaselife trial data from Plantscout API into vaselife_* tables.
// Admin/internal-staff only. Triggered manually from Admin UI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLANTSCOUT_BASE = "https://plantscout-api.net/api";
const EXPORT_IDS = {
  headers: "25baa6b4-565d-468b-aac5-03a00ad7bf21",
  vases: "9dad8543-2b07-4901-9191-03a00af200fd",
  measurements: "53d6018b-2ae6-4104-bbfa-03a00b0285f2",
};

function toDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  // Accept full ISO or date-only
  return t.length >= 10 ? t.slice(0, 10) : null;
}
function toTs(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  return v;
}
function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

async function fetchExport(exportId: string, apiKey: string) {
  const url = `${PLANTSCOUT_BASE}/DownloadData?exportDefinitionId=${exportId}`;
  const resp = await fetch(url, { headers: { "X-API-Key": apiKey } });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Plantscout ${exportId} → ${resp.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as any[];
  } catch {
    throw new Error(`Plantscout ${exportId} returned non-JSON`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("PLANTSCOUT_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "PLANTSCOUT_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify caller is admin/internal staff
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supaUser.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (userErr || !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await supaUser.from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roles || []).some((r: any) => ["admin", "user", "ta"].includes(r.role));
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service-role client for upserts (bypass RLS cleanly)
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Headers
    const headersRaw = await fetchExport(EXPORT_IDS.headers, apiKey);
    const headerRows = headersRaw
      .filter((h: any) => h?.id)
      .map((h: any) => ({
        id: h.id,
        trial_number: toStr(h.trialNumber),
        farm: toStr(h.farm),
        customer: toStr(h.customer),
        freight_type: toStr(h.freightType),
        initial_quality: toStr(h.initialQuality),
        harvest_date: toDate(h.harvestDate),
        start_seafreight: toDate(h.startSeafreight),
        start_transport: toDate(h.startTransport),
        start_retail: toDate(h.startRetail),
        start_vl: toDate(h.startVl),
        stems_per_vase: toInt(h.stemsPervase ?? h.stemsPerVase),
        crop: toStr(h.crop),
        cultivar_count: toInt(h.cultivarCount),
        treatment_count: toInt(h.treatmentCount),
        vases_per_treatment: toInt(h.vasesPerTreatment),
        total_vases: toInt(h.totalVases),
        objective: toStr(h.objective),
        spec_comments: toStr(h.specComments),
        conclusion: toStr(h.conclusion),
        recommendations: toStr(h.recommendations),
        source_date: toTs(h.date),
        updated_at: new Date().toISOString(),
      }));

    // 2) Vases
    const vasesRaw = await fetchExport(EXPORT_IDS.vases, apiKey);
    const vaseRows = vasesRaw
      .filter((v: any) => v?.idLine && v?.idHeader)
      .map((v: any) => ({
        id_line: String(v.idLine),
        id_header: String(v.idHeader),
        cultivar: toStr(v.cultivar),
        id_cultivar: toStr(v.idCultivar),
        treatment_no: toInt(v.treatmentNo),
        vase_count: toInt(v.vaseCount),
        treatment_name: toStr(v.treatmentName),
        id_greenhouse: toStr(v.idGreenhouse),
        id_dipping: toStr(v.idDipping),
        id_pulsing: toStr(v.idPulsing),
        post_harvest: toStr(v.postHarvest),
        store_phase: toStr(v.storePhase),
        consumer_phase: toStr(v.consumerPhase),
        climate_room: toStr(v.climateRoom),
        flv_days: toNum(v.flvDays),
        bot_percentage: toNum(v.botPercentage),
        flo_percentage: toNum(v.floPercentage),
        source_date: toTs(v.date),
      }));

    // 3) Measurements
    const measRaw = await fetchExport(EXPORT_IDS.measurements, apiKey);
    const measRows = measRaw
      .filter((m: any) => m?.idLineProperty && m?.idHeader && m?.idLine)
      .map((m: any) => ({
        id_line_property: String(m.idLineProperty),
        id_line: String(m.idLine),
        id_header: String(m.idHeader),
        cultivar: toStr(m.cultivar),
        id_cultivar: toStr(m.idCultivar),
        treatment_no: toInt(m.treatmentNo),
        id_property: toStr(m.idProperty),
        property_name: toStr(m.propertyName),
        observation_count: toInt(m.observationCount),
        observation_days: toInt(m.observationDays),
        score: toNum(m.score),
        source_date: toTs(m.date),
      }));

    // Ensure stub headers exist for any header IDs referenced by vases/measurements
    // but missing from the headers export (matches existing seeding behaviour).
    const knownHeaderIds = new Set(headerRows.map((h) => h.id));
    const referencedIds = new Set<string>();
    vaseRows.forEach((v) => referencedIds.add(v.id_header));
    measRows.forEach((m) => referencedIds.add(m.id_header));
    const stubRows = [...referencedIds]
      .filter((id) => !knownHeaderIds.has(id))
      .map((id) => ({
        id,
        trial_number: "(missing from export)",
        updated_at: new Date().toISOString(),
      }));

    // Upsert in batches
    const allHeaders = [...headerRows, ...stubRows];
    const chunks = <T,>(arr: T[], n: number) =>
      Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

    const upsert = async (table: string, rows: any[], conflict: string) => {
      let total = 0;
      for (const batch of chunks(rows, 500)) {
        const { error, count } = await supa
          .from(table)
          .upsert(batch, { onConflict: conflict, count: "exact" });
        if (error) throw new Error(`${table} upsert: ${error.message}`);
        total += count ?? batch.length;
      }
      return total;
    };

    const headersUpserted = await upsert("vaselife_headers", allHeaders, "id");
    const vasesUpserted = await upsert("vaselife_vases", vaseRows, "id_line");
    const measUpserted = await upsert("vaselife_measurements", measRows, "id_line_property");

    return new Response(
      JSON.stringify({
        ok: true,
        synced_at: new Date().toISOString(),
        headers: { fetched: headerRows.length, stubs: stubRows.length, upserted: headersUpserted },
        vases: { fetched: vaseRows.length, upserted: vasesUpserted },
        measurements: { fetched: measRows.length, upserted: measUpserted },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("plantscout-sync error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
