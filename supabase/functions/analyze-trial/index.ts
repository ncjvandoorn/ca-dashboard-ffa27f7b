import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { headerId, refresh } = await req.json();
    if (!headerId) {
      return new Response(JSON.stringify({ error: "headerId required" }), {
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

    // Return cache unless refresh
    if (!refresh) {
      const { data: cached } = await admin
        .from("vaselife_trial_ai_analysis")
        .select("*")
        .eq("header_id", headerId)
        .maybeSingle();
      if (cached) {
        return new Response(JSON.stringify({ analysis: cached.analysis, cached: true, updated_at: cached.updated_at }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch trial data
    const [{ data: header }, { data: vases }, { data: measurements }] = await Promise.all([
      admin.from("vaselife_headers").select("*").eq("id", headerId).maybeSingle(),
      admin.from("vaselife_vases").select("*").eq("id_header", headerId),
      admin.from("vaselife_measurements").select("*").eq("id_header", headerId),
    ]);

    if (!header) {
      return new Response(JSON.stringify({ error: "Trial not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional global AI instructions
    const { data: instr } = await admin.from("ai_instructions").select("instructions").maybeSingle();

    // Build per-treatment property averages
    const propAvg = new Map<string, Map<number, { sum: number; n: number }>>();
    for (const m of measurements || []) {
      if (!m.property_name || m.score == null || m.treatment_no == null) continue;
      if (/^\s*(average|avg|gemiddelde|mean)\b/i.test(m.cultivar || "")) continue;
      if (!propAvg.has(m.property_name)) propAvg.set(m.property_name, new Map());
      const tMap = propAvg.get(m.property_name)!;
      const cur = tMap.get(m.treatment_no) || { sum: 0, n: 0 };
      cur.sum += Number(m.score);
      cur.n += 1;
      tMap.set(m.treatment_no, cur);
    }
    const propTable: Record<string, Record<string, number>> = {};
    for (const [prop, tMap] of propAvg) {
      propTable[prop] = {};
      for (const [tn, { sum, n }] of tMap) {
        propTable[prop][`T${tn}`] = +(sum / n).toFixed(2);
      }
    }

    // Treatment names
    const tNames: Record<string, string> = {};
    for (const v of vases || []) {
      if (v.treatment_no != null && v.treatment_name && !tNames[`T${v.treatment_no}`]) {
        tNames[`T${v.treatment_no}`] = v.treatment_name;
      }
    }

    // Treatment-level FVL/Bot/Flo aggregates
    const tAgg: Record<string, { flv: number[]; bot: number[]; flo: number[] }> = {};
    for (const v of vases || []) {
      if (v.treatment_no == null) continue;
      if (/^\s*(average|avg|gemiddelde|mean)\b/i.test(v.cultivar || "")) continue;
      const k = `T${v.treatment_no}`;
      if (!tAgg[k]) tAgg[k] = { flv: [], bot: [], flo: [] };
      if (v.flv_days != null) tAgg[k].flv.push(Number(v.flv_days));
      if (v.bot_percentage != null) tAgg[k].bot.push(Number(v.bot_percentage));
      if (v.flo_percentage != null) tAgg[k].flo.push(Number(v.flo_percentage));
    }
    const avg = (a: number[]) => (a.length ? +(a.reduce((s, n) => s + n, 0) / a.length).toFixed(2) : null);
    const tSummary: Record<string, { vl_days: number | null; bot_pct: number | null; flo_pct: number | null }> = {};
    for (const k in tAgg) {
      tSummary[k] = { vl_days: avg(tAgg[k].flv), bot_pct: avg(tAgg[k].bot), flo_pct: avg(tAgg[k].flo) };
    }

    const payload = {
      trial_number: header.trial_number,
      crop: header.crop,
      farm: header.farm,
      customer: header.customer,
      objective: header.objective,
      spec_comments: header.spec_comments,
      conclusion_by_team: header.conclusion,
      recommendations_by_team: header.recommendations,
      treatments: tNames,
      treatment_outcomes: tSummary,
      property_scores_per_treatment: propTable,
    };

    const systemPrompt = `You are a senior post-harvest plant scientist analysing a vaselife trial.
Scoring convention: most properties use a 1-5 scale where 5 = best/healthiest. Exceptions: FLO is neutral, CVW is damage (high = bad).
Your job:
1. Read the team's existing conclusion carefully — they are top experts and usually correct.
2. Look closely at per-property scores per treatment. Surface NUANCED insights the team's headline conclusion may not have emphasised:
   - e.g. "Treatment 1 won on vase life, but Treatment 2 scored notably higher on flower colour and leaf quality."
   - Trade-offs, secondary winners, weak spots, consistency across cultivars.
3. Be precise — cite property codes and treatment numbers and the actual averaged scores.
4. CRITICAL HONESTY: If the data does not support an interesting extra insight beyond the team's conclusion, SAY SO plainly. Never fabricate. It is fine to write "The team's conclusion is well-supported and there is no meaningful counter-signal in the property scores."
5. Keep it concise, structured with markdown headings and bullets. No fluff.
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
          { role: "user", content: `Analyse this vaselife trial:\n\n${JSON.stringify(payload, null, 2)}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      return new Response(JSON.stringify({ error: `AI error: ${aiRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiRes.json();
    const analysis: string = aiJson?.choices?.[0]?.message?.content?.trim() || "";
    if (!analysis) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("vaselife_trial_ai_analysis").upsert(
      {
        header_id: headerId,
        analysis,
        model: "google/gemini-2.5-pro",
        created_by: userData.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "header_id" },
    );

    return new Response(JSON.stringify({ analysis, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-trial error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
