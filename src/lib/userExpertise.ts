import { supabase } from "@/integrations/supabase/client";

export type FarmScope = "responsible" | "all";

export interface UserExpertiseEntry {
  expertise: string;
  farmScope: FarmScope;
}

export type UserExpertiseMap = Record<string, string>;
export type UserExpertiseFullMap = Record<string, UserExpertiseEntry>;

/** Fetch all user expertise rows as a map of user_id → expertise text. */
export async function getUserExpertiseMap(): Promise<UserExpertiseMap> {
  const full = await getUserExpertiseFullMap();
  const map: UserExpertiseMap = {};
  for (const [k, v] of Object.entries(full)) map[k] = v.expertise;
  return map;
}

/** Fetch full user expertise rows including farm scope. */
export async function getUserExpertiseFullMap(): Promise<UserExpertiseFullMap> {
  try {
    const { data } = await supabase
      .from("user_expertise")
      .select("user_id, expertise, farm_scope");
    const map: UserExpertiseFullMap = {};
    for (const row of (data || []) as Array<{ user_id: string; expertise: string | null; farm_scope: string | null }>) {
      if (!row.user_id) continue;
      map[row.user_id] = {
        expertise: row.expertise || "",
        farmScope: (row.farm_scope === "all" ? "all" : "responsible") as FarmScope,
      };
    }
    return map;
  } catch {
    return {};
  }
}

/** Upsert one user's expertise text and (optionally) farm scope. */
export async function setUserExpertise(
  userId: string,
  expertise: string,
  farmScope: FarmScope = "responsible",
): Promise<void> {
  const { data: existing } = await supabase
    .from("user_expertise")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("user_expertise")
      .update({ expertise, farm_scope: farmScope, updated_at: new Date().toISOString() } as never)
      .eq("id", existing.id);
  } else {
    await supabase
      .from("user_expertise")
      .insert({ user_id: userId, expertise, farm_scope: farmScope } as never);
  }
}
