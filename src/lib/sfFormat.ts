// Utilities for the Active Sea Freight page

// Strip "-1", "-2" datalogger suffix from internal trip ID to get the order number
export function stripLoggerSuffix(internalId: string): string {
  return (internalId || "").replace(/-\d+$/, "");
}

export function formatShortDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
