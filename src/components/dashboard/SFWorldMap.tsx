import { useEffect, useRef } from "react";
import type { SFTrip } from "@/pages/ActiveSF";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  trips: SFTrip[];
  onSelectTrip: (trip: SFTrip) => void;
}

const COLOR_CURRENT = "hsl(207, 100%, 35%)";
const COLOR_IDLE = "hsl(210, 12%, 46%)";

export function SFWorldMap({ trips, onSelectTrip }: Props) {
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

  // Render only current-location blue dots, clickable to open the trip popup
  useEffect(() => {
    const group = layersRef.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();

    for (const trip of trips) {
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
  }, [trips, onSelectTrip]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: 340 }}
    />
  );
}
