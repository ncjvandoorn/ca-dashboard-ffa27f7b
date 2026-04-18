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

async function invoke(args: InvokeArgs) {
  const { data, error } = await supabase.functions.invoke("vesselfinder-track", {
    body: args,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { tracking?: VFTracking; items?: any[]; vfHttpStatus?: number; cached?: boolean };
}

/** Fetches single tracking row for a container. */
export function useVesselFinderTracking(containerId: string | null, isAdmin: boolean) {
  const [tracking, setTracking] = useState<VFTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!containerId || !isAdmin) return;
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
  }, [containerId, isAdmin]);

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
};

/** Lists which container_ids have active tracking — for table indicator. */
export function useVesselFinderActiveSet(isAdmin: boolean) {
  const [active, setActive] = useState<Map<string, VFActiveInfo>>(new Map());

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await invoke({ action: "list" });
        if (cancelled) return;
        const m = new Map<string, VFActiveInfo>();
        for (const item of res.items || []) {
          const resp = (item as any).response as VFResponse | null | undefined;
          // ETA = last schedule stop's last event date (e.g. "Vessel arrival at final POD")
          const lastStop = resp?.schedule?.[resp.schedule.length - 1];
          const lastEventDate = lastStop?.events?.length
            ? lastStop.events[lastStop.events.length - 1].date ?? null
            : null;
          const etaDate = lastEventDate ?? lastStop?.date ?? resp?.general?.destination?.date ?? null;
          m.set(item.container_id, {
            status: item.status,
            enabled: item.enabled,
            destinationName: resp?.general?.destination?.name ?? lastStop?.name ?? null,
            destinationDate: etaDate,
          });
        }
        setActive(m);
      } catch (e) {
        console.warn("VF list failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  return active;
}
