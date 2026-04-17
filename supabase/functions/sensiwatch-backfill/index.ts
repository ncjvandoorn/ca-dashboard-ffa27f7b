// One-shot backfill: pulls historical trip data from the legacy SensiWatch
// REST API (GetData) and inserts it into sensiwatch_reports so it shows up
// on the dashboard alongside live push data.
//
// POST body: { days?: number }   // default 30
// Returns:   { dayCount, tripsFetched, rowsInserted, errors }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function latestSensor(sensors: any[], id: string): { value: number | null; time: number | null } {
  const matches = (sensors || []).filter((s) => String(s?.sensorId).toLowerCase() === id.toLowerCase());
  if (!matches.length) return { value: null, time: null };
  matches.sort((a, b) => (b?.timestamp?.deviceTime ?? 0) - (a?.timestamp?.deviceTime ?? 0));
  const top = matches[0];
  const v = Number(top?.value);
  return {
    value: Number.isFinite(v) ? v : null,
    time: top?.timestamp?.deviceTime ?? null,
  };
}

function tsToIso(ms: number | null | undefined): string | null {
  if (!ms || !Number.isFinite(Number(ms))) return null;
  try { return new Date(Number(ms)).toISOString(); } catch { return null; }
}

function numOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "NaN") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Convert one DeviceReport-shaped object into a sensiwatch_reports row.
// Each report has many locations — we expand them into multiple rows so the
// dashboard map can show the full historical trail.
function reportToRows(report: any): any[] {
  const id = report?.deviceIdentity ?? {};
  const trip = report?.swpTrip ?? {};
  const sensors: any[] = Array.isArray(report?.sensors) ? report.sensors : [];
  const locations: any[] = Array.isArray(report?.locations) ? report.locations : [];

  const baseTemp = latestSensor(sensors, "temperature");
  const baseHum = latestSensor(sensors, "humidity");
  const baseLight = latestSensor(sensors, "light");

  const baseRow = {
    serial_number: id.sensitechSerialNumber ?? id.deviceName ?? null,
    device_name: id.deviceName ?? null,
    trip_id: trip.tripId != null ? String(trip.tripId) : null,
    trip_guid: trip.tripGuid ?? null,
    internal_trip_id: trip.internalTripId ?? null,
    trailer_id: trip.trailerId ?? null,
    container_number: trip.containerNumber ?? trip.ContainerNumber ?? null,
    mode_of_transport: trip.modeOfTransport ?? trip.ModeOfTransport ?? null,
    destinations: trip.destinations ?? null,
  };

  if (!locations.length) {
    // No location: fall back to single row with sensor data only
    return [{
      ...baseRow,
      last_latitude: null,
      last_longitude: null,
      last_address: null,
      last_temp: baseTemp.value,
      last_humidity: baseHum.value,
      last_light: baseLight.value,
      last_device_time: tsToIso(baseTemp.time ?? baseHum.time ?? baseLight.time),
      last_receive_time: null,
      raw: report,
    }];
  }

  // Sort locations chronologically
  const sorted = [...locations].sort(
    (a, b) => (a?.timestamp?.deviceTime ?? 0) - (b?.timestamp?.deviceTime ?? 0)
  );

  // For each location, find the closest sensor reading by deviceTime
  return sorted.map((loc) => {
    const locTime = loc?.timestamp?.deviceTime ?? null;
    const nearestSensor = (kind: string): number | null => {
      const matches = sensors.filter((s) => String(s?.sensorId).toLowerCase() === kind.toLowerCase());
      if (!matches.length || locTime == null) return null;
      matches.sort((a, b) =>
        Math.abs((a?.timestamp?.deviceTime ?? 0) - locTime) -
        Math.abs((b?.timestamp?.deviceTime ?? 0) - locTime)
      );
      const v = Number(matches[0]?.value);
      return Number.isFinite(v) ? v : null;
    };

    return {
      ...baseRow,
      last_latitude: numOrNull(loc?.latitude),
      last_longitude: numOrNull(loc?.longitude),
      last_address: loc?.address ?? null,
      last_temp: nearestSensor("temperature") ?? baseTemp.value,
      last_humidity: nearestSensor("humidity") ?? baseHum.value,
      last_light: nearestSensor("light") ?? baseLight.value,
      last_device_time: tsToIso(locTime),
      last_receive_time: tsToIso(loc?.timestamp?.receiveTime),
      raw: { ...report, _backfilledLocation: loc },
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SENSIWATCH_API_KEY = Deno.env.get("SENSIWATCH_API_KEY");
  const SENSIWATCH_BASE_URL = Deno.env.get("SENSIWATCH_BASE_URL");
  if (!SENSIWATCH_API_KEY || !SENSIWATCH_BASE_URL) {
    return new Response(JSON.stringify({ error: "SENSIWATCH_API_KEY/BASE_URL not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty body */ }
  const days = Math.min(Math.max(Number(body?.days) || 30, 1), 90);

  const baseUrl = SENSIWATCH_BASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}/api/GetData?APIKey=${encodeURIComponent(SENSIWATCH_API_KEY)}`;
  const errors: string[] = [];
  const allReports: any[] = [];
  const seen = new Set<string>(); // de-dupe by tripId+deviceTime

  console.log(`[sensiwatch-backfill] Starting ${days}-day backfill`);

  const now = new Date();
  for (let d = 0; d < days; d++) {
    const dayEnd = new Date(now.getTime() - d * 86400000);
    const dayStart = new Date(dayEnd.getTime() - 86400000);
    const payload = {
      FeedTimeFrom: dayStart.toISOString().slice(0, 19),
      FeedTimeTo: dayEnd.toISOString().slice(0, 19),
    };

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      if (!resp.ok) {
        try {
          const errData = JSON.parse(text);
          if (errData.Result && errData.Result !== "Couldn't process the request") {
            errors.push(`Day ${d}: ${errData.Result}`);
          }
        } catch { errors.push(`Day ${d}: HTTP ${resp.status}`); }
        continue;
      }
      let data: any;
      try { data = JSON.parse(text); } catch { continue; }
      const items = Array.isArray(data) ? data : (data && typeof data === "object" && !data.Result ? [data] : []);
      for (const it of items) {
        const key = `${it?.swpTrip?.tripId ?? ""}|${it?.deviceIdentity?.sensitechSerialNumber ?? ""}|${(it?.locations?.[0]?.timestamp?.deviceTime ?? 0)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allReports.push(it);
      }
    } catch (err) {
      errors.push(`Day ${d}: ${err instanceof Error ? err.message : "fetch error"}`);
    }
    if (d < days - 1) await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[sensiwatch-backfill] Pulled ${allReports.length} unique reports, expanding to rows`);

  // Expand each report to one row per location, then insert in batches
  const rows: any[] = [];
  for (const r of allReports) {
    rows.push(...reportToRows(r));
  }

  console.log(`[sensiwatch-backfill] Inserting ${rows.length} rows`);

  // Insert in batches of 200 to avoid request size limits
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase.from("sensiwatch_reports").insert(batch);
    if (error) {
      errors.push(`Insert batch ${i}-${i + batch.length}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return new Response(JSON.stringify({
    daysSearched: days,
    reportsFetched: allReports.length,
    rowsInserted: inserted,
    errors,
  }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
