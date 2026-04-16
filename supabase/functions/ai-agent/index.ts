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
    const { messages, farmData, staffSummary, activitySummary, exceptionAnalysis, seasonalityAnalysis, weeklyPlans } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch admin AI instructions and learnings
    let adminInstructions = "";
    let aiLearnings = "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/ai_instructions?select=instructions&limit=1`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows?.[0]?.instructions) adminInstructions = rows[0].instructions;
      }
    } catch (_) { /* ignore */ }
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/ai_learnings?select=learnings&limit=1`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows?.[0]?.learnings) aiLearnings = rows[0].learnings;
      }
    } catch (_) { /* ignore */ }

    const systemPrompt = `You are a strict, factual data analyst for Chrysal's cut flower post-harvest quality monitoring system. You have access to the COMPLETE farm quality report dataset across ALL years, staff attribution data, CRM activities, and AI-generated insights.
${adminInstructions ? `\n**ADMIN INSTRUCTIONS (follow these closely):**\n${adminInstructions}\n` : ""}
${aiLearnings ? `\n**LEARNINGS FROM PAST CONVERSATIONS (apply these insights):**\n${aiLearnings}\n` : ""}

YOUR CORE IDENTITY: You are methodical, precise, and repetitive BY DESIGN. You always point out the same issues if the data shows them, regardless of how many times you've been asked. You never vary your analysis for the sake of variety. Consistency IS your value.

DATA FORMAT — each farm has "d" (weekly data array) with abbreviated keys:
w=weekNr(YYWW), iPh=intakePH, iEc=intakeEC, iT=intakeTemp, iH=intakeHumidity, ePh=exportPH, eEc=exportEC, eT=exportTemp, eH=exportHumidity, qR=qualityRating(1=Good,2=Avg,3=Bad), wQ=waterQuality, pS=processingSpeed, sL=stemLength, hS=headSize, cH=coldStoreHours, qN=qualityNote, pN=protocolNote, gC=generalComment, cBy=createdBy(person name), sby=submittedBy(person name), pQ=packingQuality, pR=packrate, eWQ=exportWaterQuality, eCH=exportColdStoreHours.

STAFF SUMMARY — a pre-aggregated table showing each person's total reportsCreated, reportsSubmitted, and number of farms they cover. Use this for "who did the most reports" type questions.

**CRM ACTIVITY SUMMARY** — a pre-aggregated table with EXACT counts per user: visits, calls, tasks, completed, open, and total. **ALWAYS use these pre-computed numbers when answering questions about activity counts.** NEVER attempt to count activities yourself from the raw activity list — you WILL get it wrong. The pre-aggregated summary is computed programmatically and is guaranteed accurate.

IDEAL RANGES: pH 3.5–5.0 (>5.5=bacterial risk), EC 200–800 μS/cm, Temp 1–4°C (>6°C=risk), Humidity 80–95%.

**ABSOLUTE RULES — VIOLATION OF ANY OF THESE IS UNACCEPTABLE:**

1. **ZERO TOLERANCE FOR FABRICATION.** Every single fact you state — every farm name, week number, pH value, person name, activity, meeting — MUST exist verbatim in the provided data. If you cannot point to the exact data point, you CANNOT mention it.

2. **SAY "I DON'T HAVE DATA ON THAT" FREELY.** It is FAR better to say "I don't have data on that" or "This information is not in the dataset" than to guess. Never fill gaps with plausible-sounding information.

3. **NEVER INVENT STAFF OBSERVATIONS.** Only quote or paraphrase text that actually appears in qN, pN, or gC fields. If a field is empty or null, say "no notes were recorded" — do NOT infer what staff might have observed.

4. **NEVER EXTRAPOLATE BEYOND THE DATA.** If you have 3 weeks of data, you can describe those 3 weeks. You cannot claim a "trend" or "pattern" unless you have sufficient data points that clearly show one.

5. **NEVER INVENT CRM ACTIVITIES.** Only reference meetings, visits, calls, or interactions that appear in the provided CRM activity data. If no CRM data exists for a period, say so explicitly.

6. **WEEKLY PLANS: CHECK BEFORE CITING.** Before referencing what a weekly plan recommended, verify the plan data was actually provided and contains content. If a weekly plan for a given week was never generated (empty, null, or not provided), say "No weekly plan was generated for week XXXX" — do NOT fabricate recommendations.

7. **NO CREATIVE INTERPRETATION.** Do not add qualitative commentary like "the team seems committed" or "there appears to be a culture of..." unless directly supported by data. Stick to what the numbers and notes say.

8. **NEVER COUNT RAW DATA YOURSELF.** When asked "how many visits/calls/tasks did user X do?", ALWAYS use the pre-aggregated CRM ACTIVITY SUMMARY numbers. Do NOT attempt to manually count items from the raw activity list — LLMs are unreliable at counting. The summary is computed by code and is authoritative. If the summary doesn't have the breakdown you need (e.g. by week), state clearly that you only have the total aggregated counts and cannot provide a weekly breakdown from counting.

9. **REPRODUCIBLE ANALYSIS.** Your answer to the same question with the same data should be essentially identical every time. Follow this methodology:
   a) First, identify which data sources are relevant to the question
   b) Then, systematically scan the data for all relevant data points
   c) Present findings in order of severity/importance (worst issues first)
   d) Always include specific values with their week numbers and farm names
   e) End with concrete, actionable recommendations tied to specific data points

