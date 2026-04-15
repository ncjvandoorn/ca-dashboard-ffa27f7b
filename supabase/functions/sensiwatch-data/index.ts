import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SENSIWATCH_API_KEY = Deno.env.get("SENSIWATCH_API_KEY");
  if (!SENSIWATCH_API_KEY) {
    return new Response(JSON.stringify({ error: "SENSIWATCH_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SENSIWATCH_BASE_URL = Deno.env.get("SENSIWATCH_BASE_URL");
  if (!SENSIWATCH_BASE_URL) {
    return new Response(JSON.stringify({ error: "SENSIWATCH_BASE_URL not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { orderNumber, serialNumber, feedTimeFrom, feedTimeTo } = body;

    // Build the GetData request
    const payload: Record<string, string> = {};
    if (orderNumber) payload.OrderNumber = orderNumber;
    if (serialNumber) payload.SerialNumber = serialNumber;
    if (feedTimeFrom) payload.FeedTimeFrom = feedTimeFrom;
    if (feedTimeTo) payload.FeedTimeTo = feedTimeTo;

    // At least one input is required
    if (!orderNumber && !serialNumber && (!feedTimeFrom || !feedTimeTo)) {
      return new Response(JSON.stringify({ error: "Provide orderNumber, serialNumber, or feedTimeFrom+feedTimeTo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = SENSIWATCH_BASE_URL.replace(/\/$/, "");
    const url = `${baseUrl}/api/GetData?APIKey=${encodeURIComponent(SENSIWATCH_API_KEY)}`;

    console.log("Calling SensiWatch GetData:", url, JSON.stringify(payload));

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    console.log("SensiWatch response status:", resp.status, "body length:", text.length);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `SensiWatch API error [${resp.status}]`, details: data }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sensiwatch-data error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
