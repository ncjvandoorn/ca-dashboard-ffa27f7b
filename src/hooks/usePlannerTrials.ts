import { useQuery } from "@tanstack/react-query";
import { loadTrials, type Trial } from "@/lib/trialsParser";

export function usePlannerTrials() {
  return useQuery<Trial[]>({
    queryKey: ["planner-trials"],
    queryFn: loadTrials,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
