import { useEffect, useRef } from "react";
import type { SFTrip } from "@/pages/ActiveSF";
import { useSensiwatchTripPaths } from "@/hooks/useSensiwatchData";
import type { VFTracking } from "@/hooks/useVesselFinder";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { buildSeaRouteLatLngs } from "@/lib/seaRouting";

interface Props {
  trip: SFTrip;
  height?: number;
  vfTracking?: VFTracking | null;
}

const COLOR_PASSED = "hsl(142, 71%, 38%)";
const COLOR_CURRENT = "hsl(207, 100%, 35%)";
const COLOR_DESTINATION = "hsl(340, 75%, 45%)";
const COLOR_VESSEL = "hsl(210, 80%, 35%)";

export function TripPathMap({ trip, height = 280, vfTracking }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const { paths } = useSensiwatchTripPaths();

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 12,
      scrollWheelZoom: true,
      worldCopyJump: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(map);
    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Render path for this single trip
  useEffect(() => {
    const group = layersRef.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();

    const path = paths.find((p) => p.tripId === trip.tripId);
    const bounds: [number, number][] = [];

    // Solid green line through visited points
    if (path && path.points.length > 1) {
      const line = L.polyline(
        path.points.map((p) => [p.lat, p.lon] as [number, number]),
        { color: COLOR_PASSED, weight: 3, opacity: 0.9 }
      );
      group.addLayer(line);
    }

    // Green waypoint dots for every visited point
    if (path) {
      for (const pt of path.points) {
        const dot = L.circleMarker([pt.lat, pt.lon], {
          radius: 6,
          color: "white",
          weight: 2,
          fillColor: COLOR_PASSED,
          fillOpacity: 1,
        });
        if (pt.address) {
          dot.bindTooltip(`<strong>Waypoint</strong><br/>${pt.address}`, {
            direction: "top", offset: [0, -4],
          });
        }
        group.addLayer(dot);
        bounds.push([pt.lat, pt.lon]);
      }
    }

    // Current location marker (blue, pulsing-ish ring)
    if (trip.latitude != null && trip.longitude != null) {
      const icon = L.divIcon({
        className: "sf-current-marker",
        html: `<div style="position:relative;width:18px;height:18px;">
          <div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${COLOR_CURRENT};opacity:.5;"></div>
          <div style="position:absolute;inset:0;border-radius:50%;background:${COLOR_CURRENT};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>
        </div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const m = L.marker([trip.latitude, trip.longitude], { icon });
      m.bindTooltip(`<strong>Current location</strong><br/>${trip.lastLocation || ""}`, {
        direction: "top", offset: [0, -10],
      });
      group.addLayer(m);
      bounds.push([trip.latitude, trip.longitude]);
    }

    // Dotted line from current location to destination
    if (path?.destination && trip.latitude != null && trip.longitude != null) {
      const dotted = L.polyline(
        [
          [trip.latitude, trip.longitude],
          [path.destination.lat, path.destination.lon],
        ],
        { color: COLOR_DESTINATION, weight: 2, opacity: 0.7, dashArray: "6, 8" }
      );
      group.addLayer(dotted);

      const destIcon = L.divIcon({
        className: "sf-dest",
        html: `<div style="
          width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;
          border-top:16px solid ${COLOR_DESTINATION};
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 16],
      });
      const destMarker = L.marker([path.destination.lat, path.destination.lon], { icon: destIcon });
      destMarker.bindTooltip(`<strong>Destination</strong><br/>${path.destination.name}`, {
        direction: "top", offset: [0, -12],
      });
      group.addLayer(destMarker);
      bounds.push([path.destination.lat, path.destination.lon]);
    }

    // VesselFinder vessel route overlay (orange) — schedule + current vessel position
    const vfGen = vfTracking?.response?.general;
    const vfSchedule = vfTracking?.response?.schedule;
    if (vfTracking?.status === "success" && vfGen) {
      const routePts: [number, number][] = [];
      if (vfGen.origin) routePts.push([vfGen.origin.latitude, vfGen.origin.longitude]);
      if (Array.isArray(vfSchedule)) {
        for (const s of vfSchedule) {
          if (typeof s.latitude === "number" && typeof s.longitude === "number") {
            routePts.push([s.latitude, s.longitude]);
          }
        }
      }
      if (vfGen.destination) routePts.push([vfGen.destination.latitude, vfGen.destination.longitude]);

      if (routePts.length >= 2) {
        const seaPts = buildSeaRouteLatLngs(routePts);
        const vesselLine = L.polyline(seaPts, {
          color: COLOR_VESSEL,
          weight: 3.5,
          opacity: 0.9,
        });
        vesselLine.bindTooltip(`<strong>VesselFinder route</strong><br/>${vfGen.carrier || ""} · ${vfGen.containerNumber || ""}`, {
          sticky: true,
        });
        group.addLayer(vesselLine);
        for (const p of routePts) bounds.push(p);
      }

      // Schedule waypoint dots (orange)
      if (Array.isArray(vfSchedule)) {
        for (const s of vfSchedule) {
          if (typeof s.latitude !== "number" || typeof s.longitude !== "number") continue;
          const dot = L.circleMarker([s.latitude, s.longitude], {
            radius: 5, color: "white", weight: 1.5,
            fillColor: COLOR_VESSEL, fillOpacity: 1,
          });
          dot.bindTooltip(`<strong>${s.name || "Port"}</strong>${s.country ? `<br/>${s.country}` : ""}`, { direction: "top" });
          group.addLayer(dot);
        }
      }

      // Current vessel position marker
      const v = vfGen.currentLocation?.vessel;
      if (v && typeof v.latitude === "number" && typeof v.longitude === "number") {
        const shipIcon = L.divIcon({
          className: "vf-ship-marker",
          html: `<div style="
            width:22px;height:22px;border-radius:50%;
            background:${COLOR_VESSEL};border:2px solid white;
            box-shadow:0 1px 4px rgba(0,0,0,.4);
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:700;font-size:11px;">⚓</div>`,
          iconSize: [22, 22], iconAnchor: [11, 11],
        });
        const m = L.marker([v.latitude, v.longitude], { icon: shipIcon });
        const eta = vfGen.destination?.date
          ? new Date(vfGen.destination.date * 1000).toLocaleDateString("en-GB")
          : "—";
        m.bindTooltip(
          `<strong>${v.name || "Vessel"}</strong><br/>` +
          (v.speed != null ? `Speed: ${v.speed} kn<br/>` : "") +
          `ETA: ${eta}`,
          { direction: "top", offset: [0, -10] }
        );
        group.addLayer(m);
        bounds.push([v.latitude, v.longitude]);
      }
    }

    // Fit map to relevant bounds
    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 5);
    }
    // Ensure tiles render correctly inside the dialog
    setTimeout(() => map.invalidateSize(), 50);
  }, [trip, paths, vfTracking]);

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ height }} />;
}
