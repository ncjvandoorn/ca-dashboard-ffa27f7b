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
    const { activitySummary, qualitySummary, userSummary, weekRange, uncoveredFarms } = await req.json();
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

**WORK SCHEDULE**: The team works Monday to Friday. This plan is created on Monday morning and covers the full work week (Mon–Fri). Be specific about which days activities should happen when possible.

Your job is to create a **Weekly Action Plan** for the coming work week (Monday–Friday). You act as the team's manager — analyzing ALL available data and deciding what each team member should prioritize.

**DATA SOURCES:**
1. **CRM Activities (ALL history)**: Every Task, Call, and Visit logged by staff — with statuses (To Do, In Progress, Completed), assigned users, linked farms, descriptions, and age in days. You receive ALL open items per user (not truncated) plus recent completions for context. Each user summary includes:
   - All open items with full details (subject, description, farm, age, type, status)
   - Recent completions (last 4 weeks) 
   - Total historical stats (completion rate, task counts by status/type, farms covered)
   
2. **Quality Reports (last 12 weeks, ALL farms)**: Weekly farm quality data with full metrics:
   - Intake: pH, EC, temp, humidity, cold store hours, water quality, treatment
   - Export: pH, EC, temp, humidity, cold store hours, water quality, treatment  
   - Dispatch: packing quality, packrate, processing speed
   - Plant metrics: stem length, head size, dipping location
   - Staff notes: qualityFlowersNote (qN), protocolChangesNote (pN), generalComment (gC) — THESE ARE FIRST-HAND FIELD OBSERVATIONS and carry the highest weight
   - Submitted by user name for context on who inspected

3. **Uncovered Farms**: Pre-computed list of farms that have quality reports but ZERO open activities assigned.

**ABBREVIATED KEYS in quality data:**
w=weekNr(YYWW), iPh=intakePH, iEc=intakeEC, iT=intakeTemp, iH=intakeHumidity, iCH=intakeColdStoreHours, iWQ=intakeWaterQuality, iTr=intakeTreatment, ePh=exportPH, eEc=exportEC, eT=exportTemp, eH=exportHumidity, eCH=exportColdStoreHours, eWQ=exportWaterQuality, eTr=exportTreatment, qR=qualityRating(1=Good,2=Avg,3=Bad), pQ=packingQuality, pR=packrate, pS=processingSpeed, sL=stemLength, hS=headSize, dL=dippingLocation, qN=qualityNote, pN=protocolNote, gC=generalComment.

**DOMAIN EXPERTISE for cut flowers:**
- pH: Ideal intake 3.5–5.0; above 5.5 = bacterial risk. Export should match intake.
- EC: Ideal 200–800 μS/cm. Too high = stem blockage; too low = no nutrition.
- Cold store temp: Must stay 1–4°C. Above 6°C = ethylene damage.
- Humidity: 80–95% RH. Below 70% = petal browning. Above 95% = Botrytis risk.
- Quality ratings: 1=Good, 2=Average, 3=Bad. Consecutive 2–3 ratings = systemic issue.
- Water quality: Same 1-3 scale. Rating 3 = bacterial contamination red flag.
- Cold store hours: Too few = inadequate cooling. >24h without monitoring = risky.
- Staff notes > numerical readings: On-the-ground observations from experienced inspectors are more reliable than sensor data.

**YOUR ANALYSIS MUST:**
- Assign specific tasks to specific users for specific days (Mon–Fri) when possible
- Identify farms needing URGENT visits based on quality deterioration, staff-flagged issues, or overdue activities
- Highlight stale activities — any To Do item older than 14 days is overdue
- Evaluate each user's workload holistically: open task count, completion rate, farm coverage, and recent activity patterns
- Suggest NEW activities based on quality report findings — be very specific (e.g., "Visit Farm X Tuesday to investigate pH drift from 4.2 to 6.1 over weeks 26/10-26/12")
- Cross-reference quality data with activity coverage: farms with declining quality AND no open activities are top priority
- Consider user expertise: assign based on which farms they've historically covered
- Flag workload imbalances: if one user has 30 open tasks and another has 3, recommend redistribution

