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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fetch recent conversations (last 200)
    const convoRes = await fetch(
      `${supabaseUrl}/rest/v1/ai_conversation_logs?select=question,answer,created_at&order=created_at.desc&limit=200`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!convoRes.ok) throw new Error("Failed to fetch conversation logs");
    const conversations = await convoRes.json();

    if (!conversations?.length) {
      return new Response(
        JSON.stringify({ learnings: "No conversations found yet. Start asking the AI Agent questions and learnings will be generated from those interactions." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch current admin instructions for context
    let adminInstructions = "";
    try {
      const instrRes = await fetch(
        `${supabaseUrl}/rest/v1/ai_instructions?select=instructions&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (instrRes.ok) {
        const rows = await instrRes.json();
        if (rows?.[0]?.instructions) adminInstructions = rows[0].instructions;
      }
    } catch {}

    // Build conversation summary for analysis
    const convoSummary = conversations.map((c: any) =>
      `Q: ${c.question}\nA: ${(c.answer || "").slice(0, 500)}`
    ).join("\n\n---\n\n");

    const systemPrompt = `You are an analytical assistant reviewing past AI Agent conversations for a cut flower post-harvest quality monitoring platform (Chrysal).

Your task: Analyze the conversation history and extract ACTIONABLE LEARNINGS that should be fed back into the AI Agent's system prompt to improve future responses.

Focus on:
1. **Recurring questions** — What topics do users ask about most? The AI should proactively address these.
2. **Data patterns** — What farms, parameters (pH, EC, temp), or issues come up repeatedly?
3. **User frustrations** — Were there cases where the AI couldn't answer well? What context would help?
4. **Business priorities** — What does the team care about most based on their questions?
5. **Follow-up patterns** — Do users frequently ask about weekly plan follow-up, staff attribution, or specific metrics?

${adminInstructions ? `\nCurrent admin instructions (for context, don't repeat these):\n${adminInstructions}\n` : ""}

OUTPUT FORMAT:
Write clear, concise bullet points grouped by category. Each bullet should be an actionable instruction the AI Agent can follow. Keep it under 3000 characters total. Write in second person ("You should...", "Always...", "When asked about...").

Do NOT repeat what's already in the admin instructions. Only add NEW insights from the conversations.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here are the last ${conversations.length} AI Agent conversations:\n\n${convoSummary}` },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const result = await response.json();
    const learnings = result.choices?.[0]?.message?.content || "No learnings could be generated.";

    // Save learnings to database
    // Check if row exists
    const existingRes = await fetch(
      `${supabaseUrl}/rest/v1/ai_learnings?select=id&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const existing = await existingRes.json();

    if (existing?.length > 0) {
      await fetch(
        `${supabaseUrl}/rest/v1/ai_learnings?id=eq.${existing[0].id}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ learnings, updated_at: new Date().toISOString() }),
        }
      );
    } else {
      await fetch(
        `${supabaseUrl}/rest/v1/ai_learnings`,
        {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ learnings }),
        }
      );
    }

    return new Response(
      JSON.stringify({ learnings }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-learnings error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
