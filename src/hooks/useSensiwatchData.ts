import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SFTrip } from "@/pages/ActiveSF";

// Map a row from the sensiwatch_trip_latest view to our SFTrip type.
function mapRow(row: any): SFTrip {
  // Derive a status from recency of the last reading
  let status = "Unknown";
  if (row.last_device_time) {
    const ageH = (Date.now() - new Date(row.last_device_time).getTime()) / 3600000;
    if (ageH < 6) status = "In Transit";
    else if (ageH < 72) status = "Idle";
    else status = "Stale";
  }
  // Origin = first destination if present
  const dests = Array.isArray(row.destinations) ? row.destinations : [];
  const origin = dests[0] ?? {};

  return {
    tripId: String(row.trip_id ?? ""),
    tripStatus: status,
    internalTripId: row.internal_trip_id ?? "",
    originName: origin.name ?? "",
    originAddress: row.last_address ?? "",
    carrier: row.mode_of_transport ?? "",
    stops: dests.length,
    plannedDepartureTime: null,
    actualDepartureTime: row.last_device_time ?? null,
    latitude: row.last_latitude,
    longitude: row.last_longitude,
    serialNumber: row.serial_number ?? null,
    lastTemp: row.last_temp,
    lastLight: row.last_light,
    lastHumidity: row.last_humidity,
    lastReadingTime: row.last_device_time ?? null,
    lastLocation: row.last_address ?? null,
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
      const { data: rows, error: qErr } = await supabase
        .from("sensiwatch_trip_latest" as any)
        .select("*")
        .order("last_device_time", { ascending: false, nullsFirst: false })
        .limit(1000);

      if (qErr) throw new Error(qErr.message);
      const mapped = (rows ?? []).map(mapRow).filter((t) => t.tripId);
      setData(mapped);
    } catch (err: any) {
      console.error("SensiWatch fetch error:", err);
      setError(err?.message || "Unknown error");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  return { data, isLoading, error, refetch: fetchTrips };
}

// Fetch the time series of readings for a serial number from sensiwatch_reports.
export function useSensiwatchReadings(serialNumber: string | null, _departureTime: string | null) {
  const [readings, setReadings] = useState<{ time: string; temp: number; light: number; humidity: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!serialNumber) { setReadings([]); return; }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const { data: rows, error } = await supabase
          .from("sensiwatch_reports" as any)
          .select("last_device_time, last_temp, last_light, last_humidity")
          .eq("serial_number", serialNumber)
          .order("last_device_time", { ascending: true, nullsFirst: false })
          .limit(1000);
        if (cancelled) return;
        if (error) {
          console.warn("Could not fetch readings:", error.message);
          setReadings([]); return;
        }
        const mapped = (rows ?? []).map((r: any) => ({
          time: r.last_device_time ?? "",
          temp: r.last_temp ?? 0,
          light: r.last_light ?? 0,
          humidity: r.last_humidity ?? 0,
        }));
        setReadings(mapped);
      } catch (err) {
        console.error("Readings fetch error:", err);
        if (!cancelled) setReadings([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serialNumber]);

  return { readings, isLoading };
}
