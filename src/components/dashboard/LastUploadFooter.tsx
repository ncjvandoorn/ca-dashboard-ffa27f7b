import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function LastUploadFooter() {
  const [latest, setLatest] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from("data-files")
        .list("", { limit: 100, sortBy: { column: "updated_at", order: "desc" } });
      if (cancelled || error || !data) return;
      let max: number = 0;
      for (const f of data) {
        const t = f.updated_at || f.created_at;
        if (!t) continue;
        const ms = new Date(t).getTime();
        if (ms > max) max = ms;
      }
      if (max > 0) setLatest(new Date(max));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!latest) return null;

  const hh = String(latest.getHours()).padStart(2, "0");
  const mm = String(latest.getMinutes()).padStart(2, "0");
  const dd = String(latest.getDate()).padStart(2, "0");
  const mo = String(latest.getMonth() + 1).padStart(2, "0");
  const yyyy = latest.getFullYear();

  return (
    <div className="w-full text-center text-xs text-muted-foreground py-4">
      Last update: {hh}:{mm}, {dd}-{mo}-{yyyy}
    </div>
  );
}
