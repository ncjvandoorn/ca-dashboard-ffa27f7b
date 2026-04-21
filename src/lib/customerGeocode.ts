// Geocoding helpers for the Customers map.
// Uses Nominatim (OpenStreetMap) for unknown addresses, with localStorage caching.
// Plus Codes (Open Location Codes) embedded in CSV addresses don't geocode via
// Nominatim, so we strip them and fall back to the place + country part.

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

function loadCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota
  }
}

/**
 * Strip a Plus Code (e.g. "59FC+XQ5", "39X4 +V7P") from the start of an address.
 * Plus Codes are 4–8 chars before a "+" then a few chars after.
 */
function stripPlusCode(addr: string): string {
  // Remove leading plus codes like `"59FC XQ5,` or `"4C69 +J48,` or `59FC+XQ5,`
  let s = addr.trim().replace(/^"+/, "");
  s = s.replace(/^[A-Z0-9]{2,8}\s*\+?\s*[A-Z0-9]{2,4}\s*,\s*/i, "");
  return s.trim();
}

/** Best-effort city/country extraction from a comma-separated address. */
function cityCountryOnly(addr: string): string {
  const parts = stripPlusCode(addr)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return addr;
  // Take the last 2 parts (city + country) when possible
  return parts.slice(-2).join(", ");
}

async function nominatim(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
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

/** Geocode an account by name + delivery address. Uses cache. */
export async function geocodeCustomer(name: string, address: string): Promise<GeoResult | null> {
  // 1. Hardcoded known customer destinations.
  const known = DESTINATION_COORDS[name];
  if (known) return { ...known, source: "known" };

  if (!address) return null;

  const cache = loadCache();
  const cacheKey = address.trim().toLowerCase();
  const hit = cache[cacheKey];
  if (hit) {
    if (hit.lat != null && hit.lon != null) {
      return { lat: hit.lat, lon: hit.lon, source: hit.source ?? "nominatim" };
    }
    // Negative cache: respect TTL
    if (Date.now() - hit.ts < NEG_TTL) return null;
  }

  // 2. Try cleaned address (plus code stripped) on Nominatim.
  let result: GeoResult | null = null;
  const cleaned = stripPlusCode(address);
  let geo = await nominatim(cleaned);
  if (geo) {
    result = { ...geo, source: "nominatim" };
  } else {
    // 3. Fall back to city + country only.
    const cc = cityCountryOnly(address);
    if (cc && cc !== cleaned) {
      geo = await nominatim(cc);
      if (geo) result = { ...geo, source: "city" };
    }
  }

  cache[cacheKey] = {
    lat: result?.lat ?? null,
    lon: result?.lon ?? null,
    source: result?.source,
    ts: Date.now(),
  };
  saveCache(cache);
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
