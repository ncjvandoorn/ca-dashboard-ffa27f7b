import * as XLSX from "xlsx";
import { getDataFileUrl } from "./dataFileUrl";

export interface Trial {
  trialNumber: string;
  trialReference: string;
  trialType: "VL" | "SF";
  trialClient: string;
  customer: string;
  farm: string;
  harvestDate: string;
  startDate: string;
  caDuration: number;
  vlDuration: number;
  vlStart: string;
  vlEnd: string;
  completed: string;
  bunches: number;
  boxes: number;
  caChamber: string;
  flowerCrop: string;
  variety: string;
}

function parseDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    // Try parsing other formats
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val);
}

export async function loadTrials(): Promise<Trial[]> {
  const response = await fetch("/data/trials.xlsx");
  const buffer = await response.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

  return rows.map((r: any) => ({
    trialNumber: String(r["Trial Number"] || "").trim(),
    trialReference: String(r["Trial Reference"] || "").trim(),
    trialType: (String(r["TrialType"] || "VL").trim().toUpperCase() === "SF" ? "SF" : "VL") as "VL" | "SF",
    trialClient: String(r["Trial Client"] || "").trim(),
    customer: String(r["Customer"] || "").trim(),
    farm: String(r["Farm"] || "").trim(),
    harvestDate: parseDate(r["Harvest Date"]),
    startDate: parseDate(r["Start Date"]),
    caDuration: parseInt(r["CA duration"]) || 0,
    vlDuration: parseInt(r["VL duration"]) || 14,
    vlStart: parseDate(r["VL Start"]),
    vlEnd: parseDate(r["VL End"]),
    completed: parseDate(r["Completed"]),
    bunches: parseInt(r["Bunches"]) || 0,
    boxes: parseInt(r["Boxes"]) || 0,
    caChamber: String(r["CA Chamber"] || "").trim(),
    flowerCrop: String(r["Flower Crop"] || "").trim(),
    variety: String(r["Variety"] || "").trim(),
  })).filter((t) => t.trialNumber !== "");
}

/** Trial info attached to a capacity row */
export interface CapacityTrialInfo {
  trial: Trial;
  phase: "ca" | "transport" | "vl";
  chamber?: string;
}

/** Build capacity table: for each date, how many boxes in CA1-CA4, vases in Transport/Retail & VL Room */
export interface CapacityRow {
  date: string;
  ca1: number;
  ca2: number;
  ca3: number;
  ca4: number;
  transport: number;
  vlRoom: number;
  total: number;
  trials: CapacityTrialInfo[];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function parseChambers(chamberStr: string): string[] {
  if (!chamberStr) return [];
  return chamberStr.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
}

export function buildCapacityTable(trials: Trial[], startDate: string, days: number): CapacityRow[] {
  const rows: CapacityRow[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const row: CapacityRow = { date, ca1: 0, ca2: 0, ca3: 0, ca4: 0, transport: 0, vlRoom: 0, total: 0, trials: [] };

    for (const trial of trials) {
      if (!trial.startDate || !trial.vlStart || !trial.vlEnd) continue;

      if (trial.trialType === "VL") {
        if (trial.bunches <= 0) continue;
        if (date >= trial.vlStart && date < trial.vlEnd) {
          row.vlRoom += trial.bunches;
          row.trials.push({ trial, phase: "vl" });
        }
      } else {
        // SF trial
        const caEnd = addDays(trial.startDate, trial.caDuration);
        const chambers = parseChambers(trial.caChamber);

        if (date >= trial.startDate && date < caEnd) {
          // CA phase uses BOXES
          const boxes = trial.boxes > 0 ? trial.boxes : 1;
          const boxesPerChamber = chambers.length > 0 ? Math.ceil(boxes / chambers.length) : 0;
          for (const ch of chambers) {
            if (ch === "CA1") row.ca1 += boxesPerChamber;
            else if (ch === "CA2") row.ca2 += boxesPerChamber;
            else if (ch === "CA3") row.ca3 += boxesPerChamber;
            else if (ch === "CA4") row.ca4 += boxesPerChamber;
          }
          row.trials.push({ trial, phase: "ca", chamber: trial.caChamber });
        } else if (date >= caEnd && date < trial.vlStart) {
          if (trial.bunches <= 0) continue;
          row.transport += trial.bunches;
          row.trials.push({ trial, phase: "transport" });
        } else if (date >= trial.vlStart && date < trial.vlEnd) {
          if (trial.bunches <= 0) continue;
          row.vlRoom += trial.bunches;
          row.trials.push({ trial, phase: "vl" });
        }
      }
    }

    row.total = row.ca1 + row.ca2 + row.ca3 + row.ca4 + row.transport + row.vlRoom;
    rows.push(row);
  }

  return rows;
}
