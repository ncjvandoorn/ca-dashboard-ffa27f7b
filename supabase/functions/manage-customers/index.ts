import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    // Check caller is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "list") {
      // List all customer accounts with their auth user email and credit balance
      const { data: customerAccounts } = await supabaseAdmin
        .from("customer_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: balances } = await supabaseAdmin
        .from("customer_credit_balance")
        .select("customer_account_id, total_granted, total_consumed, balance");
      const balanceMap = new Map(
        (balances || []).map((b: any) => [b.customer_account_id, b]),
      );

      const enriched: any[] = [];
      for (const ca of customerAccounts || []) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(ca.user_id);
        const bal = balanceMap.get(ca.id) || { total_granted: 0, total_consumed: 0, balance: 0 };
        enriched.push({
          ...ca,
          email: user?.email || "unknown",
          username: user?.email?.replace("@chrysal.app", "") || "unknown",
          credit_balance: bal.balance,
          credit_granted: bal.total_granted,
          credit_consumed: bal.total_consumed,
        });
      }

      return new Response(JSON.stringify({ accounts: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- Invitations ----------
    if (action === "list_invitations") {
      const { data } = await supabaseAdmin
        .from("customer_invitations")
        .select("*")
        .order("created_at", { ascending: false });
      return new Response(JSON.stringify({ invitations: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_invitation") {
      const { customerAccountId, companyName, tier, billingCycle, canSeeTrials, notes } = body;
      if (!customerAccountId) {
        return new Response(JSON.stringify({ error: "customerAccountId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const safeTier = ["basic", "pro", "pro_plus", "heavy"].includes(tier) ? tier : "basic";
      const safeCycle = ["monthly", "yearly"].includes(billingCycle) ? billingCycle : "monthly";

      // Generate code: <slug>-<6 digit hex>
      const slug = String(companyName || customerAccountId).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8) || "chry";
      const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const code = `${slug}-${rand}`;

      const { data: invRow, error: invErr } = await supabaseAdmin
        .from("customer_invitations")
        .insert({
          code,
          customer_account_id: customerAccountId,
          company_name: companyName || null,
          tier: safeTier,
          billing_cycle: safeCycle,
          can_see_trials: !!canSeeTrials,
          notes: notes || null,
          created_by: callerId,
        })
        .select()
        .single();
      if (invErr) {
        return new Response(JSON.stringify({ error: invErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ invitation: invRow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_invitation") {
      const { id } = body;
      await supabaseAdmin.from("customer_invitations").delete().eq("id", id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- Pending approvals ----------
    if (action === "approve_customer") {
      const { id, customerAccountId, canSeeTrials } = body;
      const updates: Record<string, any> = {
        status: "active",
        approved_at: new Date().toISOString(),
        approved_by: callerId,
        updated_at: new Date().toISOString(),
      };
      if (customerAccountId) updates.customer_account_id = customerAccountId;
      if (typeof canSeeTrials === "boolean") updates.can_see_trials = canSeeTrials;

      const { data: ca, error: updErr } = await supabaseAdmin
        .from("customer_accounts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // grant initial credits based on tier
      const grant = ca.tier === "pro" ? 4 : ca.tier === "pro_plus" ? 10 : 0;
      if (grant > 0) {
        const period = new Date().toISOString().slice(0, 7) + "-monthly_grant";
        await supabaseAdmin.from("container_credits_ledger").insert({
          customer_account_id: ca.id,
          delta: grant,
          reason: "signup_grant",
          note: period,
          created_by: callerId,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject_customer") {
      const { id, userId } = body;
      await supabaseAdmin.auth.admin.deleteUser(userId);
      // customer_accounts deletes via cascade-less manual cleanup
      await supabaseAdmin.from("customer_accounts").delete().eq("id", id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- Credits ----------
    if (action === "grant_credits") {
      const { customerAccountId, delta, note } = body;
      const amt = Number(delta);
      if (!customerAccountId || !Number.isFinite(amt) || amt === 0) {
        return new Response(JSON.stringify({ error: "customerAccountId and non-zero delta required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("container_credits_ledger").insert({
        customer_account_id: customerAccountId,
        delta: Math.trunc(amt),
        reason: "admin_grant",
        note: note || null,
        created_by: callerId,
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "credit_history") {
      const { customerAccountId } = body;
      const { data } = await supabaseAdmin
        .from("container_credits_ledger")
        .select("*")
        .eq("customer_account_id", customerAccountId)
        .order("created_at", { ascending: false })
        .limit(200);
      return new Response(JSON.stringify({ history: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "consume_credit") {
      // Called by Active SF when a customer (or admin acting for one) activates a container
      const { customerAccountId, containerId, note } = body;
      if (!customerAccountId) {
        return new Response(JSON.stringify({ error: "customerAccountId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ca } = await supabaseAdmin
        .from("customer_accounts")
        .select("id, tier")
        .eq("id", customerAccountId)
        .maybeSingle();
      if (!ca) {
        return new Response(JSON.stringify({ error: "Customer account not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Heavy tier: log consumption only, no balance check
      if (ca.tier === "heavy") {
        await supabaseAdmin.from("container_credits_ledger").insert({
          customer_account_id: ca.id,
          delta: 0, // tracked, but doesn't reduce a balance
          reason: "consumption",
          container_id: containerId || null,
          note: note || "heavy-tier consumption",
          created_by: callerId,
        });
        return new Response(JSON.stringify({ success: true, heavy: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Other tiers: check balance
      const { data: bal } = await supabaseAdmin
        .from("customer_credit_balance")
        .select("balance")
        .eq("customer_account_id", ca.id)
        .maybeSingle();
      const current = bal?.balance ?? 0;
      if (current <= 0) {
        return new Response(JSON.stringify({ error: "No container credits available", balance: current }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("container_credits_ledger").insert({
        customer_account_id: ca.id,
        delta: -1,
        reason: "consumption",
        container_id: containerId || null,
        note: note || null,
        created_by: callerId,
      });

      return new Response(JSON.stringify({ success: true, balance: current - 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { username, password, customerAccountId, canSeeTrials, tier } = body;

      if (!username || !password || !customerAccountId) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const email = `${username}@chrysal.app`;
      const safeTier = tier === "pro" ? "pro" : "basic";

      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Add customer role
      await supabaseAdmin.from("user_roles").insert({
        user_id: newUser.user.id,
        role: "customer",
      });

      // Create customer account link
      await supabaseAdmin.from("customer_accounts").insert({
        user_id: newUser.user.id,
        customer_account_id: customerAccountId,
        can_see_trials: canSeeTrials || false,
        tier: safeTier,
      });

      return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { id, canSeeTrials, customerAccountId, tier } = body;

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (typeof canSeeTrials === "boolean") updates.can_see_trials = canSeeTrials;
      if (customerAccountId) updates.customer_account_id = customerAccountId;
      if (tier === "basic" || tier === "pro") updates.tier = tier;

      await supabaseAdmin.from("customer_accounts").update(updates).eq("id", id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { id, userId } = body;

      // Delete auth user (cascades to user_roles and customer_accounts)
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password_by_email") {
      const { email, password } = body;
      if (!email || !password || typeof password !== "string" || password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the user by email by listing users (small admin user base)
      const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const target = usersList.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
      if (!target) {
        return new Response(JSON.stringify({ error: `User ${email} not found` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(target.id, { password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { userId, password } = body;
      if (!userId || !password || typeof password !== "string" || password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
