import { supabase } from "@/integrations/supabase/client";

export type SharePageType =
  | "data_loggers"
  | "exception_report"
  | "seasonality"
  | "reporting_check"
  | "ai_agent"
  | "weekly_plan"
  | "compare_trips"
  | "quality_report"
  | "trip_detail"
  | "container_detail";

export const SHARE_TTL_DAYS = 7;

/** URL-safe random token, ~22 chars. */
export function generateShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SharedPageRow {
  token: string;
  page_type: SharePageType;
  payload: unknown;
  expires_at: string;
  created_at: string;
  created_by_username: string | null;
}

export async function createSharedPage(args: {
  pageType: SharePageType;
  payload: unknown;
  username?: string | null;
}): Promise<{ token: string; expiresAt: Date; url: string }> {
  const token = generateShareToken();
  const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 86400000);
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;
  if (!userId) throw new Error("You must be signed in to create a share link.");

  const { error } = await supabase.from("shared_pages").insert({
    token,
    page_type: args.pageType,
    payload: args.payload as never,
    created_by: userId,
    created_by_username: args.username ?? null,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(error.message);

  const url = `${window.location.origin}/share/${token}`;
  return { token, expiresAt, url };
}

export async function fetchSharedPage(token: string): Promise<SharedPageRow | null> {
  const { data, error } = await supabase
    .from("shared_pages")
    .select("token, page_type, payload, expires_at, created_at, created_by_username")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as unknown as SharedPageRow;
}
