// External Supabase client — connects to the user's OWN Supabase project
// where the real (sensitive) operational data lives.
//
// Lovable Cloud (the default `@/integrations/supabase/client`) still
// handles auth, caches, AI logs, CRM confirmations, sensiwatch, etc.
//
// This client is READ-ONLY from the app's perspective. The publishable
// (anon) key below is safe in the frontend — RLS policies on the
// external project must enforce real authorization.
//
// IMPORTANT: data fetched through this client must NEVER be sent to AI
// edge functions without first passing through the anonymizer in
// `supabase/functions/_shared/anonymize.ts`.

import { createClient } from "@supabase/supabase-js";

const EXTERNAL_SUPABASE_URL = "https://tkrxamrpqhhfjqckadqm.supabase.co";
const EXTERNAL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YUjiJ0hC-UcvGOAsO6AyNg_FRW25gkX";

export const supabaseExternal = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      // Do NOT persist auth — this client is for data only. Auth still
      // happens against Lovable Cloud via `@/integrations/supabase/client`.
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
