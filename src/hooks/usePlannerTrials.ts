import { useQuery } from "@tanstack/react-query";
import { loadTrials, type Trial } from "@/lib/trialsParser";

export function usePlannerTrials() {
  return useQuery<Trial[]>({
    queryKey: ["planner-trials"],
    queryFn: async () => {
      try {
        const data = await loadTrials();
        // eslint-disable-next-line no-console
        console.log("[usePlannerTrials] loaded", data.length, "trials, first:", data[0]?.trialNumber);
        return data;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[usePlannerTrials] FAILED to load trials.xlsx:", e);
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
