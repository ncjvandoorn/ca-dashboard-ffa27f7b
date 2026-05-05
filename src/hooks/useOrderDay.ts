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

export function useOrderDay(servicesOrderId?: string) {
  return useQuery({
    queryKey: ["external-orderDay", servicesOrderId ?? "all"],
    queryFn: async () => {
      let q = supabaseExternal.from("orderDay").select("*");
      if (servicesOrderId) q = q.eq("servicesOrderId", servicesOrderId);
      const { data, error } = await q.limit(1000);
      if (error) throw error;
      return (data || []) as OrderDayRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
