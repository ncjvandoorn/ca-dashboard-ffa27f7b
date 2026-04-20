import type { LoggerReading } from "@/hooks/useAllSensiwatchReadings";

export type ExceptionType =
  | "temp_above_5"
  | "temp_above_15"
  | "humidity_below_70"
  | "light_high";

export interface ExceptionRule {
  key: ExceptionType;
  label: string;
  shortLabel: string;
  /** HSL hue used for the chart line + chip. */
  hue: number;
  description: string;
}

export const EXCEPTION_RULES: ExceptionRule[] = [
  {
    key: "temp_above_5",
    label: "Temperature > 3°C for more than 3 days",
    shortLabel: "Temp > 3°C · 3d",
    hue: 28, // amber
    description: "Sustained warm exposure (cold-chain drift)",
  },
  {
    key: "temp_above_15",
    label: "Temperature > 15°C for more than 3 days",
    shortLabel: "Temp > 15°C · 3d",
    hue: 0, // red
    description: "Severe warm exposure",
  },
  {
    key: "humidity_below_70",
    label: "Humidity < 70% for more than 3 days",
    shortLabel: "RH < 70% · 3d",
    hue: 210, // blue
    description: "Sustained dry conditions",
  },
  {
    key: "light_high",
    label: "Light > 3% for more than 6 hours",
    shortLabel: "Light > 3% · 6h",
    hue: 48, // yellow
    description: "Sustained light exposure (likely opened/leak)",
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Within a sorted (ascending time) array of readings for a single logger,
 * find the longest contiguous run where `predicate(reading)` is true and
 * return its duration in milliseconds (0 if none). Two consecutive readings
 * spaced > `gapMs` apart break the run (defensive against device gaps).
 */
function longestRunMs<T extends { time: string }>(
  rows: T[],
  predicate: (r: T) => boolean,
  gapMs = 12 * HOUR_MS
): { ms: number; start: string | null; end: string | null } {
  let bestMs = 0;
  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  let curStart: string | null = null;
  let curEnd: string | null = null;
  let prevTime: number | null = null;

  for (const r of rows) {
    const t = new Date(r.time).getTime();
    if (Number.isNaN(t)) continue;
    const ok = predicate(r);
    if (ok) {
      if (curStart === null || (prevTime !== null && t - prevTime > gapMs)) {
        curStart = r.time;
      }
      curEnd = r.time;
      const runMs = new Date(curEnd).getTime() - new Date(curStart!).getTime();
      if (runMs > bestMs) {
        bestMs = runMs;
        bestStart = curStart;
        bestEnd = curEnd;
      }
    } else {
      curStart = null;
      curEnd = null;
    }
    prevTime = t;
  }
  return { ms: bestMs, start: bestStart, end: bestEnd };
}

export interface LoggerExceptionFlag {
  rule: ExceptionType;
  durationMs: number;
  start: string | null;
  end: string | null;
}

export interface LoggerSeries {
  serial: string;
  /** All trip ids this serial appeared in (sorted, dedup). */
  tripIds: string[];
  /** All internal trip ids (= order numbers + suffix) seen for this serial. */
  internalTripIds: string[];
  /** Sorted readings (asc by time). */
  readings: LoggerReading[];
  flags: LoggerExceptionFlag[];
  /** Most recent reading time. */
  lastTime: string | null;
}

/**
 * Group readings by serial number and evaluate every exception rule.
 * Returns one entry per logger that has at least one reading.
 */
export function buildLoggerSeries(rows: LoggerReading[]): LoggerSeries[] {
  const bySerial = new Map<string, LoggerReading[]>();
  for (const r of rows) {
    if (!r.serial) continue;
    if (!bySerial.has(r.serial)) bySerial.set(r.serial, []);
    bySerial.get(r.serial)!.push(r);
  }

  const out: LoggerSeries[] = [];
  for (const [serial, rdgs] of bySerial.entries()) {
    rdgs.sort((a, b) => a.time.localeCompare(b.time));
    const tripIds = Array.from(new Set(rdgs.map((r) => r.tripId).filter(Boolean))).sort();
    const internalTripIds = Array.from(
      new Set(rdgs.map((r) => r.internalTripId).filter(Boolean))
    ).sort();

    const flags: LoggerExceptionFlag[] = [];

    const t5 = longestRunMs(rdgs, (r) => r.temp != null && r.temp > 5);
    if (t5.ms > 3 * DAY_MS) {
      flags.push({ rule: "temp_above_5", durationMs: t5.ms, start: t5.start, end: t5.end });
    }
    const t15 = longestRunMs(rdgs, (r) => r.temp != null && r.temp > 15);
    if (t15.ms > 3 * DAY_MS) {
      flags.push({ rule: "temp_above_15", durationMs: t15.ms, start: t15.start, end: t15.end });
    }
    const h = longestRunMs(rdgs, (r) => r.humidity != null && r.humidity < 70);
    if (h.ms > 3 * DAY_MS) {
      flags.push({ rule: "humidity_below_70", durationMs: h.ms, start: h.start, end: h.end });
    }
    const l = longestRunMs(rdgs, (r) => r.light != null && r.light > 3);
    if (l.ms > 6 * HOUR_MS) {
      flags.push({ rule: "light_high", durationMs: l.ms, start: l.start, end: l.end });
    }

    out.push({
      serial,
      tripIds,
      internalTripIds,
      readings: rdgs,
      flags,
      lastTime: rdgs[rdgs.length - 1]?.time ?? null,
    });
  }
  return out;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  if (days >= 1) return `${days}d ${hours}h`;
  return `${hours}h`;
}
