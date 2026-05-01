import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VaselifeHeader {
  id: string;
  trial_number: string | null;
  farm: string | null;
  customer: string | null;
  freight_type: string | null;
  initial_quality: string | null;
  harvest_date: string | null;
  start_seafreight: string | null;
  start_transport: string | null;
  start_retail: string | null;
  start_vl: string | null;
  stems_per_vase: number | null;
  crop: string | null;
  cultivar_count: number | null;
  treatment_count: number | null;
  vases_per_treatment: number | null;
  total_vases: number | null;
  objective: string | null;
  spec_comments: string | null;
  conclusion: string | null;
  recommendations: string | null;
  source_date: string | null;
}

export interface VaselifeVase {
  id_line: string;
  id_header: string;
  cultivar: string | null;
  id_cultivar: string | null;
  treatment_no: number | null;
  vase_count: number | null;
  treatment_name: string | null;
  id_greenhouse: string | null;
  id_dipping: string | null;
  id_pulsing: string | null;
  post_harvest: string | null;
  store_phase: string | null;
  consumer_phase: string | null;
  climate_room: string | null;
  flv_days: number | null;
  bot_percentage: number | null;
  flo_percentage: number | null;
}

export interface VaselifeMeasurement {
  id_line_property: string;
  id_line: string;
  id_header: string;
  cultivar: string | null;
  treatment_no: number | null;
  property_name: string | null;
  observation_count: number | null;
  observation_days: number | null;
  score: number | null;
}

/**
 * Property name reference — measured traits in Plantscout.
 * Re-exported from `@/lib/vaselifeProperties` so all metadata
 * (label, direction, tooltip description) lives in one place.
 */
export { PROPERTY_LABELS } from "@/lib/vaselifeProperties";

export function useVaselifeHeaders() {
  return useQuery({
    queryKey: ["vaselife-headers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaselife_headers")
        .select("*")
        .order("harvest_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as VaselifeHeader[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useVaselifeVases(headerId: string | undefined) {
  return useQuery({
    queryKey: ["vaselife-vases", headerId],
    queryFn: async () => {
      if (!headerId) return [];
      const { data, error } = await supabase
        .from("vaselife_vases")
        .select("*")
        .eq("id_header", headerId)
        .order("cultivar")
        .order("treatment_no");
      if (error) throw error;
      return (data || []) as VaselifeVase[];
    },
    enabled: !!headerId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useVaselifeMeasurements(headerId: string | undefined) {
  return useQuery({
    queryKey: ["vaselife-measurements", headerId],
    queryFn: async () => {
      if (!headerId) return [];
      const { data, error } = await supabase
        .from("vaselife_measurements")
        .select("*")
        .eq("id_header", headerId);
      if (error) throw error;
      return (data || []) as VaselifeMeasurement[];
    },
    enabled: !!headerId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch ALL rows from a Supabase table by paging past the 1000-row default. */
async function fetchAllPaged<T>(
  table: "vaselife_vases" | "vaselife_measurements",
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // Hard safety cap to avoid runaway loops
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/** Fetch every vase row across all trials — used for cross-trial search and AI agent. */
export function useAllVaselifeVases() {
  return useQuery({
    queryKey: ["vaselife-vases-all"],
    queryFn: () => fetchAllPaged<VaselifeVase>("vaselife_vases"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch every measurement row across all trials — used for cross-trial search and AI agent. */
export function useAllVaselifeMeasurements() {
  return useQuery({
    queryKey: ["vaselife-measurements-all"],
    queryFn: () => fetchAllPaged<VaselifeMeasurement>("vaselife_measurements"),
    staleTime: 5 * 60 * 1000,
  });
}
