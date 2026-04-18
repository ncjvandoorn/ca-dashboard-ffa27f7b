import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";

export interface DataFileDef {
  key: string;
  label: string;
  accept: string;
}

export const DATA_FILES: DataFileDef[] = [
  { key: "trials.xlsx", label: "Trials Data", accept: ".xlsx" },
  { key: "qualityReport.csv", label: "Quality Report", accept: ".csv" },
  { key: "account.csv", label: "ALL Accounts", accept: ".csv" },
  { key: "activity.csv", label: "Activity Data", accept: ".csv" },
  { key: "user.csv", label: "ALL Users", accept: ".csv" },
  { key: "customerFarm.csv", label: "Customer-Farm Links", accept: ".csv" },
  { key: "container.csv", label: "Containers", accept: ".csv" },
  { key: "servicesOrder.csv", label: "Services Orders", accept: ".csv" },
  { key: "servicesOrderDatalogdevice.csv", label: "Order ↔ Datalogger Links", accept: ".csv" },
  { key: "shipperArrival.csv", label: "Shipper Arrivals", accept: ".csv" },
  { key: "shipperReport.csv", label: "Shipper Reports", accept: ".csv" },
  { key: "shippingLine.csv", label: "Shipping Lines", accept: ".csv" },
];

export const ALLOWED_FILENAMES = new Set(DATA_FILES.map((f) => f.key));

/** Filename (lowercased) → canonical storage filename */
export const FILENAME_ALIASES: Record<string, string> = {
  "all_account.csv": "account.csv",
  "all_user.csv": "user.csv",
};

/** Map filenames to react-query cache keys so we can invalidate after upload */
export const FILE_QUERY_KEY_MAP: Record<string, string> = {
  "qualityReport.csv": "qualityReports",
  "account.csv": "accounts",
  "activity.csv": "activities",
  "user.csv": "users",
  "customerFarm.csv": "customerFarms",
  "container.csv": "containers",
  "servicesOrder.csv": "servicesOrders",
  "servicesOrderDatalogdevice.csv": "servicesOrderDatalogdevices",
  "shipperArrival.csv": "shipperArrivals",
  "shipperReport.csv": "shipperReports",
  "shippingLine.csv": "shippingLines",
};

/** Map CSV filenames to the columns that contain Unix-ms timestamps */
export const TIMESTAMP_COLUMNS: Record<string, string[]> = {
  "activity.csv": ["startsAt", "completedAt", "createdAt"],
  "qualityReport.csv": ["createdAt", "submittedAt"],
  "customerFarm.csv": ["createdAt", "deletedAt"],
  "container.csv": ["dropoffDate", "shippingDate"],
  "servicesOrder.csv": [
    "dippingDate",
    "openedAt",
    "closedAt",
    "approvedCsAt",
    "approvedMtAt",
    "cancelledAt",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ],
  "shipperArrival.csv": ["arrivalDate", "createdAt", "updatedAt", "deletedAt"],
  "shipperReport.csv": [
    "stuffingDate",
    "approvedMtAt",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "closedAt",
  ],
};

/** Convert Unix-ms timestamp columns in a CSV file to ISO date strings before uploading */
export const convertTimestampsInCsv = async (filename: string, file: File): Promise<File> => {
  const cols = TIMESTAMP_COLUMNS[filename];
  if (!cols) return file;

  const text = await file.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h: string) => h.trim(),
  });

  const rows = parsed.data as Record<string, string>[];
  for (const row of rows) {
    for (const col of cols) {
      const val = row[col];
      if (!val || val.trim() === "") continue;
      const num = Number(val);
      if (!isNaN(num) && num > 946684800000) {
        row[col] = new Date(num).toISOString();
      }
    }
  }

  const csv = Papa.unparse(rows);
  return new File([csv], filename, { type: "text/csv" });
};

export interface UploadResult {
  success: number;
  failed: string[];
  unknown: string[];
}

/** Upload many files in one go, auto-routing each by filename. */
export const bulkUploadFiles = async (
  files: File[],
  invalidateQueryKey: (key: string) => Promise<void>,
): Promise<UploadResult> => {
  const recognized: { file: File; targetName: string }[] = [];
  const unknown: string[] = [];

  for (const f of files) {
    const lower = f.name.toLowerCase();
    const targetName = FILENAME_ALIASES[lower] ?? f.name;
    if (ALLOWED_FILENAMES.has(targetName)) {
      recognized.push({
        file: targetName === f.name ? f : new File([f], targetName, { type: f.type }),
        targetName,
      });
    } else {
      unknown.push(f.name);
    }
  }

  let success = 0;
  const failed: string[] = [];

  for (const { file, targetName } of recognized) {
    try {
      const processed = targetName.endsWith(".csv")
        ? await convertTimestampsInCsv(targetName, file)
        : file;
      const { error } = await supabase.storage
        .from("data-files")
        .upload(targetName, processed, { upsert: true, cacheControl: "0" });
      if (error) throw error;
      const queryKey = FILE_QUERY_KEY_MAP[targetName];
      if (queryKey) await invalidateQueryKey(queryKey);
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push(`${targetName} (${msg})`);
    }
  }

  return { success, failed, unknown };
};
