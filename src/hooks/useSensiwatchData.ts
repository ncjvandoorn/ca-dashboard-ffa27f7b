import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SFTrip } from "@/pages/ActiveSF";

// Map raw SensiWatch API data to our SFTrip type
// The exact field mapping will adapt once we see real API responses
function mapApiTrip(raw: any): SFTrip {
  return {
    tripId: String(raw.TripId ?? raw.tripId ?? raw.Id ?? raw.id ?? ""),
    tripStatus: raw.TripStatus ?? raw.tripStatus ?? raw.Status ?? raw.status ?? "Unknown",
    internalTripId: raw.InternalTripId ?? raw.internalTripId ?? raw.OrderNumber ?? raw.orderNumber ?? "",
    originName: raw.OriginName ?? raw.originName ?? raw.Origin ?? raw.origin ?? "",
    originAddress: raw.OriginAddress ?? raw.originAddress ?? raw.Address ?? raw.address ?? "",
    carrier: raw.Carrier ?? raw.carrier ?? "",
    stops: raw.Stops ?? raw.stops ?? raw.NumberOfStops ?? 0,
    plannedDepartureTime: raw.PlannedDepartureTime ?? raw.plannedDepartureTime ?? null,
    actualDepartureTime: raw.ActualDepartureTime ?? raw.actualDepartureTime ?? null,
    latitude: raw.Latitude ?? raw.latitude ?? raw.LastLatitude ?? raw.lastLatitude ?? null,
    longitude: raw.Longitude ?? raw.longitude ?? raw.LastLongitude ?? raw.lastLongitude ?? null,
    serialNumber: raw.SerialNumber ?? raw.serialNumber ?? raw.MonitorSerialNumber ?? null,
    lastTemp: raw.LastTemp ?? raw.lastTemp ?? raw.Temperature ?? raw.temperature ?? null,
    lastLight: raw.LastLight ?? raw.lastLight ?? raw.Light ?? raw.light ?? null,
    lastHumidity: raw.LastHumidity ?? raw.lastHumidity ?? raw.Humidity ?? raw.humidity ?? null,
    lastReadingTime: raw.LastReadingTime ?? raw.lastReadingTime ?? raw.LastUpdate ?? raw.lastUpdate ?? null,
    lastLocation: raw.LastLocation ?? raw.lastLocation ?? raw.LocationAddress ?? raw.locationAddress ?? null,
  };
}

export function useSensiwatchTrips() {
  const [data, setData] = useState<SFTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("sensiwatch-data", {
        body: { action: "search" },
      });

      if (fnError) {
        throw new Error(fnError.message || "Failed to fetch trips");
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      const trips = result?.trips ?? result ?? [];
      const mapped = Array.isArray(trips) ? trips.map(mapApiTrip).filter((t: SFTrip) => t.tripId) : [];

      // Deduplicate by tripId (keep first occurrence)
      const seen = new Set<string>();
      const unique = mapped.filter((t: SFTrip) => {
        if (seen.has(t.tripId)) return false;
        seen.add(t.tripId);
        return true;
      });

      setData(unique);
    } catch (err: any) {
      console.error("SensiWatch fetch error:", err);
      setError(err?.message || "Unknown error");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  return { data, isLoading, error, refetch: fetchTrips };
}

// Fetch monitor readings for a specific trip (by serial number and date range)
export function useSensiwatchReadings(serialNumber: string | null, departureTime: string | null) {
  const [readings, setReadings] = useState<{ time: string; temp: number; light: number; humidity: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!serialNumber) {
      setReadings([]);
      return;
    }

    let cancelled = false;
    const fetchReadings = async () => {
      setIsLoading(true);
      try {
        // Try fetching by serial number
        const { data: result, error: fnError } = await supabase.functions.invoke("sensiwatch-data", {
          body: { serialNumber },
        });

        if (cancelled) return;

        if (fnError || result?.error) {
          console.warn("Could not fetch readings:", fnError?.message || result?.error);
          setReadings([]);
          return;
        }

        // Parse readings from response - adapt to actual format
        const raw = Array.isArray(result) ? result : (result?.readings ?? result?.data ?? []);
        const mapped = raw.map((r: any) => ({
          time: r.DateTime ?? r.dateTime ?? r.Time ?? r.time ?? "",
          temp: r.Temperature ?? r.temperature ?? r.Temp ?? r.temp ?? 0,
          light: r.Light ?? r.light ?? 0,
          humidity: r.Humidity ?? r.humidity ?? 0,
        }));
        setReadings(mapped);
      } catch (err) {
        console.error("Readings fetch error:", err);
        if (!cancelled) setReadings([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchReadings();
    return () => { cancelled = true; };
  }, [serialNumber]);

  return { readings, isLoading };
}
