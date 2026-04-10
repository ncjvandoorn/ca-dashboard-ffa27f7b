import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, farmData, staffSummary, exceptionAnalysis, seasonalityAnalysis, weeklyPlans } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch admin AI instructions
    let adminInstructions = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/rest/v1/ai_instructions?select=instructions&limit=1`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows?.[0]?.instructions) adminInstructions = rows[0].instructions;
      }
    } catch (_) { /* ignore */ }

    const systemPrompt = `You are a data analyst for Chrysal's cut flower post-harvest quality monitoring system. You have access to the COMPLETE farm quality report dataset across ALL years, staff attribution data, CRM activities, and AI-generated insights.
${adminInstructions ? `\n**ADMIN INSTRUCTIONS (follow these closely):**\n${adminInstructions}\n` : ""}

DATA FORMAT — each farm has "d" (weekly data array) with abbreviated keys:
w=weekNr(YYWW), iPh=intakePH, iEc=intakeEC, iT=intakeTemp, iH=intakeHumidity, ePh=exportPH, eEc=exportEC, eT=exportTemp, eH=exportHumidity, qR=qualityRating(1=Good,2=Avg,3=Bad), wQ=waterQuality, pS=processingSpeed, sL=stemLength, hS=headSize, cH=coldStoreHours, qN=qualityNote, pN=protocolNote, gC=generalComment, cBy=createdBy(person name), sby=submittedBy(person name), pQ=packingQuality, pR=packrate, eWQ=exportWaterQuality, eCH=exportColdStoreHours.

STAFF SUMMARY — a pre-aggregated table showing each person's total reportsCreated, reportsSubmitted, and number of farms they cover. Use this for "who did the most reports" type questions.

IDEAL RANGES: pH 3.5–5.0 (>5.5=bacterial risk), EC 200–800 μS/cm, Temp 1–4°C (>6°C=risk), Humidity 80–95%.

**CRITICAL ANTI-HALLUCINATION RULES — YOU MUST FOLLOW THESE:**
1. **ONLY cite data that exists in the provided dataset.** Never invent farm names, week numbers, values, person names, or observations.
2. **If you cannot find the answer in the data, say "I don't have data on that" or "That information is not in the dataset."** Never guess or approximate.
3. **When citing a specific value (pH, EC, temp, etc.), it MUST exist in the data you received.** Double-check before stating any number.
4. **When referencing staff notes, ONLY quote or paraphrase text that actually appears in the qN, pN, or gC fields.** Never fabricate staff observations.
5. **Do NOT extrapolate trends beyond what the data shows.** If you only have 3 weeks of data for a farm, do not claim a "consistent trend over many months."
6. **When asked about something not covered by the data, clearly state the limitation** rather than making up a plausible-sounding answer.
7. **Never invent CRM activities, meetings, or interactions** that are not in the provided activities data.

When answering:
1. Be specific — cite farm names, week numbers, actual values, and person names FROM THE DATA.
2. Format tables as markdown tables when asked.
3. For attribution questions (who created/submitted reports), use the staffSummary data AND the cBy/sby fields in weekly data.
4. Be concise but thorough. Use bullet points for lists.
5. If data is insufficient, say so clearly.
6. Use CRM activity data and AI exception/seasonality reports for richer context — but only if provided.
7. Suggest post-harvest products for water/pH/EC issues, protocol improvements for handling/temperature/humidity.
8. **ALWAYS USE ALL AVAILABLE DATA SOURCES** when answering questions. This includes:
   - Farm quality report data (weekly measurements, staff notes, quality ratings)
   - Staff attribution summary (who created/submitted reports)
   - CRM activity data (meetings, visits, interactions)
   - Exception Report analysis (farms needing attention, top performers, critical issues)
   - Seasonality Report analysis (pest & disease trends, weather patterns, weekly quality impact scores)
   - Weekly Planner data (AI-generated action plans with urgent visits, suggested activities, workload assessments per week)
   Cross-reference these sources to give comprehensive, multi-dimensional answers. For example, when asked about team follow-up on weekly plans, compare the suggested activities from a past week's plan with actual CRM activities completed since then.`;

    let userContextMessage = farmData
      ? `Farm quality data (compressed):\n${JSON.stringify(farmData)}`
      : "No farm data available.";

    if (staffSummary) {
      userContextMessage += `\n\nStaff report attribution summary:\n${JSON.stringify(staffSummary)}`;
    }
    if (exceptionAnalysis) {
      userContextMessage += `\n\nException Report:\n${JSON.stringify(exceptionAnalysis)}`;
    }
    if (seasonalityAnalysis) {
      userContextMessage += `\n\nSeasonality Report:\n${JSON.stringify(seasonalityAnalysis)}`;
    }

    const allMessages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: userContextMessage },
      ...messages,
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: allMessages,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
