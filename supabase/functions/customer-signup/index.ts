// Public edge function for customer signup flows.
// Two paths:
//   - validate_invitation / signup_with_invitation: requires a valid invite code
//   - signup_public: creates a pending account that an admin must approve
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_TIERS = ["basic", "pro", "pro_plus", "heavy"] as const;
const VALID_CYCLES = ["monthly", "yearly"] as const;

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function ok(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action } = body;

    // ---------- validate invitation code ----------
    if (action === "validate_invitation") {
      const code = String(body.code || "").trim().toLowerCase();
      if (!code) return bad("Code required");

      const { data: inv } = await supabaseAdmin
        .from("customer_invitations")
        .select("id, code, customer_account_id, company_name, username, used_at")
        .eq("code", code)
        .maybeSingle();

      if (!inv) return bad("Invitation code not found", 404);
      if (inv.used_at) return bad("This invitation has already been used", 410);

      return ok({
        invitation: {
          code: inv.code,
          customer_account_id: inv.customer_account_id,
          company_name: inv.company_name,
          username: inv.username,
        },
      });
    }

    // ---------- signup with invitation ----------
    if (action === "signup_with_invitation") {
      const code = String(body.code || "").trim().toLowerCase();
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const tier = String(body.tier || "basic");
      const billingCycle = String(body.billingCycle || "monthly");
      const contactEmail = String(body.contactEmail || "").trim();

      if (!code || !username || password.length < 6) {
        return bad("Code, username and password (min 6 chars) are required");
      }
      if (!/^[a-z0-9_-]+$/.test(username)) return bad("Username may only contain letters, numbers, _ and -");
      if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return bad("A valid contact email is required");
      }
      if (!VALID_TIERS.includes(tier as typeof VALID_TIERS[number])) return bad("Invalid tier");
      if (!VALID_CYCLES.includes(billingCycle as typeof VALID_CYCLES[number])) return bad("Invalid billing cycle");

      // fetch invitation
      const { data: inv } = await supabaseAdmin
        .from("customer_invitations")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (!inv) return bad("Invitation code not found", 404);
      if (inv.used_at) return bad("This invitation has already been used", 410);

      // Enforce admin-assigned username if invitation has one
      if (inv.username && inv.username !== username) {
        return bad("This invitation is locked to a specific username");
      }

      const email = `${username}@chrysal.app`;

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) return bad(createErr.message);
      const userId = created.user.id;

      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "customer" });

      const { error: caErr } = await supabaseAdmin.from("customer_accounts").insert({
        user_id: userId,
        customer_account_id: inv.customer_account_id,
        company_name: inv.company_name,
        contact_email: contactEmail,
        tier,
        billing_cycle: billingCycle,
        can_see_trials: false,
        status: "active",
        approved_at: new Date().toISOString(),
      });
      if (caErr) {
        // rollback auth user
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return bad(caErr.message);
      }

      await supabaseAdmin
        .from("customer_invitations")
        .update({ used_at: new Date().toISOString(), used_by_user_id: userId })
        .eq("id", inv.id);

      // grant initial signup credits based on chosen tier so they can start using right away
      const grant = tier === "pro" ? 4 : tier === "pro_plus" ? 10 : 0;
      if (grant > 0) {
        const { data: ca } = await supabaseAdmin
          .from("customer_accounts")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (ca) {
          const period = new Date().toISOString().slice(0, 7) + "-monthly_grant";
          await supabaseAdmin.from("container_credits_ledger").insert({
            customer_account_id: ca.id,
            delta: grant,
            reason: "signup_grant",
            note: period,
          });
        }
      }

      return ok({ success: true, email });
    }

    // ---------- public signup (pending approval) ----------
    // No username is asked from the customer — admin assigns one when approving.
    // We provision a temporary auth identity (pending-<random>@chrysal.pending) that
    // the customer cannot use to log in. On approval the admin sets the real username
    // and the auth email is rewritten to <username>@chrysal.app.
    if (action === "signup_public") {
      const password = String(body.password || "");
      const companyName = String(body.companyName || "").trim();
      const tier = String(body.tier || "basic");
      const billingCycle = String(body.billingCycle || "monthly");
      const contactEmail = String(body.contactEmail || "").trim();

      if (password.length < 6 || !companyName) {
        return bad("Company name and password (min 6 chars) are required");
      }
      if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return bad("A valid contact email is required");
      }
      if (!VALID_TIERS.includes(tier as typeof VALID_TIERS[number])) return bad("Invalid tier");
      if (!VALID_CYCLES.includes(billingCycle as typeof VALID_CYCLES[number])) return bad("Invalid billing cycle");

      const placeholder = `pending-${crypto.randomUUID().slice(0, 12)}`;
      const email = `${placeholder}@chrysal.pending`;

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) return bad(createErr.message);
      const userId = created.user.id;

      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "customer" });

      const { error: caErr } = await supabaseAdmin.from("customer_accounts").insert({
        user_id: userId,
        customer_account_id: `pending:${companyName.slice(0, 60)}`,
        company_name: companyName,
        contact_email: contactEmail,
        tier,
        billing_cycle: billingCycle,
        can_see_trials: false,
        status: "pending",
      });
      if (caErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return bad(caErr.message);
      }

      return ok({ success: true, pending: true });
    }

    return bad("Unknown action");
  } catch (err) {
    return bad((err as Error).message, 500);
  }
});
