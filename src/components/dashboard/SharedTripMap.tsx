import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type SharedMapPoint = { lat: number; lon: number; address?: string | null };
export type SharedMapDestination = { lat: number; lon: number; name: string };

interface Props {
  points?: SharedMapPoint[];
  current?: { lat: number; lon: number; label?: string | null } | null;
  destination?: SharedMapDestination | null;
  height?: number;
}

/** Lightweight static map for shared snapshots — no live data hooks. */
export function SharedTripMap({ points = [], current = null, destination = null, height = 280 }: Props) {
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

    if (destination && current) {
      L.polyline([[current.lat, current.lon], [destination.lat, destination.lon]], {
        color: DEST, weight: 2, opacity: 0.7, dashArray: "6, 8",
      }).addTo(map);
    }
    if (destination) {
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
  }, [points, current, destination]);

  return <div ref={ref} className="w-full rounded-lg overflow-hidden" style={{ height }} />;
}
