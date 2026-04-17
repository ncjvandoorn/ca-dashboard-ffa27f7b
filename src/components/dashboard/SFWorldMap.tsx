import { useEffect, useRef } from "react";
import type { SFTrip } from "@/pages/ActiveSF";
import { useSensiwatchTripPaths } from "@/hooks/useSensiwatchData";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  trips: SFTrip[];
  onSelectTrip: (trip: SFTrip) => void;
}

const COLOR_PASSED = "hsl(142, 71%, 38%)";       // green for visited stops
const COLOR_CURRENT = "hsl(207, 100%, 35%)";      // blue for current location
const COLOR_DESTINATION = "hsl(340, 75%, 45%)";   // magenta pin for destination

export function SFWorldMap({ trips, onSelectTrip }: Props) {
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

  // Render trips, paths, and destinations
  useEffect(() => {
    const group = layersRef.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();

    const pathByTripId = new Map(paths.map((p) => [p.tripId, p]));

    for (const trip of trips) {
      if (trip.latitude == null || trip.longitude == null) continue;
      const path = pathByTripId.get(trip.tripId);

      // ---- Visited points (green dots) + connecting solid line ----
      if (path && path.points.length > 1) {
        // Solid green polyline through all visited points
        const line = L.polyline(
          path.points.map((p) => [p.lat, p.lon] as [number, number]),
          { color: COLOR_PASSED, weight: 3, opacity: 0.85 }
        );
        group.addLayer(line);

        // Small green dot for each passed point (skip the latest — it's the current marker)
        for (let i = 0; i < path.points.length - 1; i++) {
          const pt = path.points[i];
          const dot = L.circleMarker([pt.lat, pt.lon], {
            radius: 4,
            color: "white",
            weight: 1.5,
            fillColor: COLOR_PASSED,
            fillOpacity: 1,
          });
          if (pt.address) {
            dot.bindTooltip(`<strong>Passed</strong><br/>${pt.address}`, {
              direction: "top", offset: [0, -4],
            });
          }
          group.addLayer(dot);
        }
      }

      // ---- Dotted line from current position to destination ----
      if (path?.destination) {
        const dotted = L.polyline(
          [
            [trip.latitude, trip.longitude],
            [path.destination.lat, path.destination.lon],
          ],
          {
            color: COLOR_DESTINATION,
            weight: 2,
            opacity: 0.7,
            dashArray: "6, 8",
          }
        );
        group.addLayer(dotted);

        // Destination pin
        const destIcon = L.divIcon({
          className: "sf-dest",
          html: `<div style="
            width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;
            border-top:14px solid ${COLOR_DESTINATION};
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 14],
        });
        const destMarker = L.marker([path.destination.lat, path.destination.lon], { icon: destIcon });
        destMarker.bindTooltip(`<strong>Destination</strong><br/>${path.destination.name}`, {
          direction: "top", offset: [0, -10],
        });
        group.addLayer(destMarker);
      }

      // ---- Current location marker (blue dot) ----
      const isTransit = trip.tripStatus === "In Transit";
      const color = isTransit ? COLOR_CURRENT : "hsl(210, 12%, 46%)";

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
  }, [trips, paths, onSelectTrip]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: 340 }}
    />
  );
}
