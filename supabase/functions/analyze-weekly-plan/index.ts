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
    const { activitySummary, qualitySummary, userSummary, weekRange, uncoveredFarms, todayDate, currentWeekNr, weekDates, commercialFollowupCandidates } = await req.json();
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

    const systemPrompt = `You are a senior operations manager for a cut flower post-harvest quality company (Chrysal). Your team of field quality inspectors visits farms weekly to monitor quality, perform visits, make calls, and complete tasks tracked in a CRM system.

${adminInstructions ? `**ADMIN INSTRUCTIONS (follow these closely):**\n${adminInstructions}\n` : ""}

**WORK SCHEDULE**: The team works Monday to Friday. **Monday is an OFFICE day — never schedule farm visits on Monday.** Farm visits happen Tuesday to Friday only. Today is ${todayDate || "a weekday"}. THIS week runs from ${weekDates || "Monday to Friday"}. The current week number is ${currentWeekNr || "unknown"} (format YYWW). This plan ALWAYS covers the FULL work week Monday–Friday, even if generated mid-week. All recommendations and schedules must use days Monday through Friday of THIS week. Never plan for next week.

**REALISTIC CONSTRAINTS:**
- Each inspector can realistically visit a MAXIMUM of 3 farms per day, Tuesday–Friday only (12 visits/week max per user). Monday is reserved for office work.
- Calls, admin tasks, and follow-ups have no daily limit
- If a user has 60 open tasks, they cannot do all of them this week — prioritize the top 10-12 most urgent
- Focus on what is actionable THIS week. Do not suggest things for next week.

**DATA FORMAT — COMPACT KEYS:**
Activity items: s=subject, d=description, t=type(T=Task,V=Visit,C=Call), st=status(TD=ToDo,IP=InProgress), f=farmName, fid=farmId, age=daysOld
Quality data: w=weekNr(YYWW), iPh=intakePH, iEc=intakeEC, iT=intakeTemp, iH=intakeHumidity, iWQ=intakeWaterQuality, ePh=exportPH, eEc=exportEC, eT=exportTemp, eH=exportHumidity, eWQ=exportWaterQuality, qR=qualityRating(1=Good,2=Avg,3=Bad), qN=qualityNote, pN=protocolNote, gC=generalComment.

**DOMAIN EXPERTISE for cut flowers:**
- pH: Ideal intake 3.5–5.0; above 5.5 = bacterial risk
- EC: Ideal 200–800 μS/cm. Too high = stem blockage
- Cold store temp: Must stay 1–4°C. Above 6°C = ethylene damage
- Humidity: 80–95% RH. Below 70% = petal browning. Above 95% = Botrytis risk
- Quality ratings: 1=Good, 2=Average, 3=Bad. Consecutive 2–3 ratings = systemic issue
- Staff notes (qN, pN, gC) > numerical readings: field observations are most reliable
- Key pests/diseases: Botrytis, powdery/downy mildew, thrips, spider mites, FCM

**ANALYSIS PRIORITIES (in order):**
1. URGENT: Farms with quality deterioration (worsening qR, staff-flagged pests/diseases) AND no open activities
2. OVERDUE: Any To Do item older than 14 days — decide: complete this week, reassign, or close
3. STAFF NOTES: Any qN/pN/gC mentioning pest, disease, damage, contamination → flag for visit
4. WORKLOAD: Balance work across team. If one user has 50 open and another has 3, redistribute
5. NEW ACTIVITIES: Based on quality trends — be specific (cite farm, metric, week numbers)

Return JSON with this structure:
{
  "weekLabel": "Week XX (DD Mon – DD Mon YYYY)",
  "executiveSummary": "3-4 sentences: team situation, key quality concerns, #1 priority for THIS week.",
  "urgentFarmVisits": [{ "farmId","farmName","reason" (cite data),"suggestedUser","suggestedDay" (Tue-Fri),"qualityIssues":[],"priority":"critical"|"high" }],
  "overdueActivities": [{ "activitySubject","farmName","assignedUser","daysOverdue","recommendation" }],
  "userWorkloadAssessment": [{ "userName","openTasks","completedRecently","completionRate","farmsCovered","assessment":"On track"|"Overloaded"|"Underutilized"|"Falling behind","recommendation","suggestedSchedule":["Monday: ...","Tuesday: ..."] }],
  "suggestedNewActivities": [{ "type":"Task"|"Visit"|"Call","subject","farmName","suggestedUser","suggestedDay","reason" (cite data),"priority":"critical"|"high"|"medium" }],
  "farmsWithoutCoverage": [{ "farmId","farmName","lastActivityDate","qualityStatus","recommendation" }],
  "commercialFollowups": [{ "trialId","trialNumber","farmName","customer","keyProduct","trialDate","reason" }],
  "weeklyFocus": "3-4 sentence team directive for this week. Summarize #1 priority, key risks, team actions."
}

**LIMITS per section:** urgentFarmVisits max 40, overdueActivities max 15, suggestedNewActivities max 40, farmsWithoutCoverage max 10, commercialFollowups max 15. Per user: max 12 farm visits per week (3 per day × 4 days, Tuesday–Friday). Aim to fill each user's 12-visit capacity when there is enough actionable data.

**COMMERCIAL FOLLOW-UPS — what to include:**
The input \`commercialFollowupCandidates\` lists Vase Life trials whose Next Step is "Commercial" (recommendation does NOT contain "repeat") and where our pre-filter found NO CRM activity since the trial date that mentions a key product/keyword from the recommendation.
For each candidate decide whether it truly represents an unfollowed-up sales opportunity:
- Include it if the recommendation indicates a positive/successful product result that the team should now sell to that farm/customer (e.g. "GVB performed well", "AVB recommended", etc.).
- Skip it if the recommendation is inconclusive, negative, or already trivially closed.
- \`keyProduct\` must be the specific product/treatment name mentioned in the recommendation (e.g. "GVB", "AVB @5mL/L", "TOG 75"). Pull it from the recommendation text — never invent.
- \`reason\` must be 1 short sentence (max 25 words) citing the trial result and what sales action is needed.
- \`trialId\` and \`trialNumber\` MUST be copied verbatim from the candidate input.
- Order by most recent trial first.

**CRITICAL RULES:**
1. ONLY reference data present in the input. Never invent names, values, or observations.
2. Every value you cite MUST come from the provided data.
3. Staff notes: quote or closely paraphrase actual qN, pN, gC text.
4. If fewer items qualify, return fewer. Never pad lists.
5. Include ALL team members in userWorkloadAssessment.
6. suggestedSchedule per user: max 3 visits/day, Tuesday–Friday only (Monday = office). Unlimited calls/tasks.
7. For commercialFollowups: \`trialId\` MUST exactly match an \`id\` from commercialFollowupCandidates.`;

    const userPrompt = `Create the action plan for THIS week (${weekDates || "Mon–Fri"}). Today is ${todayDate || "a weekday"}, week ${currentWeekNr || "?"}.
The plan must cover Monday through Friday. The weekLabel should reflect "${weekDates || "Mon–Fri"}".

Quality data covers weeks: ${weekRange?.min ?? "?"} to ${weekRange?.max ?? "?"}.

TEAM: ${JSON.stringify(userSummary)}

CRM ACTIVITIES (per user — ALL open items + recent completions + stats):
${JSON.stringify(activitySummary)}

QUALITY REPORTS (per farm, last 12 weeks, compact format):
${JSON.stringify(qualitySummary)}

UNCOVERED FARMS (have quality reports but zero open activities):
${JSON.stringify(uncoveredFarms)}

COMMERCIAL TRIAL CANDIDATES (Vase-Life trials with Next Step = Commercial AND no follow-up CRM activity yet on that farm mentioning the trial's product/keywords):
${JSON.stringify(commercialFollowupCandidates || [])}

Create the full Mon–Fri plan. Focus on what matters MOST.`;

    const requestBody = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_weekly_plan",
            description: "Return the weekly action plan for the coming week",
            parameters: {
              type: "object",
              properties: {
                weekLabel: { type: "string" },
                executiveSummary: { type: "string" },
                urgentFarmVisits: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      farmId: { type: "string" },
                      farmName: { type: "string" },
                      reason: { type: "string" },
                      suggestedUser: { type: "string" },
                      suggestedDay: { type: "string" },
                      qualityIssues: { type: "array", items: { type: "string" } },
                      priority: { type: "string", enum: ["critical", "high"] },
                    },
                    required: ["farmId", "farmName", "reason", "suggestedUser", "suggestedDay", "qualityIssues", "priority"],
                    additionalProperties: false,
                  },
                },
                overdueActivities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      activitySubject: { type: "string" },
                      farmName: { type: "string" },
                      assignedUser: { type: "string" },
                      daysOverdue: { type: "number" },
                      recommendation: { type: "string" },
                    },
                    required: ["activitySubject", "farmName", "assignedUser", "daysOverdue", "recommendation"],
                    additionalProperties: false,
                  },
                },
                userWorkloadAssessment: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      userName: { type: "string" },
                      openTasks: { type: "number" },
                      completedRecently: { type: "number" },
                      completionRate: { type: "number" },
                      farmsCovered: { type: "number" },
                      assessment: { type: "string", enum: ["On track", "Overloaded", "Underutilized", "Falling behind"] },
                      recommendation: { type: "string" },
                      suggestedSchedule: { type: "array", items: { type: "string" } },
                    },
                    required: ["userName", "openTasks", "completedRecently", "completionRate", "farmsCovered", "assessment", "recommendation", "suggestedSchedule"],
                    additionalProperties: false,
                  },
                },
                suggestedNewActivities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["Task", "Visit", "Call"] },
                      subject: { type: "string" },
                      farmName: { type: "string" },
                      suggestedUser: { type: "string" },
                      suggestedDay: { type: "string" },
                      reason: { type: "string" },
                      priority: { type: "string", enum: ["critical", "high", "medium"] },
                    },
                    required: ["type", "subject", "farmName", "suggestedUser", "suggestedDay", "reason", "priority"],
                    additionalProperties: false,
                  },
                },
                farmsWithoutCoverage: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      farmId: { type: "string" },
                      farmName: { type: "string" },
                      lastActivityDate: { type: "string" },
                      qualityStatus: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["farmId", "farmName", "lastActivityDate", "qualityStatus", "recommendation"],
                    additionalProperties: false,
                  },
                },
                commercialFollowups: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      trialId: { type: "string" },
                      trialNumber: { type: "string" },
                      farmName: { type: "string" },
                      customer: { type: "string" },
                      keyProduct: { type: "string" },
                      trialDate: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["trialId", "trialNumber", "farmName", "keyProduct", "trialDate", "reason"],
                    additionalProperties: false,
                  },
                },
                weeklyFocus: { type: "string" },
              },
              required: ["weekLabel", "executiveSummary", "urgentFarmVisits", "overdueActivities", "userWorkloadAssessment", "suggestedNewActivities", "farmsWithoutCoverage", "commercialFollowups", "weeklyFocus"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "report_weekly_plan" },
      },
    });

    console.log("Payload size:", requestBody.length, "bytes");
    const t0 = Date.now();

    let response: Response;
    try {
      response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: requestBody,
        }
      );
    } catch (fetchErr) {
      console.error("AI gateway fetch threw after", Date.now() - t0, "ms:", fetchErr);
      return new Response(
        JSON.stringify({ error: `AI gateway unreachable: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("AI gateway responded in", Date.now() - t0, "ms, status:", response.status);

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

    const rawText = await response.text();
    let result: any;
    try {
      result = JSON.parse(rawText);
    } catch {
      console.error("AI gateway returned non-JSON:", rawText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI returned an invalid response. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let analysis: unknown;

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
      } catch {
        // Tool call arguments may be truncated — try robust extraction
        let args = toolCall.function.arguments || "";
        args = args.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        // Try to close unclosed braces
        const openB = (args.match(/{/g) || []).length;
        const closeB = (args.match(/}/g) || []).length;
        for (let i = 0; i < openB - closeB; i++) args += "}";
        const openA = (args.match(/\[/g) || []).length;
        const closeA = (args.match(/]/g) || []).length;
        for (let i = 0; i < openA - closeA; i++) args += "]";
        try {
          analysis = JSON.parse(args);
        } catch (e2) {
          console.error("Failed to parse tool call arguments:", (args).slice(0, 500));
          return new Response(
            JSON.stringify({ error: "AI response was truncated. Please try again." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      const content = result.choices?.[0]?.message?.content ?? "";
      console.warn("No tool call in response, content:", content.slice(0, 300));
      // Try to extract JSON from content
      try {
        let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonStart = cleaned.search(/[\{\[]/);
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }
        // Fix trailing commas
        cleaned = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        analysis = JSON.parse(cleaned);
      } catch {
        // If content is garbage (like "Hello Sunshine"), return a clear error
        return new Response(
          JSON.stringify({ error: `AI returned unexpected response. Please try again. (${content.slice(0, 80)})` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
