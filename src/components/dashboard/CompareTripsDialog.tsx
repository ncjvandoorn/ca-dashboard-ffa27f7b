import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { SFTrip, SFOrderInfo } from "@/pages/ActiveSF";
import { useMultiSensiwatchReadings } from "@/hooks/useSensiwatchData";
import { useShipperReports, useShipperArrivals, useServicesOrders, useAccounts } from "@/hooks/useQualityData";
import { Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { SFWorldMap } from "./SFWorldMap";
import { useMemo } from "react";

interface Props {
  open: boolean;
  trips: SFTrip[];
  lookupOrder: (internalId: string) => SFOrderInfo;
  onClose: () => void;
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Distinct HSL hues for up to ~12 trips before colors repeat.
function hueForIndex(i: number): number {
  const golden = 137.508;
  return Math.round((i * golden) % 360);
}

export function CompareTripsDialog({ open, trips, lookupOrder, onClose }: Props) {
  const serials = useMemo(
    () => trips.map((t) => t.serialNumber).filter((s): s is string => !!s),
    [trips]
  );
  const { data: combined, perSerial, isLoading } = useMultiSensiwatchReadings(serials);

  const { data: shipperReports } = useShipperReports();
  const { data: shipperArrivals } = useShipperArrivals();
  const { data: servicesOrders } = useServicesOrders();
  const { data: accounts } = useAccounts();

  const accountNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (accounts || []).forEach((a) => m.set(a.id, a.name));
    return m;
  }, [accounts]);

  // Build per-container groups from the selected trips. Each container gets
  // its own section in the dialog with its shipper reports and orders/arrivals.
  const containerGroups = useMemo(() => {
    type Group = {
      containerId: string;
      bookingCode: string;
      containerNumber: string;
      tripLabels: string[];
      reports: NonNullable<typeof shipperReports>;
      orders: NonNullable<typeof servicesOrders>;
    };
    const groups = new Map<string, Group>();
    for (const t of trips) {
      const info = lookupOrder(t.internalTripId);
      const cid = info?.containerId;
      if (!cid) continue;
      if (!groups.has(cid)) {
        groups.set(cid, {
          containerId: cid,
          bookingCode: info?.bookingCode || "",
          containerNumber: info?.containerNumber || "",
          tripLabels: [],
          reports: [],
          orders: [],
        });
      }
      groups.get(cid)!.tripLabels.push(t.tripId);
    }
    for (const r of shipperReports || []) {
      const g = groups.get(r.containerId);
      if (g) g.reports.push(r);
    }
    for (const o of servicesOrders || []) {
      const g = groups.get(o.containerId);
      if (g) g.orders.push(o);
    }
    return Array.from(groups.values());
  }, [trips, lookupOrder, shipperReports, servicesOrders]);

  const arrivalByOrderId = useMemo(() => {
    const m = new Map<string, NonNullable<typeof shipperArrivals>[number]>();
    const orderIds = new Set<string>();
    for (const g of containerGroups) for (const o of g.orders) orderIds.add(o.id);
    for (const a of shipperArrivals || []) {
      if (orderIds.has(a.servicesOrderId)) m.set(a.servicesOrderId, a);
    }
    return m;
  }, [shipperArrivals, containerGroups]);

  // Build per-trip metadata used for the legend / chart series labels
  const tripMeta = useMemo(() => {
    return trips
      .filter((t) => t.serialNumber)
      .map((t, idx) => {
        const info = lookupOrder(t.internalTripId);
        const label = info?.bookingCode || info?.containerNumber || t.tripId;
        return {
          trip: t,
          info,
          label,
          serial: t.serialNumber as string,
          hue: hueForIndex(idx),
        };
      });
  }, [trips, lookupOrder]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Comparing {trips.length} trip{trips.length !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        {/* Combined map */}
        <div className="mb-4 rounded-xl border border-border overflow-hidden">
          <SFWorldMap trips={trips} onSelectTrip={() => {}} />
        </div>

        {/* Legend chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {tripMeta.map((m) => (
            <span
              key={m.trip.tripId}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: `hsl(${m.hue}, 70%, 45%)` }}
              />
              <span className="font-medium">{m.label}</span>
              {m.info?.dippingWeek && (
                <span className="text-muted-foreground">wk {m.info.dippingWeek}</span>
              )}
            </span>
          ))}
        </div>

        {/* Combined multigraph (temperature only for clarity across many trips) */}
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-semibold text-sm">Combined Multigraph</h3>
          <span className="text-xs text-muted-foreground">
            Temperature (°C) — left axis · Humidity (%) — right axis
          </span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading sensor data…</span>
          </div>
        ) : combined.length > 0 ? (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combined} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval={Math.max(0, Math.floor(combined.length / 6))}
                  tickFormatter={(v: string) =>
                    v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""
                  }
                />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v: string) =>
                    v ? new Date(v).toLocaleString("en-GB") : ""
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {tripMeta.map((m) => (
                  <Line
                    key={`temp-${m.serial}`}
                    yAxisId="left"
                    type="monotone"
                    dataKey={`temp_${m.serial}`}
                    name={`${m.label} · Temp`}
                    stroke={`hsl(${m.hue}, 70%, 45%)`}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
                {tripMeta.map((m) => (
                  <Line
                    key={`hum-${m.serial}`}
                    yAxisId="right"
                    type="monotone"
                    dataKey={`humidity_${m.serial}`}
                    name={`${m.label} · Humidity`}
                    stroke={`hsl(${m.hue}, 70%, 45%)`}
                    strokeWidth={1.25}
                    strokeDasharray="4 3"
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No sensor readings available for the selected trips
          </p>
        )}

        {/* Per-container details */}
        {containerGroups.length > 0 && (
          <div className="mt-6 space-y-6 text-sm">
            {containerGroups.map((g) => {
              const headerLabel =
                g.containerNumber || g.bookingCode || `Container ${g.containerId.slice(0, 8)}`;
              const subLabel = [
                g.bookingCode && g.containerNumber ? g.bookingCode : null,
                g.tripLabels.length ? `Trip${g.tripLabels.length > 1 ? "s" : ""} ${g.tripLabels.join(", ")}` : null,
              ].filter(Boolean).join(" · ");
              return (
                <div key={g.containerId} className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap border-b border-border pb-2">
                    <h3 className="font-semibold text-base font-mono">{headerLabel}</h3>
                    {subLabel && <span className="text-xs text-muted-foreground">{subLabel}</span>}
                  </div>

                  <section>
                    <h4 className="font-semibold mb-2 text-sm">Shipper Reports ({g.reports.length})</h4>
                    {g.reports.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No shipper reports.</p>
                    ) : (
                      <div className="space-y-2">
                        {g.reports.map((r) => (
                          <div key={r.id} className="border border-border rounded-md p-3 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span>Week <span className="font-mono">{r.weekNr}</span></span>
                              <span className="text-muted-foreground">Stuffed: {formatDate(r.stuffingDate)}</span>
                            </div>
                            {r.loadingMin !== null && <div className="text-muted-foreground">Loading: {r.loadingMin} min</div>}
                            {r.generalComments && <p className="text-foreground/80 italic">"{r.generalComments}"</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section>
                    <h4 className="font-semibold mb-2 text-sm">Orders &amp; Arrivals ({g.orders.length})</h4>
                    {g.orders.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No linked orders.</p>
                    ) : (
                      <div className="space-y-2">
                        {g.orders.map((o) => {
                          const arrival = arrivalByOrderId.get(o.id);
                          return (
                            <div key={o.id} className="border border-border rounded-md p-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-medium">{o.orderNumber}</span>
                                {o.statusName && <Badge variant="secondary" className="text-[10px]">{o.statusName}</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Farm: <span className="text-foreground">{accountNameMap.get(o.farmAccountId) || o.farmAccountId.slice(0, 8)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Customer: <span className="text-foreground">{accountNameMap.get(o.customerAccountId) || o.customerAccountId.slice(0, 8)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground grid grid-cols-3 gap-1 pt-1">
                                <span>Pallets: <span className="text-foreground">{o.pallets ?? "—"}</span></span>
                                <span>Forecast: <span className="text-foreground">{typeof o.forecast === "number" ? o.forecast.toLocaleString("de-DE") : (o.forecast ?? "—")}</span></span>
                                <span>Wk: <span className="text-foreground">{o.dippingWeek || "—"}</span></span>
                              </div>
                              {arrival && (
                                <div className="mt-2 pt-2 border-t border-border text-xs space-y-1">
                                  <div className="flex justify-between">
                                    <span className="font-medium">Arrival</span>
                                    <span className="text-muted-foreground">{formatDate(arrival.arrivalDate)}</span>
                                  </div>
                                  {(arrival.arrivalTemp1 !== null || arrival.arrivalTemp2 !== null || arrival.arrivalTemp3 !== null) && (
                                    <div className="text-muted-foreground">
                                      Temps: {[arrival.arrivalTemp1, arrival.arrivalTemp2, arrival.arrivalTemp3].filter((v) => v !== null).join(" / ")} °C
                                    </div>
                                  )}
                                  {arrival.dischargeWaitingMin !== null && (
                                    <div className="text-muted-foreground">Discharge wait: {arrival.dischargeWaitingMin} min</div>
                                  )}
                                  {arrival.specificComments && <p className="text-foreground/80 italic">"{arrival.specificComments}"</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              );
            })}
          </div>
        )}

        {/* Silence unused-var lint for perSerial (kept for future per-trip stats) */}
        <span className="hidden">{Object.keys(perSerial).length}</span>
      </DialogContent>
    </Dialog>
  );
}
