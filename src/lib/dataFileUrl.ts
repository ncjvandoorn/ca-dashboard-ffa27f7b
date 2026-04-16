import { supabase } from "@/integrations/supabase/client";

/**
 * Try to get a file from Supabase storage (data-files bucket).
 * If it exists, return the public URL; otherwise fall back to /data/<filename>.
 */
export async function getDataFileUrl(filename: string): Promise<string> {
  const { data } = supabase.storage.from("data-files").getPublicUrl(filename);
  if (data?.publicUrl) {
    // Check if file actually exists — bust browser cache with timestamp
    try {
      const resp = await fetch(`${data.publicUrl}?t=${Date.now()}`, { method: "HEAD" });
      if (resp.ok) return `${data.publicUrl}?t=${Date.now()}`;
    } catch {
      // fall through
    }
  }
  return `/data/${filename}`;
}
