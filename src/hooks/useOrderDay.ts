// Reads from the EXTERNAL Supabase project (user-owned, sensitive data).
// See `src/integrations/supabaseExternal/client.ts`.
//
// NEVER pass the rows returned here directly to an AI edge function —
// they must go through the anonymizer first.

import { useQuery } from "@tanstack/react-query";
import { supabaseExternal } from "@/integrations/supabaseExternal/client";

export interface OrderDayRow {
  id: string;
  servicesOrderId: string | null;
  forecast: number | null;
  stems: number | null;
  rtuPrepared: number | null;
  date: string | null;          // stored as bigint (Unix ms) in source — we expose as string
  createdAt: string | null;
  createdById: string | null;
  updatedAt: string | null;
  updatedById: string | null;
  deletedAt: string | null;
  deletedById: string | null;
}

export function useOrderDay(servicesOrderId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["external-orderDay", servicesOrderId ?? "all"],
    queryFn: async () => {
      // Page through results — Supabase caps at 1000 rows per request.
      const pageSize = 1000;
      const all: OrderDayRow[] = [];
      let from = 0;
      while (true) {
        let q = supabaseExternal
          .from("orderDay")
          .select("*")
          .is("deletedAt", null)
          .range(from, from + pageSize - 1);
        if (servicesOrderId) q = q.eq("servicesOrderId", servicesOrderId);
        const { data, error } = await q;
        if (error) throw error;
        const batch = (data || []) as OrderDayRow[];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
        if (from > 100000) break; // safety
      }
      return all;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
