import { useEffect, useRef } from "react";
import type { SFTrip } from "@/pages/ActiveSF";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  trips: SFTrip[];
  onSelectTrip: (trip: SFTrip) => void;
}

export function SFWorldMap({ trips, onSelectTrip }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

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
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when trips change
  useEffect(() => {
    const group = markersRef.current;
    if (!group) return;
    group.clearLayers();

    for (const trip of trips) {
      if (trip.latitude == null || trip.longitude == null) continue;

      const isTransit = trip.tripStatus === "In Transit";
      const color = isTransit ? "hsl(207, 100%, 35%)" : "hsl(210, 12%, 46%)";

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
        `<strong>${trip.originName}</strong><br/>${trip.tripStatus} · ${trip.tripId}`,
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
