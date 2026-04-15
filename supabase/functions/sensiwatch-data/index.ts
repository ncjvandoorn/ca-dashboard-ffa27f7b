const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { action, orderNumber, serialNumber, feedTimeFrom, feedTimeTo, tripId } = body;

    const baseUrl = SENSIWATCH_BASE_URL.replace(/\/$/, "");

    // Route based on action
    if (action === "search") {
      // Search trips - use GetData with a 24h sliding window (API limitation)
      // We'll do multiple 24h windows to cover 30 days
      const allResults: any[] = [];
      const now = new Date();
      const daysBack = 30;
      const errors: string[] = [];

      for (let d = 0; d < daysBack; d++) {
        const dayEnd = new Date(now.getTime() - d * 86400000);
        const dayStart = new Date(dayEnd.getTime() - 86400000);
        const payload = {
          FeedTimeFrom: dayStart.toISOString().slice(0, 19),
          FeedTimeTo: dayEnd.toISOString().slice(0, 19),
        };

        const url = `${baseUrl}/api/GetData?APIKey=${encodeURIComponent(SENSIWATCH_API_KEY)}`;
        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const text = await resp.text();
          if (resp.ok) {
            try {
              const data = JSON.parse(text);
              if (Array.isArray(data)) {
                allResults.push(...data);
              } else if (data && typeof data === "object" && !data.Result) {
                allResults.push(data);
              }
            } catch {
              // non-JSON response, skip
            }
          } else {
            // Log but continue - some days may have no data
            try {
              const errData = JSON.parse(text);
              if (errData.Result && errData.Result !== "Couldn't process the request") {
                errors.push(`Day ${d}: ${errData.Result}`);
              }
            } catch {
              errors.push(`Day ${d}: ${text}`);
            }
          }
        } catch (fetchErr) {
          errors.push(`Day ${d}: fetch failed`);
        }

        // Small delay to avoid rate limiting
        if (d < daysBack - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      return new Response(JSON.stringify({ trips: allResults, errors, daysSearched: daysBack }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "serialCheck" && serialNumber) {
      const url = `${baseUrl}/api/SerialCheck?APIKey=${encodeURIComponent(SENSIWATCH_API_KEY)}&SerialNumber=${encodeURIComponent(serialNumber)}`;
      console.log("SerialCheck:", url);
      const resp = await fetch(url);
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return new Response(JSON.stringify(data), {
        status: resp.ok ? 200 : resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: GetData with provided params (original behavior)
    const payload: Record<string, string> = {};
    if (orderNumber) payload.OrderNumber = orderNumber;
    if (serialNumber) payload.SerialNumber = serialNumber;
    if (feedTimeFrom) payload.FeedTimeFrom = feedTimeFrom;
    if (feedTimeTo) payload.FeedTimeTo = feedTimeTo;

    if (!orderNumber && !serialNumber && (!feedTimeFrom || !feedTimeTo)) {
      return new Response(JSON.stringify({ error: "Provide orderNumber, serialNumber, or feedTimeFrom+feedTimeTo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    try { data = JSON.parse(text); } catch { data = text; }

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
