// Sensitech devices report temperature in either Celsius or Fahrenheit
// without a unit flag in the payload. Sea-freight containers operate
// between 0–4°C and never exceed ~40°C even pre-loading, so any value
// above 50 is treated as Fahrenheit and converted.
export function normalizeTempC(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value > 50) return Number((((value - 32) * 5) / 9).toFixed(1));
  return value;
}
