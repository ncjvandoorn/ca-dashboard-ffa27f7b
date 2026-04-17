// Sensitech devices in this fleet report temperature in Fahrenheit
// without a unit flag in the payload. Confirmed by inspecting raw
// data: all devices report 34–74°F (= 1–23°C), which matches the
// expected cold-chain range for cut flowers. We always convert.
// Negative or sub-zero values are assumed to already be Celsius
// (defensive, in case Sensitech enables a Celsius device later).
export function normalizeTempC(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value < 10) return value; // already Celsius (cold chain or freezer)
  return Number((((value - 32) * 5) / 9).toFixed(1));
}
