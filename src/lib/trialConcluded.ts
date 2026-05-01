// Compute the trial conclusion date.
// Plantscout doesn't store this directly — it's derived as the last
// observation date: start_vl + max(observation_days) across measurements.
// Falls back to start_vl/start_retail/source_date/harvest_date if measurements
// are unavailable.

export interface ConclusionInputs {
  start_vl?: string | null;
  start_retail?: string | null;
  source_date?: string | null;
  harvest_date?: string | null;
}

export interface MeasurementForConclusion {
  observation_days?: number | null;
}

export function computeConcludedDate(
  header: ConclusionInputs,
  measurements: MeasurementForConclusion[] = [],
): string | null {
  const base = header.start_vl || header.start_retail || header.harvest_date;
  if (base) {
    let maxDays = 0;
    for (const m of measurements) {
      const d = m.observation_days;
      if (typeof d === "number" && Number.isFinite(d) && d > maxDays) maxDays = d;
    }
    if (maxDays > 0) {
      const t = Date.parse(base);
      if (!Number.isNaN(t)) {
        const out = new Date(t + maxDays * 86_400_000);
        return out.toISOString().slice(0, 10);
      }
    }
  }
  return header.source_date || base || null;
}
