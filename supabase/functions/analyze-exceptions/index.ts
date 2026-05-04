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
    const { farmSummaries, weekRange } = await req.json();
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

    const systemPrompt = `You are an expert post-harvest quality analyst for the cut flower industry (roses, chrysanthemums, gerbera, etc.). You understand the entire cold chain from farm intake through cold storage, packhouse processing, dispatch/export, sea-freight transit and arrival at destination, AND you keep an eye on the commercial relationship (CRM activities) we have with each farm.
${adminInstructions ? `\n**ADMIN INSTRUCTIONS (follow these closely):**\n${adminInstructions}\n` : ""}

You are given THREE complementary data streams per farm. You must integrate all three into a single coherent analysis — never analyse them in isolation.

1. **Quality reports (recentWeeks / priorWeeks)** — weekly post-harvest readings.
   Abbreviated keys: w=weekNr(YYWW), iPh=intakePH, iEc=intakeEC, iT=intakeTemp, iH=intakeHumidity, ePh=exportPH, eEc=exportEC, eT=exportTemp, eH=exportHumidity, qR=qualityRating(1=Good,2=Avg,3=Bad), wQ=waterQuality, pS=processingSpeed, sL=stemLength, hS=headSize, cH=coldStoreHours, qN=qualityNote, pN=protocolNote, gC=generalComment.

2. **Shipper events (shipperEvents)** — sea-freight stuffing + arrival data tied to this farm via container service orders.
   Keys per event: w=weekNr, sd=stuffingDate, lm=loadingMin, gc=stuffingComments, ad=arrivalDate, dw=dischargeWaitingMin, aT=arrivalTemps, vT=afterVcTemps, vc=vcCycles, vd=vcDurationMin, ac=arrivalComments. High loading minutes, long discharge waits, arrival temps far above the cold-store target (>6°C) or stuffing/arrival comments mentioning damage/complaints are major red flags. Treat shipper comments with the same weight as staff quality notes.

3. **CRM activities (crmActivities)** — the most recent commercial/operational interactions our team had with the farm (visits, calls, emails, complaints, follow-ups).
   Keys per activity: d=date, t=type, s=subject, n=notes (truncated), u=assignedUserName, st=status. Use these to:
   - Confirm whether known issues are already being followed up (mention it explicitly).
   - Flag farms that show quality/shipper issues but have NO recent CRM contact — these need attention from the commercial team.
   - Pick up on farm-side complaints, protocol-change agreements, or trial follow-ups that contextualise the numbers.

Your domain expertise includes:
- **pH monitoring**: Ideal intake pH 3.5–5.0; drift above 5.5 accelerates bacterial growth.
- **EC**: Ideal 200–800 μS/cm. Too high blocks stems; too low = inadequate nutrition.
- **Cold store temperature**: Must stay 1–4°C. Spikes >6°C cause ethylene sensitivity. Big delta between intake/export cold stores or between export and arrival temps signals chain breaks.
- **Humidity**: 80–95% RH. <70% causes browning; >95% risks Botrytis.
- **Quality / water quality / processing speed ratings**: 1=Good, 2=Avg, 3=Bad. Repeated 2–3 = systemic issue.
- **Cold store hours**: too few = inadequate cooling; >24h = monitoring risk.
- **Sea-freight transit**: VC (vacuum cooling) cycles + duration matter; arrival temps must align with export cold-store temps.
- **Stem length / head size consistency**: variance > absolute values.

**CRITICAL — Staff & operator notes**: qualityFlowersNote (qN), protocolChangesNote (pN), generalComment (gC), shipper stuffing comments (gc), shipper arrival comments (ac) and CRM activity notes (n) are FIRST-HAND observations and outweigh the raw numbers. Always quote or paraphrase them when they support a finding.

When analyzing a farm, consider in this order:
1. **Staff / shipper / CRM observations first** — they're the most reliable signal.
2. **Cross-stream correlations** — e.g. a quality note about wilting + a high arrival temp from the shipper event the same week is a confirmed cold-chain break.
3. **Absolute deviations** in any stream.
4. **Trends over time** (worsening/improving) across weeks.
5. **Cross-parameter combinations** — high pH + low EC, high temp + low humidity, etc.
6. **Commercial coverage** — is there a recent CRM activity? If issues exist with no CRM follow-up, call it out in the details.
7. **Comparison to peers**.

Return your analysis as a JSON object with this exact structure:
{
  "needsAttention": [
    {
      "farmId": "uuid",
      "farmName": "string",
      "severity": "critical" | "warning",
      "summary": "One-sentence plain language summary of the core issue",
      "details": ["Specific finding 1", "Specific finding 2"],
      "affectedMetrics": ["pH", "EC", etc.]
    }
  ],
  "mostImproved": [
    {
      "farmId": "uuid",
      "farmName": "string",
      "summary": "One-sentence summary of what improved",
      "details": ["Specific improvement 1"],
      "improvedMetrics": ["pH", "Temperature", etc.]
    }
  ],
  "topPerformers": [
    {
      "farmId": "uuid",
      "farmName": "string",
      "summary": "One-sentence summary of why this farm stands out",
      "details": ["Specific strength 1"],
      "strongMetrics": ["pH", "Cold Chain", etc.]
    }
  ],
  "allFarmInsights": [
    {
      "farmId": "uuid",
      "farmName": "string",
      "status": "critical" | "warning" | "stable" | "good" | "excellent",
      "summary": "One-sentence assessment of the farm's overall quality status",
      "details": ["Key observation 1", "Key observation 2"],
      "keyMetrics": ["pH", "EC", etc.]
    }
  ],
  "industryInsight": "Overall observations split into 2-3 SHORT paragraphs separated by \\n\\n. First paragraph: key patterns. Second paragraph: main areas of concern. Third (optional): actionable recommendations. Each paragraph 2-3 sentences MAX."
}

IMPORTANT: The "allFarmInsights" array MUST contain an entry for EVERY farm in the input data, not just the exceptional ones. This provides a per-farm quality summary for each farm regardless of whether they appear in needsAttention, mostImproved, or topPerformers. Use these status levels:
- "critical": Serious issues requiring immediate action
- "warning": Notable concerns that should be monitored
- "stable": Performing adequately, no major concerns
- "good": Performing well across most metrics
- "excellent": Consistently outstanding performance

**CRITICAL ANTI-HALLUCINATION RULES — YOU MUST FOLLOW THESE:**
1. **ONLY reference data that is actually present in the input.** Never invent farm names, values, week numbers, or staff observations.
2. **Every numerical value you cite (pH, EC, temp, humidity, etc.) MUST come directly from the provided data.** Do not estimate, average, or fabricate values.
3. **When quoting or paraphrasing staff notes, ONLY use text that actually appears in qualityFlowersNote, protocolChangesNote, or generalComment fields.** Never invent staff observations.
4. **If a farm has insufficient data to draw conclusions, say so explicitly** in its summary rather than guessing.
5. **Do NOT infer pest/disease issues unless staff notes explicitly mention them.** Numerical anomalies alone should be reported as "parameter deviations" not assumed diagnoses.
6. **Do NOT fabricate improvement trends.** Only report improvement if the data clearly shows values moving from bad to good across sequential weeks.
7. **If fewer than 3 farms qualify for a category (needsAttention, mostImproved, topPerformers), return fewer.** Never pad lists with marginal cases.

Return at most 10 farms in needsAttention, mostImproved, and topPerformers. For "needsAttention", rank by severity (critical first, then warning). For "mostImproved", focus on farms that have shown the clearest positive trajectory over recent weeks. For "topPerformers", highlight farms that consistently outperform their peers. Only include farms where there is genuine signal — do not pad the lists. If fewer than 10 qualify, return fewer. Be specific and actionable in your findings.`;

    const now = new Date();
    const daysSinceSat = (now.getDay() + 1) % 7;
    const currentSat = new Date(now);
    currentSat.setDate(now.getDate() - daysSinceSat);
    currentSat.setHours(0, 0, 0, 0);
    const jan1 = new Date(currentSat.getFullYear(), 0, 1);
    const jan1DaysSinceSat = (jan1.getDay() + 1) % 7;
    const week1Sat = new Date(jan1);
    week1Sat.setDate(jan1.getDate() - jan1DaysSinceSat);
    week1Sat.setHours(0, 0, 0, 0);
    const currentWeekNr = Math.floor((currentSat.getTime() - week1Sat.getTime()) / (7 * 86400000)) + 1;
    const yr = currentSat.getFullYear() % 100;
    const currentWeekNrFmt = yr * 100 + currentWeekNr;

    const userPrompt = `Analyze the following farm quality data summaries from the last 12 available weeks of cut flower post-harvest monitoring.

Analysis week range (YYWW): ${weekRange?.min ?? "unknown"} to ${weekRange?.max ?? currentWeekNrFmt}.

Each farm summary includes weekly readings for intake and export cold store parameters, quality ratings, and other post-harvest metrics. **Pay special attention to the qualityFlowersNote, protocolChangesNote, and generalComment fields** — these are written by our experienced field staff and represent direct, first-hand observations. Reference them explicitly in your analysis when they provide relevant context.

Farm data:
${JSON.stringify(farmSummaries)}

Identify which farms need attention (worst performing, worsening trends, dangerous parameter combinations, staff-flagged issues) and which have shown the most improvement. Consider the full post-harvest context — don't just flag outliers mechanically, think about what combinations of metrics signal real risk to flower quality and vase life. Quote or paraphrase staff notes when they support your findings.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 140_000);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        signal: controller.signal,
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_exceptions",
                description:
                  "Report the exception analysis results for cut flower farms",
                parameters: {
                  type: "object",
                  properties: {
                    needsAttention: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          farmId: { type: "string" },
                          farmName: { type: "string" },
                          severity: {
                            type: "string",
                            enum: ["critical", "warning"],
                          },
                          summary: { type: "string" },
                          details: {
                            type: "array",
                            items: { type: "string" },
                          },
                          affectedMetrics: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                        required: [
                          "farmId",
                          "farmName",
                          "severity",
                          "summary",
                          "details",
                          "affectedMetrics",
                        ],
                        additionalProperties: false,
                      },
                    },
                    mostImproved: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          farmId: { type: "string" },
                          farmName: { type: "string" },
                          summary: { type: "string" },
                          details: {
                            type: "array",
                            items: { type: "string" },
                          },
                          improvedMetrics: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                        required: [
                          "farmId",
                          "farmName",
                          "summary",
                          "details",
                          "improvedMetrics",
                        ],
                        additionalProperties: false,
                      },
                    },
                    topPerformers: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          farmId: { type: "string" },
                          farmName: { type: "string" },
                          summary: { type: "string" },
                          details: {
                            type: "array",
                            items: { type: "string" },
                          },
                          strongMetrics: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                        required: [
                          "farmId",
                          "farmName",
                          "summary",
                          "details",
                          "strongMetrics",
                        ],
                        additionalProperties: false,
                      },
                    },
                    allFarmInsights: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          farmId: { type: "string" },
                          farmName: { type: "string" },
                          status: {
                            type: "string",
                            enum: ["critical", "warning", "stable", "good", "excellent"],
                          },
                          summary: { type: "string" },
                          details: {
                            type: "array",
                            items: { type: "string" },
                          },
                          keyMetrics: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                        required: [
                          "farmId",
                          "farmName",
                          "status",
                          "summary",
                          "details",
                          "keyMetrics",
                        ],
                        additionalProperties: false,
                      },
                    },
                    industryInsight: { type: "string" },
                  },
                  required: [
                    "needsAttention",
                    "mostImproved",
                    "topPerformers",
                    "allFarmInsights",
                    "industryInsight",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "report_exceptions" },
          },
        }),
      }
    );
    clearTimeout(timeoutId);

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
    let analysis: unknown;

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try to extract JSON from the message content
      const content = result.choices?.[0]?.message?.content ?? "";
      console.warn("No tool call in response, attempting content parse. finish_reason:", result.choices?.[0]?.finish_reason);
      try {
        let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonStart = cleaned.search(/[\{\[]/);
        const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found in content");
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
          .replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        analysis = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Failed to parse content fallback:", parseErr, "Content:", content.substring(0, 500));
        return new Response(
          JSON.stringify({ error: "AI did not return structured analysis" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-exceptions error:", e);
    const isAbort = e instanceof Error && e.name === "AbortError";
    return new Response(
      JSON.stringify({
        error: isAbort
          ? "AI analysis timed out. Try again — the dataset may be too large for a single pass."
          : e instanceof Error ? e.message : "Unknown error",
      }),
      { status: isAbort ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
