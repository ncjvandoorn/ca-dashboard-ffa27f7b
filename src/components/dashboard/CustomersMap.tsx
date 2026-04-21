import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface CustomerMarker {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  source?: "known" | "nominatim" | "city";
}

interface Props {
  markers: CustomerMarker[];
  height?: number;
  onSelect?: (m: CustomerMarker) => void;
}

export function CustomersMap({ markers, height = 560, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-0.5, 36.8], // central Kenya
      zoom: 7,
      minZoom: 3,
      maxZoom: 16,
      scrollWheelZoom: true,
      worldCopyJump: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap, © CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    const layer = layerRef.current;
    layer.clearLayers();

    if (markers.length === 0) return;

    const colorBySource: Record<string, string> = {
      known: "hsl(160, 60%, 40%)",
      nominatim: "hsl(210, 70%, 50%)",
      city: "hsl(35, 85%, 55%)",
    };

    const bounds: [number, number][] = [];
    for (const m of markers) {
      const color = colorBySource[m.source ?? "nominatim"] ?? "hsl(210, 70%, 50%)";
      const marker = L.circleMarker([m.lat, m.lon], {
        radius: 6,
        color: "#fff",
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.9,
      }).addTo(layer);
      marker.bindTooltip(
        `<div style="font-family:'IBM Plex Sans',sans-serif"><strong>${escapeHtml(m.name)}</strong><br/><span style="color:#666;font-size:11px">${escapeHtml(m.address)}</span></div>`,
        { direction: "top", offset: [0, -4] },
      );
      if (onSelect) marker.on("click", () => onSelect(m));
      bounds.push([m.lat, m.lon]);
    }

    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
    }
  }, [markers, onSelect]);

  return <div ref={containerRef} style={{ height: `${height}px`, width: "100%" }} className="rounded-xl overflow-hidden" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
