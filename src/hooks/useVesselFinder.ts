import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VFLocation = {
  date?: number;
  country?: string;
  locode?: string;
  name?: string;
  latitude: number;
  longitude: number;
};

export type VFVessel = {
  imo?: number;
  mmsi?: number;
  name?: string;
  latitude: number;
  longitude: number;
  course?: number;
  speed?: number;
  aisTimestamp?: number;
};

export type VFScheduleItem = VFLocation & {
  events?: { code?: string; description?: string; date?: number; vessel?: VFVessel }[];
};

export type VFResponse = {
  status?: string;
  general?: {
    containerNumber?: string;
    carrier?: string;
    updatedAt?: number;
    cacheExpires?: number;
    progress?: number | null;
    origin?: VFLocation;
    destination?: VFLocation;
    currentLocation?: { vessel?: VFVessel; port?: VFLocation } | null;
  };
  schedule?: VFScheduleItem[];
};

export type VFTracking = {
  container_id: string;
  container_number_override: string | null;
  sealine: string | null;
  enabled: boolean;
  status: string;
  error_code: string | null;
  error_message: string | null;
  response: VFResponse | null;
  last_polled_at: string | null;
};

interface InvokeArgs {
  action: "enable" | "disable" | "refresh" | "get" | "list";
  containerId?: string;
  containerNumber?: string;
  sealine?: string | null;
  force?: boolean;
}

type VFListItem = {
  container_id: string;
  status: string;
  enabled: boolean;
  last_polled_at: string | null;
  container_number_override: string | null;
  response: VFResponse | null;
};

type InvokeResult = {
  tracking?: VFTracking;
  items?: VFListItem[];
  vfHttpStatus?: number;
  cached?: boolean;
};

const EMPTY_RESULT: InvokeResult = { items: [] };

async function invoke(args: InvokeArgs): Promise<InvokeResult> {
  // Guard: only call the edge function when a real user session exists.
  // Without it the function returns 401 (anon key is not a user JWT).
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return EMPTY_RESULT;

  const { data, error } = await supabase.functions.invoke("vesselfinder-track", {
    body: args,
  });
  if (error) {
    // Swallow auth/permission errors so they don't blank the page.
    if (/401|403|Unauthorized|Forbidden/i.test(String(error.message || ""))) {
      return EMPTY_RESULT;
    }
    throw new Error(error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as InvokeResult;
}

/** Fetches single tracking row for a container. Available to admins and customers. */
export function useVesselFinderTracking(containerId: string | null, enabled: boolean) {
  const [tracking, setTracking] = useState<VFTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!containerId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await invoke({ action: "get", containerId });
      setTracking(res.tracking ?? null);
    } catch (e: any) {
      setError(e?.message || "Failed to load tracking");
    } finally {
      setLoading(false);
    }
  }, [containerId, enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(
    async (containerNumber: string, sealine?: string | null, force = false) => {
      if (!containerId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await invoke({
          action: "enable",
          containerId,
          containerNumber,
          sealine: sealine || null,
          force,
        });
        setTracking(res.tracking ?? null);
        return res;
      } catch (e: any) {
        setError(e?.message || "Failed to enable tracking");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [containerId]
  );

  const disable = useCallback(async () => {
    if (!containerId) return;
    setLoading(true);
    try {
      await invoke({ action: "disable", containerId });
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [containerId, refresh]);

  return { tracking, loading, error, enable, disable, refresh };
}

export type VFActiveInfo = {
  status: string;
  enabled: boolean;
  destinationName?: string | null;
  destinationDate?: number | null;
  /** Last AIS / location update from VesselFinder (ms since epoch). */
  lastLocationAt?: number | null;
  /** Full VF response payload — used by the world map to draw routes/vessels. */
  response?: VFResponse | null;
};

/** Lists which container_ids have active tracking — for table indicator. */
export function useVesselFinderActiveSet(enabled: boolean) {
  const [active, setActive] = useState<Map<string, VFActiveInfo>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await invoke({ action: "list" });
        if (cancelled) return;
        const m = new Map<string, VFActiveInfo>();
        for (const item of res.items || []) {
          const resp = item.response;
          // ETA = "Vessel arrival at final POD" event (code: VAD) on the last schedule stop.
          // We deliberately do NOT take the *last* event of the stop because that is
          // usually a post-arrival gate-out / discharge event, not the ETA itself.
          const lastStop = resp?.schedule?.[resp.schedule.length - 1];
          const vadEvent = lastStop?.events?.find((e) => e?.code === "VAD");
          const etaDate = vadEvent?.date ?? lastStop?.date ?? resp?.general?.destination?.date ?? null;
          // Prefer vessel AIS timestamp; fallback to general updatedAt or last_polled_at.
          const vesselTs = resp?.general?.currentLocation?.vessel?.aisTimestamp ?? null;
          const generalTs = resp?.general?.updatedAt ?? null;
          const polledTs = item.last_polled_at
            ? Math.floor(new Date(item.last_polled_at).getTime() / 1000)
            : null;
          const lastLocSec = vesselTs ?? generalTs ?? polledTs ?? null;
          m.set(item.container_id, {
            status: item.status,
            enabled: item.enabled,
            destinationName: resp?.general?.destination?.name ?? lastStop?.name ?? null,
            destinationDate: etaDate,
            lastLocationAt: lastLocSec ? lastLocSec * 1000 : null,
            response: resp ?? null,
          });
        }
        setActive(m);
      } catch (e) {
        console.warn("VF list failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  return active;
}
