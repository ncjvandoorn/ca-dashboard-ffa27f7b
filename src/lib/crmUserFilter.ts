import { supabase } from "@/integrations/supabase/client";

/** Fetch the CRM visible user IDs from the database. Returns null = show all. */
export async function getCrmVisibleUserIds(): Promise<string[] | null> {
  try {
    const { data } = await supabase
      .from("crm_settings")
      .select("visible_user_ids")
      .limit(1)
      .single();
    if (data?.visible_user_ids && Array.isArray(data.visible_user_ids) && data.visible_user_ids.length > 0) {
      return data.visible_user_ids;
    }
    return null;
  } catch {
    return null;
  }
}

/** Save CRM visible user IDs to the database (admin only). */
export async function setCrmVisibleUserIds(ids: string[]): Promise<void> {
  // Get the existing row id
  const { data: existing } = await supabase
    .from("crm_settings")
    .select("id")
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from("crm_settings")
      .update({ visible_user_ids: ids, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("crm_settings")
      .insert({ visible_user_ids: ids });
  }
}
