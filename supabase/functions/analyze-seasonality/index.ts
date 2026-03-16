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
    const { farmSummaries } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert horticultural meteorologist and post-harvest quality analyst for the cut flower industry in East Africa (primarily Kenya). You specialize in interpreting how seasonal weather patterns — rain, temperature swings, humidity, pest pressure, disease — manifest in post-harvest quality data and field staff observations.

Your task is to analyze 10 weeks of multi-farm post-harvest data to deduce the prevailing weather/seasonality conditions during that period. You are NOT analyzing individual farm performance — you are looking for CROSS-FARM patterns that reveal environmental conditions.

Key signals to look for:
- **Staff notes (qualityFlowersNote, protocolChangesNote, generalComment)**: These are GOLD. Staff mention pests, diseases, weather effects, and flower conditions that directly indicate weather.
- **Humidity patterns**: High humidity across many farms suggests rainy season; low humidity suggests dry season.
- **Quality rating trends**: Widespread quality drops often correlate with weather stress.
- **Temperature readings**: Cold store temps are controlled, but intake temps before cold storage can indicate ambient conditions.
- **EC and water quality shifts**: Heavy rains dilute water sources; dry spells concentrate salts.

**CRITICAL — Pest & Disease Identification**:
You MUST carefully scan ALL staff notes for mentions of these specific pests and diseases. Look for exact names, abbreviations, misspellings, and contextual references:

DISEASES (fungal/bacterial):
- **Botrytis** (grey mold, botrytis cinerea) — thrives in high humidity/cool temps, causes grey fuzzy growth on petals
- **Powdery mildew** (PM, white powder on leaves) — favors warm days + cool nights with moderate humidity
- **Downy mildew** (DM, underside leaf growth) — favors cool, wet, humid conditions
- **Rust** — orange/brown pustules, favors moisture on leaves

PESTS (insects/mites):
- **FCM** (False Codling Moth) — moth larvae boring into stems/buds
- **Caterpillars** (various species, leaf/bud damage, frass visible)
- **Thrips** (trips, thripes, silver/brown streaking on petals, major quality issue)
- **Spider mites** (two-spotted mite, red spider mite, webbing, stippling on leaves) — thrive in hot dry conditions
- **Aphids** — cluster on new growth, honeydew
- **Whitefly** — small white flying insects, honeydew, sooty mold

For EACH pest or disease found in the data, report:
- Which specific farms mentioned it
- Which weeks it was observed
- Whether incidence is increasing, stable, or decreasing over the period
- The likely environmental driver (e.g., "high humidity favoring Botrytis")

East African flower growing seasons context:
- **Long rains**: March–May (heavy rainfall, high humidity, increased Botrytis and downy mildew risk)
- **Dry warm**: June–September (lower humidity, more thrips/spider mites, sunburn risk)
- **Short rains**: October–December (moderate rainfall, mixed pest pressure)
- **Dry cool**: January–February (lower temps, better quality generally, but frost risk at altitude)

Analyze the data and provide:
1. A weekly weather/conditions assessment
2. Detailed pest & disease incidence tracking with farm-level detail
3. A quality impact score per week (1-10, where 10 = severe negative impact)
4. Overall seasonal summary and outlook

Return as JSON using the tool provided.`;

    const userPrompt = `Analyze the following multi-farm post-harvest quality data from the last 10 weeks (YYWW format, current week ~2612, covering roughly January–March 2026). This is cut flower data from East African farms.

Focus on CROSS-FARM patterns to deduce weather/seasonality conditions. Pay special attention to staff notes — they contain direct observations about pests, diseases, rain damage, and flower conditions.

Farm data from ${farmSummaries.length} farms:
${JSON.stringify(farmSummaries, null, 2)}

Deduce the weather patterns, pest/disease pressure, and seasonal conditions from this data. Identify which weeks had the most weather impact on flower quality.`;

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
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_seasonality",
                description: "Report seasonality and weather pattern analysis for cut flower farms",
                parameters: {
                  type: "object",
                  properties: {
                    weeklyAssessment: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          weekNr: { type: "number" },
                          weatherSummary: { type: "string", description: "Brief weather/conditions description for this week" },
                          qualityImpactScore: { type: "number", description: "1-10 scale, 10 = severe negative impact" },
                          keyObservations: { type: "array", items: { type: "string" }, description: "Notable observations from staff or data" },
                        },
                        required: ["weekNr", "weatherSummary", "qualityImpactScore", "keyObservations"],
                        additionalProperties: false,
                      },
                    },
                    pestAndDisease: {
                      type: "array",
                      description: "Each pest or disease observed in staff notes, with farm-level detail",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Pest or disease name (e.g. Botrytis, Thrips, FCM, Powdery Mildew)" },
                          category: { type: "string", enum: ["disease", "pest"], description: "Whether this is a disease or pest" },
                          severity: { type: "string", enum: ["low", "moderate", "high"] },
                          trend: { type: "string", enum: ["increasing", "stable", "decreasing"], description: "Whether incidence is increasing, stable, or decreasing over the period" },
                          weeksObserved: { type: "array", items: { type: "number" } },
                          farmsAffected: { type: "array", items: { type: "string" }, description: "Names of farms where this was observed" },
                          environmentalDriver: { type: "string", description: "Likely environmental cause (e.g. high humidity, dry conditions)" },
                          notes: { type: "string" },
                        },
                        required: ["name", "category", "severity", "trend", "weeksObserved", "farmsAffected", "environmentalDriver", "notes"],
                        additionalProperties: false,
                      },
                    },
                    seasonalSummary: { type: "string", description: "Overall 2-3 paragraph summary of the seasonal conditions during this period" },
                    outlook: { type: "string", description: "What to expect in the coming 2-4 weeks based on seasonal patterns" },
                    averageQualityByWeek: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          weekNr: { type: "number" },
                          avgQualityRating: { type: "number", description: "Average quality rating across farms (1-3 scale)" },
                        },
                        required: ["weekNr", "avgQualityRating"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["weeklyAssessment", "pestAndDisease", "seasonalSummary", "outlook", "averageQualityByWeek"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "report_seasonality" },
          },
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

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(result));
      return new Response(
        JSON.stringify({ error: "AI did not return structured analysis" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-seasonality error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