Return your analysis as a JSON object with this exact structure:
{
  "weekLabel": "Week XX (DD Mon – DD Mon YYYY)",
  "executiveSummary": "3-4 sentence overview: team situation, key quality concerns from data, and the #1 priority for Mon–Fri.",
  "urgentFarmVisits": [
    {
      "farmId": "uuid",
      "farmName": "string",
      "reason": "Why this farm needs an urgent visit — cite specific data",
      "suggestedUser": "Name of the best person to assign (based on their history with this farm)",
      "suggestedDay": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday",
      "qualityIssues": ["Specific concern with data citation, e.g. 'pH rose from 4.2 to 6.1 in weeks 2610–2612'"],
      "priority": "critical" | "high"
    }
  ],
  "overdueActivities": [
    {
      "activitySubject": "string — the actual subject from the data",
      "farmName": "string",
      "assignedUser": "string",
      "daysOverdue": number,
      "recommendation": "What to do: complete, reassign, or close"
    }
  ],
  "userWorkloadAssessment": [
    {
      "userName": "string",
      "openTasks": number,
      "completedRecently": number,
      "completionRate": number,
      "farmsCovered": number,
      "assessment": "On track" | "Overloaded" | "Underutilized" | "Falling behind",
      "recommendation": "Specific Mon–Fri action plan for this user",
      "suggestedSchedule": ["Monday: Visit Farm X", "Tuesday: Follow up on Task Y", ...]
    }
  ],
  "suggestedNewActivities": [
    {
      "type": "Task" | "Visit" | "Call",
      "subject": "Specific activity title",
      "farmName": "string",
      "suggestedUser": "string — pick based on their farm coverage history",
      "suggestedDay": "string — which day this week",
      "reason": "Why needed — cite quality data or staff notes",
      "priority": "critical" | "high" | "medium"
    }
  ],
  "farmsWithoutCoverage": [
    {
      "farmId": "uuid",
      "farmName": "string",
      "lastActivityDate": "string or 'Never'",
      "qualityStatus": "Brief quality summary citing actual recent data",
      "recommendation": "What should be done and by whom"
    }
  ],
  "weeklyFocus": "A clear 3-4 sentence directive for the team meeting on Monday morning. Summarize the #1 priority, key risks from the quality data, and any team-level actions (redistribute work, focus areas, etc.)."
}

**CRITICAL ANTI-HALLUCINATION RULES:**
1. ONLY reference data present in the input. Never invent farm names, user names, values, or observations.
2. Every numerical value you cite MUST come directly from the provided data.
3. When citing staff notes, quote or closely paraphrase actual text from qN, pN, or gC fields.
4. Do NOT invent activity subjects — reference actual activities from the input.
5. For suggestedNewActivities, base them solely on quality report findings.
6. If fewer items qualify for a category, return fewer. Never pad lists.
7. For userWorkloadAssessment, include ALL users from the team — not just those with issues.`;

    const userPrompt = `Create the Monday morning weekly action plan for the coming work week (Mon–Fri).

Today is Monday. You are briefing the team on what to do this week.

Quality report week range: ${weekRange?.min ?? "unknown"} to ${weekRange?.max ?? "unknown"}.

**TEAM MEMBERS (with positions):**
${JSON.stringify(userSummary)}

**CRM ACTIVITY DATA (ALL history, grouped by user):**
Each user has: ALL open items (To Do + In Progress) with full details, recent completions (last 4 weeks), historical totals, completion rates, task breakdowns by status and type, and number of farms covered.
${JSON.stringify(activitySummary)}

**QUALITY REPORT DATA (last 12 weeks, ALL farms, ALL metrics):**
Full weekly readings per farm including intake/export pH, EC, temp, humidity, cold store hours, water quality, treatments, dispatch metrics, and critically: staff field notes (qN, pN, gC).
${JSON.stringify(qualitySummary)}

**FARMS WITHOUT ANY OPEN ACTIVITIES (pre-computed):**
These farms have quality reports but zero open To Do or In Progress activities assigned to anyone.
${JSON.stringify(uncoveredFarms)}

Create the weekly plan. For each user, provide a specific Mon–Fri schedule. Prioritize:
1. Farms with deteriorating quality OR staff-flagged concerns that have no open activities
2. Overdue activities (>14 days old) — decide: complete, reassign, or close
3. Workload balance — redistribute if any user is overloaded vs underutilized
4. New activities needed based on quality data trends and staff notes
5. Ensure every team member has a productive and balanced week`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
                    weeklyFocus: { type: "string" },
                  },
                  required: ["weekLabel", "executiveSummary", "urgentFarmVisits", "overdueActivities", "userWorkloadAssessment", "suggestedNewActivities", "farmsWithoutCoverage", "weeklyFocus"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "report_weekly_plan" },
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
    let analysis: unknown;

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      const content = result.choices?.[0]?.message?.content ?? "";
      console.warn("No tool call in response, attempting content parse.");
      try {
        let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonStart = cleaned.search(/[\{\[]/);
        if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
        analysis = JSON.parse(cleaned);
      } catch {
        return new Response(
          JSON.stringify({ error: "Failed to parse AI response", raw: content.slice(0, 500) }),
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
