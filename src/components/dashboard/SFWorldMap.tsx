import { useEffect, useRef } from "react";
import type { SFTrip } from "@/pages/ActiveSF";
import type { VFActiveInfo } from "@/hooks/useVesselFinder";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { buildSeaRouteLatLngs } from "@/lib/seaRouting";

interface Props {
  trips: SFTrip[];
  /** Map tripId -> active VesselFinder tracking (success+enabled). */
  vfByTrip?: Map<string, VFActiveInfo | undefined>;
  onSelectTrip: (trip: SFTrip) => void;
}

const COLOR_CURRENT = "hsl(207, 100%, 35%)";
const COLOR_IDLE = "hsl(210, 12%, 46%)";
const COLOR_VESSEL = "hsl(210, 80%, 35%)";
const COLOR_VF_PORT = "hsl(28, 90%, 50%)";

export function SFWorldMap({ trips, vfByTrip, onSelectTrip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 10,
      scrollWheelZoom: true,
      attributionControl: true,
      worldCopyJump: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(map);

    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render markers + routes
  useEffect(() => {
    const group = layersRef.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();

    for (const trip of trips) {
      const vf = vfByTrip?.get(trip.tripId);
      const gen = vf?.response?.general;
      const schedule = vf?.response?.schedule;

      // ---- 1) Prefer VesselFinder data when active ----
      if (vf && gen) {
        // Route polyline: origin -> schedule stops -> destination
        const routePts: [number, number][] = [];
        if (gen.origin) routePts.push([gen.origin.latitude, gen.origin.longitude]);
        if (Array.isArray(schedule)) {
          for (const s of schedule) {
            if (typeof s.latitude === "number" && typeof s.longitude === "number") {
              routePts.push([s.latitude, s.longitude]);
            }
          }
        }
        if (gen.destination) routePts.push([gen.destination.latitude, gen.destination.longitude]);

        if (routePts.length >= 2) {
          const seaPts = buildSeaRouteLatLngs(routePts);
          const line = L.polyline(seaPts, { color: COLOR_VESSEL, weight: 2.5, opacity: 0.8 });
          line.on("click", () => onSelectTrip(trip));
          line.bindTooltip(
            `<strong>${gen.carrier || "Vessel"}</strong><br/>${gen.containerNumber || trip.tripId}`,
            { sticky: true }
          );
          group.addLayer(line);
        }

        // Schedule port dots
        if (Array.isArray(schedule)) {
          for (const s of schedule) {
            if (typeof s.latitude !== "number" || typeof s.longitude !== "number") continue;
            const dot = L.circleMarker([s.latitude, s.longitude], {
              radius: 3.5, color: "white", weight: 1,
              fillColor: COLOR_VF_PORT, fillOpacity: 1,
            });
            dot.bindTooltip(`<strong>${s.name || "Port"}</strong>${s.country ? `<br/>${s.country}` : ""}`, { direction: "top" });
            dot.on("click", () => onSelectTrip(trip));
            group.addLayer(dot);
          }
        }

        // Current vessel position (preferred) or fall back to sensiwatch coords
        const v = gen.currentLocation?.vessel;
        if (v && typeof v.latitude === "number" && typeof v.longitude === "number") {
          const shipIcon = L.divIcon({
            className: "vf-ship-marker",
            html: `<div style="
              width:18px;height:18px;border-radius:50%;
              background:${COLOR_VESSEL};border:2px solid white;
              box-shadow:0 1px 4px rgba(0,0,0,.4);
              display:flex;align-items:center;justify-content:center;
              color:white;font-weight:700;font-size:10px;cursor:pointer;">⚓</div>`,
            iconSize: [18, 18], iconAnchor: [9, 9],
          });
          const marker = L.marker([v.latitude, v.longitude], { icon: shipIcon });
          marker.bindTooltip(
            `<strong>${v.name || gen.carrier || "Vessel"}</strong><br/>${trip.originName || "Trip " + trip.tripId}`,
            { direction: "top", offset: [0, -10] }
          );
          marker.on("click", () => onSelectTrip(trip));
          group.addLayer(marker);
          continue; // VF path drawn — skip sensiwatch fallback for this trip
        }
        // No vessel position from VF — fall through to sensiwatch dot if available
      }

      // ---- 2) Fallback: SensiWatch last known location ----
      if (trip.latitude == null || trip.longitude == null) continue;
      const isTransit = trip.tripStatus === "In Transit";
      const color = isTransit ? COLOR_CURRENT : COLOR_IDLE;

      const icon = L.divIcon({
        className: "sf-marker",
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:${color};border:2px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.3);
          cursor:pointer;
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([trip.latitude, trip.longitude], { icon });
      marker.bindTooltip(
        `<strong>${trip.originName || "Trip " + trip.tripId}</strong><br/>${trip.tripStatus} · ${trip.tripId}`,
        { direction: "top", offset: [0, -8] }
      );
      marker.on("click", () => onSelectTrip(trip));
      group.addLayer(marker);
    }
  }, [trips, vfByTrip, onSelectTrip]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: 340 }}
    />
  );
}
