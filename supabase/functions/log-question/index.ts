import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const { question, email } = await req.json();
    if (!question) throw new Error("Missing question");

    const username = email ? email.replace("@chrysal.app", "") : "unknown";

    // Get client IP from headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Geolocate IP
    let city = null;
    let country = null;
    let region = null;

    if (ip && ip !== "unknown" && ip !== "127.0.0.1") {
      try {
        const geoResp = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,regionName`);
        if (geoResp.ok) {
          const geo = await geoResp.json();
          city = geo.city || null;
          country = geo.country || null;
          region = geo.regionName || null;
        }
      } catch {
        // Geo lookup failed silently
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabaseAdmin.from("question_logs").insert({
      question,
      user_email: email || null,
      username,
      city,
      country,
      region,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("log-question error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
