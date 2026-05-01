// Geocoding helpers for the Customers map.
// Primary cache: Supabase (shared across users). Fallback: localStorage.
// Uses Nominatim (OpenStreetMap) for unknown addresses.
// Plus Codes (Open Location Codes) embedded in CSV addresses don't geocode via
// Nominatim, so we strip them and fall back to the place + country part.

import { supabase } from "@/integrations/supabase/client";
import { DESTINATION_COORDS } from "./destinationGeocodes";

export interface GeoResult {
  lat: number;
  lon: number;
  source: "known" | "nominatim" | "city";
}

const CACHE_KEY = "customer_geocode_cache_v1";
const NEG_TTL = 7 * 24 * 60 * 60 * 1000; // 7d for negative results

interface CacheEntry {
  lat: number | null;
  lon: number | null;
  source?: GeoResult["source"];
  ts: number;
}

function loadLocalCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalCache(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota
  }
}

/** In-memory snapshot of the cloud cache, populated by preloadCloudCache(). */
let cloudCache: Record<string, CacheEntry> = {};

/**
 * Load the entire cloud geocode cache once per page session.
 * Call this before iterating over customers — it makes subsequent geocodes synchronous for cached entries.
 */
export async function preloadCloudCache(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("customer_geocode_cache")
      .select("address_key, lat, lon, source, updated_at");
    if (error || !data) return;
    const next: Record<string, CacheEntry> = {};
    for (const row of data) {
      next[row.address_key] = {
        lat: row.lat,
        lon: row.lon,
        source: (row.source as GeoResult["source"]) ?? undefined,
        ts: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
      };
    }
    cloudCache = next;
  } catch {
    // network failure → fall back to local cache only
  }
}

async function writeCloudCache(addressKey: string, nameHint: string, entry: CacheEntry) {
  cloudCache[addressKey] = entry;
  try {
    await supabase
      .from("customer_geocode_cache")
      .upsert(
        {
          address_key: addressKey,
          name_hint: nameHint,
          lat: entry.lat,
          lon: entry.lon,
          source: entry.source ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "address_key" },
      );
  } catch {
    // ignore — local cache already updated
  }
}

/**
 * Strip a Plus Code (e.g. "59FC+XQ5", "39X4 +V7P") from the start of an address.
 */
function stripPlusCode(addr: string): string {
  let s = addr.trim().replace(/^"+/, "");
  s = s.replace(/^[A-Z0-9]{2,8}\s*\+?\s*[A-Z0-9]{2,4}\s*,\s*/i, "");
  return s.trim();
}

function cityCountryOnly(addr: string): string {
  const parts = stripPlusCode(addr)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return addr;
  return parts.slice(-2).join(", ");
}

async function nominatim(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (!isFinite(lat) || !isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

/**
 * Geocode an account by name + delivery address.
 * Lookup order: known → cloud cache → local cache → Nominatim.
 * When forceRefresh is true, the cache is bypassed and the result re-written.
 */
export async function geocodeCustomer(
  name: string,
  address: string,
  forceRefresh = false,
): Promise<GeoResult | null> {
  // 1. Hardcoded known customer destinations.
  const known = DESTINATION_COORDS[name];
  if (known) return { ...known, source: "known" };

  if (!address) return null;

  const cacheKey = address.trim().toLowerCase();

  if (!forceRefresh) {
    // 2a. Cloud cache (preloaded)
    const cloudHit = cloudCache[cacheKey];
    if (cloudHit) {
      if (cloudHit.lat != null && cloudHit.lon != null) {
        return { lat: cloudHit.lat, lon: cloudHit.lon, source: cloudHit.source ?? "nominatim" };
      }
      if (Date.now() - cloudHit.ts < NEG_TTL) return null;
    }
    // 2b. Local cache fallback
    const local = loadLocalCache();
    const localHit = local[cacheKey];
    if (localHit) {
      if (localHit.lat != null && localHit.lon != null) {
        return { lat: localHit.lat, lon: localHit.lon, source: localHit.source ?? "nominatim" };
      }
      if (Date.now() - localHit.ts < NEG_TTL) return null;
    }
  }

  // 3. Try cleaned address on Nominatim, then fall back to city + country.
  let result: GeoResult | null = null;
  const cleaned = stripPlusCode(address);
  let geo = await nominatim(cleaned);
  if (geo) {
    result = { ...geo, source: "nominatim" };
  } else {
    const cc = cityCountryOnly(address);
    if (cc && cc !== cleaned) {
      geo = await nominatim(cc);
      if (geo) result = { ...geo, source: "city" };
    }
  }

  const entry: CacheEntry = {
    lat: result?.lat ?? null,
    lon: result?.lon ?? null,
    source: result?.source,
    ts: Date.now(),
  };

  // Persist locally and to cloud.
  const local = loadLocalCache();
  local[cacheKey] = entry;
  saveLocalCache(local);
  await writeCloudCache(cacheKey, name, entry);

  return result;
}

/** Filter for accounts whose delivery (or main) address ends in Kenya. */
export function isKenyaAccount(addr1: string, addr2: string): boolean {
  const a = `${addr1} ${addr2}`.toLowerCase();
  return /\bkenya\b/.test(a);
}

/** Pick the best address for a customer (delivery preferred, fall back to main). */
export function bestAddress(deliveryAddress: string, mainAddress: string): string {
  return (deliveryAddress || mainAddress || "").trim();
}
