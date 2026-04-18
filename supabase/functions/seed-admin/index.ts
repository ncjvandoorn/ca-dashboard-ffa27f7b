import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const users = [
      { email: "admin@chrysal.app", password: "CA@2026" },
      { email: "chrysal@chrysal.app", password: "CA@2026" },
    ];

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const results: string[] = [];

    // One-time rename: user@chrysal.app -> chrysal@chrysal.app (preserves user_id, role, password)
    const legacyUser = existingUsers?.users?.find((e) => e.email === "user@chrysal.app");
    const newUser = existingUsers?.users?.find((e) => e.email === "chrysal@chrysal.app");
    if (legacyUser && !newUser) {
      const { error: renameError } = await supabaseAdmin.auth.admin.updateUserById(legacyUser.id, {
        email: "chrysal@chrysal.app",
        email_confirm: true,
      });
      if (renameError) {
        results.push(`rename user->chrysal error: ${renameError.message}`);
      } else {
        results.push(`renamed user@chrysal.app -> chrysal@chrysal.app`);
      }
    }

    // Re-fetch after potential rename
    const { data: refreshed } = await supabaseAdmin.auth.admin.listUsers();

    for (const u of users) {
      const existing = refreshed?.users?.find((e) => e.email === u.email);
      if (existing) {
        results.push(`${u.email} already exists`);
        continue;
      }

      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });

      if (error) {
        results.push(`${u.email} error: ${error.message}`);
      } else {
        results.push(`${u.email} created`);
      }
    }

    return new Response(
      JSON.stringify({ message: "Seed complete", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
