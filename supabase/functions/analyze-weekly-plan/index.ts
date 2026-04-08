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
    const { activitySummary, qualitySummary, userSummary, weekRange } = await req.json();
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

    const systemPrompt = `You are a senior operations manager for a cut flower post-harvest quality company. Your team of field quality inspectors visits farms weekly to monitor quality, perform visits, make calls, and complete tasks tracked in a CRM system.

${adminInstructions ? `**ADMIN INSTRUCTIONS (follow these closely):**\n${adminInstructions}\n` : ""}

Your job is to create a **Weekly Action Plan** for the coming week. You act as the team's manager — analyzing what happened recently and deciding what each team member should prioritize next week.

You have two data sources:
1. **CRM Activities**: Tasks, Calls, and Visits logged by staff — with statuses (To Do, In Progress, Completed), assigned users, linked farms, and descriptions.
2. **Quality Reports**: Weekly farm quality data including pH, EC, temperature, humidity, quality ratings, and staff notes from field inspections.

**Your analysis must:**
- Identify which farms need URGENT visits based on quality data deterioration, staff-flagged issues, or overdue activities
- Highlight overdue/stale activities (To Do items that have been sitting for weeks)
- Evaluate each user's workload and completion rate — recommend rebalancing if someone is overloaded or underperforming
- Suggest NEW activities that should be created based on quality report findings (e.g., "Visit Farm X to investigate pH drift reported in week 26/12")
- Prioritize farm visits based on quality risk, not just activity backlog
- Flag farms with no recent activity that have quality concerns
- Consider the relationship between quality data and activity patterns — farms with declining quality but no scheduled visits are the highest priority

**Staff notes context**: qualityFlowersNote, protocolChangesNote, and generalComment in quality reports are first-hand field observations and should be heavily weighted in planning.

Return your analysis as a JSON object with this exact structure:
{
  "weekLabel": "Week XX (DD Mon – DD Mon YYYY)",
  "executiveSummary": "2-3 sentence overview of the team's situation and key priorities for the coming week.",
  "urgentFarmVisits": [
    {
      "farmId": "uuid",
      "farmName": "string",
      "reason": "Why this farm needs an urgent visit",
      "suggestedUser": "Name of the best person to assign",
      "qualityIssues": ["Specific quality concern 1", "Concern 2"],
      "priority": "critical" | "high"
    }
  ],
  "overdueActivities": [
    {
      "activitySubject": "string",
      "farmName": "string",
      "assignedUser": "string",
      "daysOverdue": number,
      "recommendation": "What to do about this"
    }
  ],
  "userWorkloadAssessment": [
    {
      "userName": "string",
      "openTasks": number,
      "completedRecently": number,
      "completionRate": number,
      "assessment": "On track" | "Overloaded" | "Underutilized" | "Falling behind",
      "recommendation": "Specific action suggestion for this user"
    }
  ],
  "suggestedNewActivities": [
    {
      "type": "Task" | "Visit" | "Call",
      "subject": "Suggested activity title",
      "farmName": "string",
      "suggestedUser": "string",
      "reason": "Why this activity is needed based on quality data",
      "priority": "critical" | "high" | "medium"
    }
  ],
  "farmsWithoutCoverage": [
    {
      "farmId": "uuid",
      "farmName": "string",
      "lastActivityDate": "string or 'Never'",
      "qualityStatus": "string — brief quality summary",
      "recommendation": "What should be done"
    }
  ],
  "weeklyFocus": "A clear 2-3 sentence directive for the team, summarizing the #1 priority for the coming week and any overarching themes."
}

**CRITICAL ANTI-HALLUCINATION RULES:**
1. ONLY reference data present in the input. Never invent farm names, user names, values, or observations.
2. Every metric you cite MUST come directly from the provided data.
3. If data is insufficient, say so explicitly rather than guessing.
4. Do NOT invent activity subjects — reference actual activities from the input.
5. For suggestedNewActivities, base them solely on quality report findings.
6. If fewer items qualify for a category, return fewer. Never pad lists.`;

    const userPrompt = `Create the weekly action plan for the coming week based on the following data.

Week range analyzed: ${weekRange?.min ?? "unknown"} to ${weekRange?.max ?? "unknown"}.

**TEAM MEMBERS:**
${JSON.stringify(userSummary)}

**CRM ACTIVITY SUMMARY (recent 8 weeks):**
Activities grouped by user showing open tasks, recent completions, and activity details.
${JSON.stringify(activitySummary)}

**QUALITY REPORT SUMMARY (recent 12 weeks):**
Farm quality data with readings and staff notes.
${JSON.stringify(qualitySummary)}

Analyze this data and create the weekly action plan. Focus on:
1. Which farms need urgent attention based on quality deterioration or staff-flagged issues
2. Which open activities are overdue and need follow-up
3. How each team member is performing and whether workload needs rebalancing
4. What NEW activities should be created based on quality findings
5. Which farms have quality concerns but no scheduled activities`;

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
                          qualityIssues: { type: "array", items: { type: "string" } },
                          priority: { type: "string", enum: ["critical", "high"] },
                        },
                        required: ["farmId", "farmName", "reason", "suggestedUser", "qualityIssues", "priority"],
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
                          assessment: { type: "string", enum: ["On track", "Overloaded", "Underutilized", "Falling behind"] },
                          recommendation: { type: "string" },
                        },
                        required: ["userName", "openTasks", "completedRecently", "completionRate", "assessment", "recommendation"],
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
                          reason: { type: "string" },
                          priority: { type: "string", enum: ["critical", "high", "medium"] },
                        },
                        required: ["type", "subject", "farmName", "suggestedUser", "reason", "priority"],
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
