import { useQuery } from "@tanstack/react-query";
import { loadAccounts, loadQualityReports, loadActivities } from "@/lib/csvParser";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: loadAccounts,
    staleTime: Infinity,
  });
}

export function useQualityReports() {
  return useQuery({
    queryKey: ["qualityReports"],
    queryFn: loadQualityReports,
    staleTime: Infinity,
  });
}

export function useActivities() {
  return useQuery({
    queryKey: ["activities"],
    queryFn: loadActivities,
    staleTime: Infinity,
  });
}
