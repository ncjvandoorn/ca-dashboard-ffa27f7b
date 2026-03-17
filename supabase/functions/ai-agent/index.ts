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
    const { messages, farmData, staffSummary, exceptionAnalysis, seasonalityAnalysis } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a data analyst for Chrysal's cut flower post-harvest quality monitoring system. You have access to the COMPLETE farm quality report dataset across ALL years, staff attribution data, CRM activities, and AI-generated insights.

DATA FORMAT — each farm has "d" (weekly data array) with abbreviated keys:
w=weekNr(YYWW), iPh=intakePH, iEc=intakeEC, iT=intakeTemp, iH=intakeHumidity, ePh=exportPH, eEc=exportEC, eT=exportTemp, eH=exportHumidity, qR=qualityRating(1=Good,2=Avg,3=Bad), wQ=waterQuality, pS=processingSpeed, sL=stemLength, hS=headSize, cH=coldStoreHours, qN=qualityNote, pN=protocolNote, gC=generalComment, cBy=createdBy(person name), sby=submittedBy(person name), pQ=packingQuality, pR=packrate, eWQ=exportWaterQuality, eCH=exportColdStoreHours.

STAFF SUMMARY — a pre-aggregated table showing each person's total reportsCreated, reportsSubmitted, and number of farms they cover. Use this for "who did the most reports" type questions.

IDEAL RANGES: pH 3.5–5.0 (>5.5=bacterial risk), EC 200–800 μS/cm, Temp 1–4°C (>6°C=risk), Humidity 80–95%.

When answering:
1. Be specific — cite farm names, week numbers, actual values, and person names.
2. Format tables as markdown tables when asked.
3. For attribution questions (who created/submitted reports), use the staffSummary data AND the cBy/sby fields in weekly data.
4. Be concise but thorough. Use bullet points for lists.
5. If data is insufficient, say so clearly.
6. Use CRM activity data and AI exception/seasonality reports for richer context.
7. Suggest post-harvest products for water/pH/EC issues, protocol improvements for handling/temperature/humidity.`;

    let userContextMessage = farmData
      ? `Farm quality data (compressed):\n${JSON.stringify(farmData)}`
      : "No farm data available.";

    if (staffSummary) {
      userContextMessage += `\n\nStaff report attribution summary:\n${JSON.stringify(staffSummary)}`;
    }

    if (exceptionAnalysis) {
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
