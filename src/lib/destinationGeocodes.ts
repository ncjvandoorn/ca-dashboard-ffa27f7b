// Static lat/lon for known SensiWatch destinations.
// Sensitech doesn't include coordinates with destination metadata, so we
// resolve well-known origins/destinations by name. Add new entries here as
// new destinations appear in the data.
export const DESTINATION_COORDS: Record<string, { lat: number; lon: number }> = {
  "Van den Berg Roses Delfgauw": { lat: 51.9952, lon: 4.4007 }, // Delfgauw, NL
  "Van den Berg Roses Kenya": { lat: -0.7172, lon: 36.4314 }, // Naivasha, KE
  "Chrysal Africa": { lat: -0.7264, lon: 36.4358 }, // Naivasha, KE
  "Flamingo Horticulture Kenya Ltd.": { lat: -0.7172, lon: 36.4314 }, // Naivasha, KE
};

export function lookupDestination(name?: string | null): { lat: number; lon: number } | null {
  if (!name) return null;
  return DESTINATION_COORDS[name] ?? null;
}
