import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { Anonymizer } from "../_shared/anonymize.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { headerIds } = await req.json();
    if (!Array.isArray(headerIds) || headerIds.length === 0) {
      return new Response(JSON.stringify({ error: "headerIds required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: headers }, { data: vases }, { data: measurements }] = await Promise.all([
      admin.from("vaselife_headers").select("*").in("id", headerIds),
      admin.from("vaselife_vases").select("*").in("id_header", headerIds),
      admin.from("vaselife_measurements").select("*").in("id_header", headerIds),
    ]);

    if (!headers || headers.length === 0) {
      return new Response(JSON.stringify({ error: "No trials found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAvg = (s: string | null) => /^\s*(average|avg|gemiddelde|mean)\b/i.test(s || "");
    const avg = (a: number[]) => (a.length ? +(a.reduce((s, n) => s + n, 0) / a.length).toFixed(2) : null);

    // Aggregate by treatment_name (across trials)
    const byTreatment: Record<string, {
      trials: Set<string>;
      crops: Set<string>;
      flv: number[];
      bot: number[];
      flo: number[];
      props: Record<string, number[]>;
    }> = {};
    for (const v of vases || []) {
      if (isAvg(v.cultivar)) continue;
      const name = (v.treatment_name || "").trim();
      if (!name) continue;
      if (!byTreatment[name]) {
        byTreatment[name] = { trials: new Set(), crops: new Set(), flv: [], bot: [], flo: [], props: {} };
      }
      byTreatment[name].trials.add(v.id_header);
      const h = headers.find((x: any) => x.id === v.id_header);
      if (h?.crop) byTreatment[name].crops.add(h.crop);
      if (v.flv_days != null) byTreatment[name].flv.push(Number(v.flv_days));
      if (v.bot_percentage != null) byTreatment[name].bot.push(Number(v.bot_percentage));
      if (v.flo_percentage != null) byTreatment[name].flo.push(Number(v.flo_percentage));
    }
    // Build a treatment_no -> name index per header for measurements
    const tNameByKey = new Map<string, string>();
    for (const v of vases || []) {
      if (v.treatment_no != null && v.treatment_name) {
        tNameByKey.set(`${v.id_header}|${v.treatment_no}`, v.treatment_name.trim());
      }
    }
    for (const m of measurements || []) {
      if (!m.property_name || m.score == null || m.treatment_no == null) continue;
      if (isAvg(m.cultivar)) continue;
      const name = tNameByKey.get(`${m.id_header}|${m.treatment_no}`);
      if (!name || !byTreatment[name]) continue;
      if (!byTreatment[name].props[m.property_name]) byTreatment[name].props[m.property_name] = [];
      byTreatment[name].props[m.property_name].push(Number(m.score));
    }

    const treatmentTable = Object.entries(byTreatment).map(([name, d]) => ({
      treatment: name,
      trial_count: d.trials.size,
      crops: Array.from(d.crops),
      vl_days: avg(d.flv),
      bot_pct: avg(d.bot),
      flo_pct: avg(d.flo),
      property_scores: Object.fromEntries(Object.entries(d.props).map(([k, v]) => [k, avg(v)])),
    })).sort((a, b) => (b.vl_days ?? 0) - (a.vl_days ?? 0));

    // Aggregate by crop (across trials)
    const byCrop: Record<string, {
      trials: Set<string>;
      treatments: Set<string>;
      flv: number[];
      bot: number[];
      flo: number[];
      props: Record<string, number[]>;
    }> = {};
    for (const v of vases || []) {
      if (isAvg(v.cultivar)) continue;
      const h = headers.find((x: any) => x.id === v.id_header);
      const crop = (h?.crop || "").trim();
      if (!crop) continue;
      if (!byCrop[crop]) {
        byCrop[crop] = { trials: new Set(), treatments: new Set(), flv: [], bot: [], flo: [], props: {} };
      }
      byCrop[crop].trials.add(v.id_header);
      if (v.treatment_name) byCrop[crop].treatments.add(v.treatment_name.trim());
      if (v.flv_days != null) byCrop[crop].flv.push(Number(v.flv_days));
      if (v.bot_percentage != null) byCrop[crop].bot.push(Number(v.bot_percentage));
      if (v.flo_percentage != null) byCrop[crop].flo.push(Number(v.flo_percentage));
    }
    for (const m of measurements || []) {
      if (!m.property_name || m.score == null) continue;
      if (isAvg(m.cultivar)) continue;
      const h = headers.find((x: any) => x.id === m.id_header);
      const crop = (h?.crop || "").trim();
      if (!crop || !byCrop[crop]) continue;
      if (!byCrop[crop].props[m.property_name]) byCrop[crop].props[m.property_name] = [];
      byCrop[crop].props[m.property_name].push(Number(m.score));
    }
    const cropTable = Object.entries(byCrop).map(([crop, d]) => ({
      crop,
      trial_count: d.trials.size,
      treatment_count: d.treatments.size,
      vl_days: avg(d.flv),
      bot_pct: avg(d.bot),
      flo_pct: avg(d.flo),
      property_scores: Object.fromEntries(Object.entries(d.props).map(([k, v]) => [k, avg(v)])),
    })).sort((a, b) => (b.vl_days ?? 0) - (a.vl_days ?? 0));

    // Optional global AI instructions
    const { data: instr } = await admin.from("ai_instructions").select("instructions").maybeSingle();

    const trialMeta = headers.map((h: any) => ({
      trial_number: h.trial_number,
      crop: h.crop,
      farm: h.farm,
      customer: h.customer,
      objective: h.objective,
      conclusion: h.conclusion,
      recommendations: h.recommendations,
    }));

    const payload = {
      trials: trialMeta,
      by_treatment: treatmentTable,
      by_crop: cropTable,
    };

    const systemPrompt = `You are a senior post-harvest plant scientist synthesising findings ACROSS MULTIPLE vaselife trials.
Scoring: most properties 1-5 where 5 = best. Exceptions: FLO neutral, CVW damage (high = bad).

Generate a FRESH combined analysis treating all selected trials as one dataset. Do NOT just repeat individual trial conclusions — synthesise across them.

STRICT FORMAT — output exactly these four sections, each separated by a blank line, with the bold label on its own line followed by content on the next line(s):

**Combined verdict**

One sentence summarising the strongest signal across all selected trials.

**By treatment**

- 2-4 bullets identifying which treatment(s) consistently win/lose across trials and crops.
- Reference treatment names and key metrics (e.g. "AVB @5mL/L: 8.2 vl-days across 4 trials, top FLC 4.3").

**By crop**

- 2-4 bullets describing how outcomes differ between crops in the dataset.

**Recommendation**

One concrete recommendation supported by the combined dataset.

Hard rules:
- Maximum ~180 words total. No other headings. No preamble.
- If treatments or crops are too few/heterogeneous to draw a conclusion, say so plainly — never fabricate.
${instr?.instructions ? `\nGlobal instructions:\n${instr.instructions}` : ""}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyse this combined dataset of ${headers.length} trials:\n\n${JSON.stringify(payload, null, 2)}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      return new Response(JSON.stringify({ error: `AI error: ${aiRes.status}`, treatmentTable, cropTable }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiRes.json();
    const analysis: string = aiJson?.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ analysis, treatmentTable, cropTable, trialCount: headers.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-trials-combo error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
