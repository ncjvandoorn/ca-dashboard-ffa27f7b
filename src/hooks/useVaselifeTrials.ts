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

/** Property name reference — measured traits in Plantscout */
export const PROPERTY_LABELS: Record<string, string> = {
  FLC: "Flower Colour",
  FLO: "Flower Opening",
  FLD: "Flower Damage",
  FLA: "Flower Abnormality",
  STD: "Stem Damage",
  STB: "Stem Bend",
  LFQ: "Leaf Quality",
  LFY: "Leaf Yellowing",
  LFB: "Leaf Burning",
  LFD: "Leaf Damage",
  BTR: "Botrytis",
  CVW: "Cultivar Write-off",
};

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
