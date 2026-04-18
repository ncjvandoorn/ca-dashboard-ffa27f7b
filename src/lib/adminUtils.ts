/** Shared helpers for the Admin page. */

export interface LoginLog {
  id: string;
  username: string;
  email: string;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  logged_in_at: string;
}

export interface QuestionLog {
  id: string;
  question: string;
  username: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  asked_at: string;
}

export interface CustomerAccountRecord {
  id: string;
  user_id: string;
  username: string;
  customer_account_id: string;
  can_see_trials: boolean;
  tier: "basic" | "pro" | "pro_plus" | "heavy";
}

export const formatAdminDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatAdminLocation = (log: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string => {
  const parts = [log.city, log.region, log.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
};
