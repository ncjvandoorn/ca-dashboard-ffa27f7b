import { useQuery } from "@tanstack/react-query";
import { loadAccounts, loadQualityReports } from "@/lib/csvParser";

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
