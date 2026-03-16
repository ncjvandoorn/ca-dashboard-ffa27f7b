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
    const { messages, farmData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a data analyst for Chrysal's cut flower post-harvest quality monitoring system. You have access to farm quality report data and can answer questions about farm performance, trends, and quality metrics.

You understand the following data fields for each weekly quality report per farm:
- **pH (Intake & Export)**: Water pH. Ideal 3.5–5.0. Above 5.5 = bacterial risk.
- **EC (Intake & Export)**: Electrical Conductivity in μS/cm. Ideal 200–800. High = stem blockage risk.
- **Cold store temperature (Intake & Export)**: Should be 1–4°C. Spikes above 6°C = quality risk.
- **Cold store humidity (Intake & Export)**: Should be 80–95%. Below 70% = dehydration. Above 95% = Botrytis risk.
- **Quality rating**: 1=Good, 2=Average, 3=Bad.
- **Water quality rating**: Same scale.
- **Processing speed rating**: Same scale.
- **Stem length & head size**: Measured values.
- **Cold store hours**: Time spent in cold storage.
- **Quality flowers note**: Staff observations about flower quality (diseases, damage, pests).
- **Protocol changes note**: Staff observations about protocol deviations.
- **General comment**: Additional sign-off notes.

When answering:
1. Be specific — cite farm names, week numbers, and actual values.
2. When asked for tables, format them as markdown tables.
3. When asked about trends, describe direction and magnitude.
4. Be concise but thorough. Use bullet points for lists.
5. If the data doesn't contain enough information to answer, say so clearly.

The data provided covers quality reports with weekly readings. The weekNr format is YYWW (e.g., 2612 = week 12 of 2026).`;

    const userContextMessage = farmData
      ? `Here is the current farm quality data I have access to:\n\n${JSON.stringify(farmData, null, 1)}\n\nPlease use this data to answer the user's questions.`
      : "No farm data is currently available.";

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
