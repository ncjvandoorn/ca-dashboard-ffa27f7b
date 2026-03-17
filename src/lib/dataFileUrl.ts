import { supabase } from "@/integrations/supabase/client";

/**
 * Try to get a file from Supabase storage (data-files bucket).
 * If it exists, return the public URL; otherwise fall back to /data/<filename>.
 */
export async function getDataFileUrl(filename: string): Promise<string> {
  const { data } = supabase.storage.from("data-files").getPublicUrl(filename);
  if (data?.publicUrl) {
    // Check if file actually exists by doing a HEAD request
    try {
      const resp = await fetch(data.publicUrl, { method: "HEAD" });
      if (resp.ok) return data.publicUrl;
    } catch {
      // fall through
    }
  }
  return `/data/${filename}`;
}
