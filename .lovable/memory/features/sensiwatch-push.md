---
name: SensiWatch Push API
description: Live tracker data from Sensitech is received via Push API into sensiwatch_reports / sensiwatch_activations tables; dashboard reads from sensiwatch_trip_latest view
type: feature
---
SensiWatch (Sensitech) integration uses the **Push API** (REST V4), not polling.

**Endpoints (public, no JWT):**
- `POST {SUPABASE_FN_URL}/sensiwatch-push/device/activation`
- `POST {SUPABASE_FN_URL}/sensiwatch-push/device/report`

**Auth:** Optional shared secret. If `SENSIWATCH_PUSH_SECRET` env var is set on the function, requests must include header `X-Push-Secret: <value>`. Configure Sensitech to send this header.

**Storage:**
- `sensiwatch_activations` — one row per DeviceActivation
- `sensiwatch_reports` — one row per DeviceReport, with extracted last temp/humidity/light/lat/lon + raw jsonb
- `sensiwatch_trip_latest` view — latest report per `trip_id` (security_invoker=true)

**RLS:** Only admins and internal `user` role can read; only the edge function (service role) writes.

**Frontend:** `useSensiwatchTrips` hook in `src/hooks/useSensiwatchData.ts` queries the view, derives `tripStatus` from age of last reading (< 6h = In Transit, < 72h = Idle, else Stale).

**Spec compliance:**
- ACK with HTTP 200 immediately (Sensitech retries up to 120h otherwise)
- Sensitech static IP for whitelisting: `20.124.145.167`
- Intermodal fields supported: `swpTrip.containerNumber`, `swpTrip.modeOfTransport`

**Legacy:** `sensiwatch-data` edge function (poll-based GetData) is kept but no longer used by the dashboard.
