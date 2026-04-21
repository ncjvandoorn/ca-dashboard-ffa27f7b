import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { seaRoute } from "searoute-ts";

export type SharedMapPoint = { lat: number; lon: number; address?: string | null };
export type SharedMapDestination = { lat: number; lon: number; name: string };

export type SharedVFRoute = {
  carrier?: string | null;
  origin?: { lat: number; lon: number; name?: string | null } | null;
  destination?: { lat: number; lon: number; name?: string | null } | null;
  schedule?: { lat: number; lon: number; name?: string | null; country?: string | null }[];
  vessel?: { lat: number; lon: number; name?: string | null; speed?: number | null } | null;
};

interface Props {
  points?: SharedMapPoint[];
  current?: { lat: number; lon: number; label?: string | null } | null;
  destination?: SharedMapDestination | null;
  /** When provided, draws the VesselFinder route on top of (or instead of) the sensor track. */
  vfRoute?: SharedVFRoute | null;
  height?: number;
}

const COLOR_VESSEL = "hsl(210, 80%, 35%)";
const COLOR_VF_PORT = "hsl(28, 90%, 50%)";

function buildSeaRouteLatLngs(points: [number, number][]): [number, number][] {
  if (points.length < 2) return points;
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [aLat, aLon] = points[i];
    const [bLat, bLon] = points[i + 1];
    try {
      const origin = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [aLon, aLat] } };
      const dest = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [bLon, bLat] } };
      const route = seaRoute(origin as any, dest as any);
      const coords = (route?.geometry?.coordinates || []) as [number, number][];
      if (coords.length >= 2) {
        const seg = coords.map(([lon, lat]) => [lat, lon] as [number, number]);
        if (out.length && seg.length) seg.shift();
        out.push(...seg);
        continue;
      }
    } catch { /* fall back */ }
    if (!out.length) out.push([aLat, aLon]);
    out.push([bLat, bLon]);
  }
  return out;
}

/** Lightweight static map for shared snapshots — no live data hooks. */
export function SharedTripMap({ points = [], current = null, destination = null, vfRoute = null, height = 340 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      center: [20, 10], zoom: 2, minZoom: 2, maxZoom: 12,
      scrollWheelZoom: true, worldCopyJump: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.eachLayer((l) => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });

    const PASSED = "hsl(142, 71%, 38%)";
    const CURRENT = "hsl(207, 100%, 35%)";
    const DEST = "hsl(340, 75%, 45%)";
    const bounds: [number, number][] = [];

    // ---- VesselFinder route (preferred when present) ----
    if (vfRoute) {
      const routePts: [number, number][] = [];
      if (vfRoute.origin) routePts.push([vfRoute.origin.lat, vfRoute.origin.lon]);
      for (const s of vfRoute.schedule || []) routePts.push([s.lat, s.lon]);
      if (vfRoute.destination) routePts.push([vfRoute.destination.lat, vfRoute.destination.lon]);

      if (routePts.length >= 2) {
        const seaPts = buildSeaRouteLatLngs(routePts);
        L.polyline(seaPts, { color: COLOR_VESSEL, weight: 2.5, opacity: 0.85 }).addTo(map);
        for (const p of seaPts) bounds.push(p);
      }
      for (const s of vfRoute.schedule || []) {
        const dot = L.circleMarker([s.lat, s.lon], {
          radius: 4, color: "white", weight: 1, fillColor: COLOR_VF_PORT, fillOpacity: 1,
        });
        if (s.name) dot.bindTooltip(`<strong>${s.name}</strong>${s.country ? `<br/>${s.country}` : ""}`, { direction: "top" });
        dot.addTo(map);
        bounds.push([s.lat, s.lon]);
      }
      if (vfRoute.vessel) {
        const shipIcon = L.divIcon({
          className: "vf-ship",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:${COLOR_VESSEL};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:10px;">⚓</div>`,
          iconSize: [18, 18], iconAnchor: [9, 9],
        });
        const m = L.marker([vfRoute.vessel.lat, vfRoute.vessel.lon], { icon: shipIcon });
        m.bindTooltip(`<strong>${vfRoute.vessel.name || vfRoute.carrier || "Vessel"}</strong>${vfRoute.vessel.speed != null ? `<br/>${vfRoute.vessel.speed} kn` : ""}`, { direction: "top", offset: [0, -10] });
        m.addTo(map);
        bounds.push([vfRoute.vessel.lat, vfRoute.vessel.lon]);
      }
    }

    // ---- Sensor track (only when no VF route, to avoid a noisy map) ----
    if (!vfRoute) {
      if (points.length > 1) {
        L.polyline(points.map((p) => [p.lat, p.lon] as [number, number]), {
          color: PASSED, weight: 3, opacity: 0.9,
        }).addTo(map);
      }
      for (const p of points) {
        L.circleMarker([p.lat, p.lon], {
          radius: 6, color: "white", weight: 2, fillColor: PASSED, fillOpacity: 1,
        }).addTo(map);
        bounds.push([p.lat, p.lon]);
      }
    }

    if (current) {
      const icon = L.divIcon({
        className: "shared-current-marker",
        html: `<div style="position:relative;width:18px;height:18px;">
          <div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${CURRENT};opacity:.5;"></div>
          <div style="position:absolute;inset:0;border-radius:50%;background:${CURRENT};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>
        </div>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      });
      const m = L.marker([current.lat, current.lon], { icon });
      if (current.label) m.bindTooltip(current.label, { direction: "top", offset: [0, -10] });
      m.addTo(map);
      bounds.push([current.lat, current.lon]);
    }

    if (!vfRoute && destination && current) {
      L.polyline([[current.lat, current.lon], [destination.lat, destination.lon]], {
        color: DEST, weight: 2, opacity: 0.7, dashArray: "6, 8",
      }).addTo(map);
    }
    if (!vfRoute && destination) {
      const destIcon = L.divIcon({
        className: "shared-dest",
        html: `<div style="
          width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;
          border-top:16px solid ${DEST};
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
        "></div>`,
        iconSize: [16, 16], iconAnchor: [8, 16],
      });
      const m = L.marker([destination.lat, destination.lon], { icon: destIcon });
      m.bindTooltip(`<strong>Destination</strong><br/>${destination.name}`, { direction: "top", offset: [0, -12] });
      m.addTo(map);
      bounds.push([destination.lat, destination.lon]);
    }

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 5);
    }
    setTimeout(() => map.invalidateSize(), 50);
  }, [points, current, destination, vfRoute]);

  return <div ref={ref} className="w-full rounded-lg overflow-hidden" style={{ height }} />;
}
