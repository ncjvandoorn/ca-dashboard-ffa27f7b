import type { Trial } from "./trialsParser";
import type { VaselifeHeader } from "@/hooks/useVaselifeTrials";

export type LinkStatus = "green" | "yellow" | "red";

export interface TrialLinkInfo {
  status: LinkStatus;
  plannerMatches: Trial[];          // matched planner trials (may be many for a range)
  trialNumbersInHeader: string[];   // expanded trial numbers from header
  hasPlannerLink: boolean;
  customerLinked: boolean;          // header.customer matches an account name
  farmLinked: boolean;              // header.farm matches an account name
  notes: string[];                  // human-readable details for tooltip
}

const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();

/**
 * Expand a trial-number string like "CA01102 - CA01107" or "CA01113"
 * into the individual numbers in the range.
 */
export function expandTrialNumbers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  // Split on commas / semicolons first
  const parts = raw.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = part.match(/^([A-Za-z]*)(\d+)\s*[-–]\s*([A-Za-z]*)(\d+)$/);
    if (rangeMatch) {
      const [, prefixA, numA, prefixB, numB] = rangeMatch;
      const prefix = prefixA || prefixB || "";
      const startN = parseInt(numA, 10);
      const endN = parseInt(numB, 10);
      const padLen = numA.length;
      if (!isNaN(startN) && !isNaN(endN) && endN >= startN && endN - startN < 200) {
        for (let n = startN; n <= endN; n++) {
          out.push(`${prefix}${String(n).padStart(padLen, "0")}`);
        }
        continue;
      }
    }
    out.push(part);
  }
  return out;
}

export function computeTrialLink(
  header: Pick<VaselifeHeader, "trial_number" | "customer" | "farm">,
  planner: Trial[],
  accountNames: Set<string>,
): TrialLinkInfo {
  const trialNums = expandTrialNumbers(header.trial_number);
  const trialNumSet = new Set(trialNums.map(norm));

  // Match against both `trialNumber` and `trialReference` — the user-facing
  // ID (e.g. "CA01030") may live in either column depending on the source sheet.
  // Also expand planner-side values in case they contain ranges like "CA01032 - CA01034".
  const plannerMatches = planner.filter((p) => {
    const candidates = [
      ...expandTrialNumbers(p.trialNumber).map(norm),
      ...expandTrialNumbers(p.trialReference).map(norm),
      norm(p.trialNumber),
      norm(p.trialReference),
    ];
    return candidates.some((c) => c && trialNumSet.has(c));
  });
  const hasPlannerLink = plannerMatches.length > 0;

  const customerLinked = !!header.customer && accountNames.has(norm(header.customer));
  const farmLinked = !!header.farm && accountNames.has(norm(header.farm));

  const checks = [hasPlannerLink, customerLinked, farmLinked];
  const okCount = checks.filter(Boolean).length;
  const status: LinkStatus = okCount === 3 ? "green" : okCount === 0 ? "red" : "yellow";

  const notes: string[] = [];
  notes.push(
    hasPlannerLink
      ? `✓ Planner: ${plannerMatches.length} matching trial${plannerMatches.length === 1 ? "" : "s"}`
      : `✗ Planner: no match for "${header.trial_number || "—"}"`,
  );
  notes.push(
    customerLinked
      ? `✓ Customer "${header.customer}" found in app accounts`
      : `✗ Customer "${header.customer || "—"}" not found in app accounts`,
  );
  notes.push(
    farmLinked
      ? `✓ Farm "${header.farm}" found in app accounts`
      : `✗ Farm "${header.farm || "—"}" not found in app accounts`,
  );

  return {
    status,
    plannerMatches,
    trialNumbersInHeader: trialNums,
    hasPlannerLink,
    customerLinked,
    farmLinked,
    notes,
  };
}
