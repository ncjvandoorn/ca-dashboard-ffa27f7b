import { supabase } from "@/integrations/supabase/client";

export type UserExpertiseMap = Record<string, string>;

/** Fetch all user expertise rows as a map of user_id → expertise text. */
export async function getUserExpertiseMap(): Promise<UserExpertiseMap> {
  try {
    const { data } = await supabase
      .from("user_expertise")
      .select("user_id, expertise");
    const map: UserExpertiseMap = {};
    for (const row of data || []) {
      if (row.user_id) map[row.user_id] = row.expertise || "";
    }
    return map;
  } catch {
    return {};
  }
}

/** Upsert one user's expertise text. */
export async function setUserExpertise(userId: string, expertise: string): Promise<void> {
  const { data: existing } = await supabase
    .from("user_expertise")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("user_expertise")
      .update({ expertise, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("user_expertise")
      .insert({ user_id: userId, expertise });
  }
}
