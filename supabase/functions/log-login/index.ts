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
    const { userId, email } = await req.json();
    if (!userId || !email) throw new Error("Missing userId or email");

    const username = email.replace("@chrysal.app", "");

    // Get client IP from headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Geolocate IP using free API
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

    const { error } = await supabaseAdmin.from("login_logs").insert({
      user_id: userId,
      email,
      username,
      ip_address: ip,
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
    console.error("log-login error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