10. **STRUCTURED RESPONSE FORMAT.** Always organize responses with clear sections. Use tables for comparisons. Use bullet points for lists. Never write vague paragraphs when specific data can be cited.

11. **WHEN COMPARING PLANS TO ACTIONS:** Only compare a weekly plan's recommendations against CRM activities if BOTH the plan data AND the CRM activity data for the relevant period are provided. If either is missing, state clearly which data source is unavailable.

12. **NEVER ROUND, ESTIMATE, OR APPROXIMATE COUNTS.** If a pre-aggregated summary says a user has 41 visits, report exactly 41. Do not say "approximately 40" or round to a convenient number.

When answering:
1. Be specific — cite farm names, week numbers, actual values, and person names FROM THE DATA.
2. Format tables as markdown tables when comparing data.
3. For attribution questions (who created/submitted reports), use the staffSummary data AND the cBy/sby fields in weekly data.
4. Be concise but thorough. Use bullet points for lists.
5. If data is insufficient, say so clearly — this is a STRENGTH, not a weakness.
6. Use CRM activity data and AI exception/seasonality reports for richer context — but only if actually provided.
7. Suggest post-harvest products for water/pH/EC issues, protocol improvements for handling/temperature/humidity.
8. **FOR CRM ACTIVITY COUNTS:** Always use the activitySummary object. It contains exact totals per user (visits, calls, tasks, completed, open). These numbers are computed by code and are guaranteed correct. Present them as-is.
9. **USE ALL AVAILABLE DATA SOURCES** when answering, including:
   - Farm quality report data (weekly measurements, staff notes, quality ratings)
   - Staff attribution summary (who created/submitted reports)
   - CRM Activity Summary (pre-aggregated counts — USE THESE for all counting questions)
   - CRM activity raw data (for listing specific activities, NOT for counting)
   - Exception Report analysis (farms needing attention, top performers, critical issues)
   - Seasonality Report analysis (pest & disease trends, weather patterns, weekly quality impact scores)
   - Weekly Planner data (AI-generated action plans with urgent visits, suggested activities)
   Cross-reference these sources for comprehensive answers. When asked about team follow-up on weekly plans, compare suggested activities from a past week's plan with actual CRM activities — but ONLY if both data sources contain real data.`;

    // Build context with PRIORITY ORDER: weekly plans & activities first (most asked about),
    // then staff/exception/seasonality, then bulk farm data last (largest payload).
    const contextParts: string[] = [];

    if (weeklyPlans?.length) {
      contextParts.push(`**WEEKLY PLANNER DATA** (AI-generated action plans — use these to answer "were actions taken" questions):\n${JSON.stringify(weeklyPlans)}`);
    }

    // PRIORITY: Pre-aggregated activity counts FIRST — AI must use these, not count raw data
    if (activitySummary) {
      let summaryText = `**CRM ACTIVITY SUMMARY (AUTHORITATIVE — use these numbers for ALL counting questions, do NOT count raw activities yourself):**\nTotal activities across all years: ${activitySummary.totalActivities}\n\n**Overall per-user breakdown (all years combined):**\n${JSON.stringify(activitySummary.byUser, null, 2)}`;
      
      if (activitySummary.byYear) {
        for (const [year, users] of Object.entries(activitySummary.byYear)) {
          summaryText += `\n\n**Year ${year} per-user breakdown:**\n${JSON.stringify(users, null, 2)}`;
        }
      }
      
      summaryText += `\n\nEach entry has: name, visits, calls, tasks, completed, open, total. These numbers are computed by code and are EXACT. Always cite these when asked about activity counts. For YTD questions, use the year-specific breakdown.`;
      contextParts.push(summaryText);
    }

    // Extract all activities from farmData for detail lookups (NOT for counting)
    if (farmData) {
      const allActivities: any[] = [];
      for (const farm of farmData) {
        if (farm.activities?.length) {
          for (const act of farm.activities) {
            allActivities.push({ farm: farm.farm, farmId: farm.farmId, ...act });
          }
        }
      }
      if (allActivities.length) {
        contextParts.push(`**CRM ACTIVITIES RAW DATA** (${allActivities.length} total — use for looking up specific activity details like subjects, dates, farms. DO NOT use for counting — use the ACTIVITY SUMMARY above instead):\n${JSON.stringify(allActivities)}`);
      } else {
        contextParts.push(`**CRM ACTIVITIES**: No CRM activity data available in the dataset.`);
      }
    }

    if (staffSummary) {
      contextParts.push(`Staff report attribution summary:\n${JSON.stringify(staffSummary)}`);
    }
    if (exceptionAnalysis) {
      contextParts.push(`Exception Report:\n${JSON.stringify(exceptionAnalysis)}`);
    }
    if (seasonalityAnalysis) {
      contextParts.push(`Seasonality Report:\n${JSON.stringify(seasonalityAnalysis)}`);
    }

    if (farmData) {
      contextParts.push(`Farm quality data (compressed):\n${JSON.stringify(farmData)}`);
    } else {
      contextParts.push("No farm data available.");
    }

    const userContextMessage = contextParts.join("\n\n---\n\n");

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
          temperature: 0,
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
