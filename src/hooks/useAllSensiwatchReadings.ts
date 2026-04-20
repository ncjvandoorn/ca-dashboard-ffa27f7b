import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeTempC } from "@/lib/sensorUnits";

export type LoggerReading = {
  serial: string;
  tripId: string;
  internalTripId: string;
  time: string; // ISO
  temp: number | null;
  humidity: number | null;
  light: number | null;
};

/**
 * Pull every reading from `sensiwatch_reports` for exception analysis.
 * Paginates in 1000-row chunks (PostgREST default cap) so we get the full
 * history. Heavy-ish but only invoked from the Data Loggers page.
 */
export function useAllSensiwatchReadings() {
  const [data, setData] = useState<LoggerReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const pageSize = 1000;
        let from = 0;
        const all: LoggerReading[] = [];
        // Hard cap at 50k rows to avoid runaway memory.
        for (let i = 0; i < 50; i++) {
          const { data: rows, error: qErr } = await supabase
            .from("sensiwatch_reports" as any)
            .select(
              "serial_number, trip_id, internal_trip_id, last_device_time, last_temp, last_humidity, last_light"
            )
            .not("serial_number", "is", null)
            .not("last_device_time", "is", null)
            .order("last_device_time", { ascending: true, nullsFirst: false })
            .range(from, from + pageSize - 1);
          if (qErr) throw new Error(qErr.message);
          if (!rows || rows.length === 0) break;
          for (const r of rows as any[]) {
            all.push({
              serial: r.serial_number,
              tripId: String(r.trip_id ?? ""),
              internalTripId: r.internal_trip_id ?? "",
              time: r.last_device_time,
              temp: normalizeTempC(r.last_temp),
              humidity: r.last_humidity ?? null,
              light: r.last_light ?? null,
            });
          }
          if (rows.length < pageSize) break;
          from += pageSize;
        }
        if (!cancelled) setData(all);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unknown error");
          setData([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
