// SensiWatch Push API receiver
// Public endpoints (no JWT) — Sensitech POSTs DeviceActivation and DeviceReport here.
// Routes:
//   POST /sensiwatch-push/device/activation
//   POST /sensiwatch-push/device/report
//
// Optional shared-secret auth: set SENSIWATCH_PUSH_SECRET. If set, the request
// must include header "X-Push-Secret: <value>". Sensitech can be configured to
// send any custom request headers — share this value with their integration team.
//
// Responses: 200 OK (acknowledged) or 401 (bad secret) / 400 (bad json) / 500.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUSH_SECRET = Deno.env.get("SENSIWATCH_PUSH_SECRET"); // optional

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Pick the latest sensor reading by timestamp.deviceTime
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Optional auth
  if (PUSH_SECRET) {
    const provided = req.headers.get("x-push-secret") ?? req.headers.get("X-Push-Secret");
    if (provided !== PUSH_SECRET) {
      console.warn("sensiwatch-push: rejected — bad/missing X-Push-Secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const url = new URL(req.url);
  // Accept any path that ends in /device/activation or /device/report
  const path = url.pathname.toLowerCase();
  const isActivation = path.endsWith("/device/activation");
  const isReport = path.endsWith("/device/report");

  if (!isActivation && !isReport) {
    return new Response(JSON.stringify({ error: "Not found", path: url.pathname }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (e) {
    console.error("sensiwatch-push: invalid JSON", e);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (isActivation) {
      const id = payload?.deviceIdentity ?? {};
      const row = {
        serial_number: id.sensitechSerialNumber ?? id.deviceName ?? null,
        device_name: id.deviceName ?? null,
        org_unit: id.orgUnit != null ? String(id.orgUnit) : null,
        activation_time: tsToIso(payload?.activationTime),
        raw: payload,
      };
      const { error } = await supabase.from("sensiwatch_activations").insert(row);
      if (error) throw error;
      console.log("sensiwatch-push: activation stored", row.serial_number);
    } else {
      // DeviceReport
      const id = payload?.deviceIdentity ?? {};
      const locations: any[] = Array.isArray(payload?.locations) ? payload.locations : [];
      // Take the most recent location by deviceTime
      const sortedLocs = [...locations].sort(
        (a, b) => (b?.timestamp?.deviceTime ?? 0) - (a?.timestamp?.deviceTime ?? 0)
      );
      const loc = sortedLocs[0] ?? {};

      const sensors: any[] = Array.isArray(payload?.sensors) ? payload.sensors : [];
      const temp = latestSensor(sensors, "temperature");
      const hum = latestSensor(sensors, "humidity");
      const lit = latestSensor(sensors, "light");

      const trip = payload?.swpTrip ?? {};
      // Find the latest sensor/location time for "last reading"
      const allTimes = [
        loc?.timestamp?.deviceTime,
        temp.time, hum.time, lit.time,
      ].filter((t) => Number.isFinite(Number(t))) as number[];
      const lastDeviceTime = allTimes.length ? Math.max(...allTimes) : null;
      const lastReceiveTime = loc?.timestamp?.receiveTime ?? null;

      const row = {
        serial_number: id.sensitechSerialNumber ?? id.deviceName ?? null,
        device_name: id.deviceName ?? null,
        trip_id: trip.tripId != null ? String(trip.tripId) : null,
        trip_guid: trip.tripGuid ?? null,
        internal_trip_id: trip.internalTripId ?? null,
        trailer_id: trip.trailerId ?? null,
        container_number: trip.containerNumber ?? trip.ContainerNumber ?? null,
        mode_of_transport: trip.modeOfTransport ?? trip.ModeOfTransport ?? null,
        last_latitude: numOrNull(loc?.latitude),
        last_longitude: numOrNull(loc?.longitude),
        last_address: loc?.address ?? null,
        last_temp: temp.value,
        last_humidity: hum.value,
        last_light: lit.value,
        last_device_time: tsToIso(lastDeviceTime),
        last_receive_time: tsToIso(lastReceiveTime),
        destinations: trip.destinations ?? null,
        raw: payload,
      };
      const { error } = await supabase.from("sensiwatch_reports").insert(row);
      if (error) throw error;
      console.log("sensiwatch-push: report stored", row.serial_number, "trip", row.trip_id);
    }

    // Per spec: ack with 200 BEFORE doing heavy processing.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sensiwatch-push: store error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
