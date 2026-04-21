import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SFTrip, SFOrderInfo } from "@/pages/ActiveSF";
import { useSensiwatchReadings } from "@/hooks/useSensiwatchData";
import { useShipperReports, useShipperArrivals, useServicesOrders, useAccounts, useQualityReports, useUsers } from "@/hooks/useQualityData";
import { Thermometer, Droplets, Sun, MapPin, Clock, Loader2, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TripPathMap } from "./TripPathMap";
import { useMemo, useRef, useState } from "react";
import { VesselTrackingCard } from "./VesselTrackingCard";
import { SharePageButton } from "@/components/SharePageButton";
import { useAuth } from "@/hooks/useAuth";
import type { VFTracking } from "@/hooks/useVesselFinder";
import { QualityReportBody } from "./QualityReportBody";

interface Props {
  trip: SFTrip | null;
  orderInfo?: SFOrderInfo;
  onClose: () => void;
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function TripDetailDialog({ trip, orderInfo, onClose }: Props) {
  const { isAdmin, isCustomer } = useAuth();
  const [vfTracking, setVfTracking] = useState<VFTracking | null>(null);
  const { readings, isLoading: readingsLoading } = useSensiwatchReadings(
    trip?.serialNumber ?? null,
    trip?.actualDepartureTime ?? null
  );

  const { data: shipperReports } = useShipperReports();
  const { data: shipperArrivals } = useShipperArrivals();
  const { data: servicesOrders } = useServicesOrders();
  const { data: accounts } = useAccounts();
  const { data: qualityReports } = useQualityReports();
  const { data: users } = useUsers();
  const [expandedReportFor, setExpandedReportFor] = useState<string | null>(null);

  const qualityReportMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof qualityReports>[number]>();
    (qualityReports || []).forEach((r) => m.set(r.id, r));
    return m;
  }, [qualityReports]);

  const userNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (users || []).forEach((u) => m.set(u.id, u.name));
    return m;
  }, [users]);

  const containerId = orderInfo?.containerId || "";

  const detailReports = useMemo(
    () => (shipperReports || []).filter((r) => r.containerId === containerId),
    [shipperReports, containerId]
  );

  const detailOrders = useMemo(
    () => (servicesOrders || []).filter((o) => o.containerId === containerId),
    [servicesOrders, containerId]
  );

  const accountNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (accounts || []).forEach((a) => m.set(a.id, a.name));
    return m;
  }, [accounts]);

  const detailArrivals = useMemo(() => {
    const orderIds = new Set(detailOrders.map((o) => o.id));
    const out: { order: typeof detailOrders[number]; arrival: NonNullable<typeof shipperArrivals>[number] }[] = [];
    for (const a of shipperArrivals || []) {
      if (!orderIds.has(a.servicesOrderId)) continue;
      const order = detailOrders.find((o) => o.id === a.servicesOrderId);
      if (order) out.push({ order, arrival: a });
    }
    return out;
  }, [shipperArrivals, detailOrders]);

  const exportRef = useRef<HTMLDivElement>(null);

  if (!trip) return null;

  const chrysalBlue = "hsl(207, 100%, 35%)";
  const chrysalGreen = "hsl(90, 67%, 41%)";
  const chrysalWarm = "hsl(38, 92%, 50%)";

  return (
    <Dialog open={!!trip} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg pr-8">
            Trip {trip.tripId}
            <SharePageButton
              pageType="trip_detail"
              getPayload={() => ({
                trip: {
                  tripId: trip.tripId,
                  serialNumber: trip.serialNumber,
                  originName: trip.originName,
                  originAddress: trip.originAddress,
                  actualDepartureTime: trip.actualDepartureTime,
                  carrier: trip.carrier,
                  internalTripId: trip.internalTripId,
                  lastTemp: trip.lastTemp,
                  lastHumidity: trip.lastHumidity,
                  lastLight: trip.lastLight,
                  lastLocation: trip.lastLocation,
                  lastReadingTime: trip.lastReadingTime,
                },
                stats: readings.length > 0 ? {
                  avgTemp: (readings.reduce((s, r) => s + r.temp, 0) / readings.length).toFixed(1) + " °C",
                  avgHumidity: (readings.reduce((s, r) => s + r.humidity, 0) / readings.length).toFixed(1) + " %",
                  maxLight: Math.max(...readings.map((r) => r.light)).toFixed(1) + " %",
                } : {},
                shipperReports: detailReports.map((r) => ({
                  weekNr: r.weekNr,
                  stuffingDate: formatDate(r.stuffingDate),
                  loadingMin: r.loadingMin,
                  generalComments: r.generalComments,
                })),
                orders: detailOrders.map((o) => {
                  const arr = detailArrivals.find((x) => x.order.id === o.id)?.arrival;
                  return {
                    orderNumber: o.orderNumber,
                    statusName: o.statusName,
                    farmName: accountNameMap.get(o.farmAccountId) || null,
                    customerName: accountNameMap.get(o.customerAccountId) || null,
                    pallets: o.pallets,
                    forecast: typeof o.forecast === "number" ? o.forecast.toLocaleString("de-DE") : o.forecast,
                    dippingWeek: o.dippingWeek,
                    arrival: arr ? {
                      arrivalDate: formatDate(arr.arrivalDate),
                      temps: [arr.arrivalTemp1, arr.arrivalTemp2, arr.arrivalTemp3].filter((v) => v !== null),
                      dischargeWaitingMin: arr.dischargeWaitingMin,
                      specificComments: arr.specificComments,
                    } : null,
                  };
                }),
              })}
            />
          </DialogTitle>
        </DialogHeader>

        <div ref={exportRef} className="space-y-4">
        {/* Trip route map */}
        <div className="rounded-xl border border-border overflow-hidden" data-pdf-section>
          <TripPathMap trip={trip} height={280} vfTracking={vfTracking} />
        </div>

        {/* Summary cards: Most Recent | Origin | Active Tracking (admin) */}
        <div
          data-pdf-section
          className={`grid grid-cols-1 gap-4 ${
            (isAdmin || isCustomer) ? "md:grid-cols-[1fr_1fr_0.85fr]" : "md:grid-cols-2"
          }`}
        >
          <MostRecentCard trip={trip} />
          <OriginCard trip={trip} />
          {(isAdmin || isCustomer) && (
            <VesselTrackingCard
              containerId={containerId || null}
              defaultContainerNumber={orderInfo?.containerNumber || null}
              isAdmin={isAdmin}
              isCustomer={isCustomer}
              onTrackingChange={setVfTracking}
            />
          )}
        </div>

        {/* Multigraph tabs */}
        <Tabs defaultValue="multigraph" className="w-full" data-pdf-section>
          <TabsList>
            <TabsTrigger value="multigraph">Multigraph</TabsTrigger>
            <TabsTrigger value="statistics">Trip Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="multigraph">
            {readingsLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading sensor data…</span>
              </div>
            ) : readings.length > 0 ? (
              <div className="h-[300px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={readings} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(0, Math.floor(readings.length / 6))}
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
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="temp" name="Temperature (°C)" stroke={chrysalBlue} strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke={chrysalGreen} strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="light" name="Light (%)" stroke={chrysalWarm} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No sensor readings available for this trip
              </p>
            )}
          </TabsContent>

          <TabsContent value="statistics">
            <div className="grid grid-cols-3 gap-4 py-4">
              <StatBox label="Avg Temperature" value={readings.length > 0 ? (readings.reduce((s, r) => s + r.temp, 0) / readings.length).toFixed(1) + " °C" : "—"} color="text-primary" />
              <StatBox label="Avg Humidity" value={readings.length > 0 ? (readings.reduce((s, r) => s + r.humidity, 0) / readings.length).toFixed(1) + " %" : "—"} color="text-accent" />
              <StatBox label="Max Light" value={readings.length > 0 ? Math.max(...readings.map((r) => r.light)).toFixed(1) + " %" : "—"} color="text-warning" />
            </div>
          </TabsContent>
        </Tabs>

        {containerId && (
          <div className="mt-2 space-y-6 text-sm">
            <section data-pdf-section>
              <h3 className="font-semibold mb-2">Shipper Reports ({detailReports.length})</h3>
              {detailReports.length === 0 ? (
                <p className="text-xs text-muted-foreground">No shipper reports.</p>
              ) : (
                <div className="space-y-2">
                  {detailReports.map((r) => (
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

            <section data-pdf-section>
              <h3 className="font-semibold mb-2">Orders &amp; Arrivals ({detailOrders.length})</h3>
              {detailOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No linked orders.</p>
              ) : (
                <div className="space-y-2">
                  {detailOrders.map((o) => {
                    const arrival = detailArrivals.find((x) => x.order.id === o.id)?.arrival;
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
                        {(() => {
                          const qrId = o.qualityReportId;
                          const qr = qrId ? qualityReportMap.get(qrId) : null;
                          if (!qr) return null;
                          const isOpen = expandedReportFor === o.id;
                          const farmName = accountNameMap.get(qr.farmAccountId) || accountNameMap.get(o.farmAccountId) || "—";
                          const createdByName =
                            (qr.submittedByUserId && userNameMap.get(qr.submittedByUserId)) ||
                            (qr.createdByUserId && userNameMap.get(qr.createdByUserId)) ||
                            (qr.updatedByUserId && userNameMap.get(qr.updatedByUserId)) ||
                            qr.signoffName ||
                            "—";
                          return (
                            <div className="mt-2 pt-2 border-t border-border">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                                onClick={() => setExpandedReportFor(isOpen ? null : o.id)}
                              >
                                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                <FileText className="h-3.5 w-3.5" />
                                {isOpen ? "Hide Quality Report" : "Quality Report"}
                                <span className="text-muted-foreground ml-1">· wk {qr.weekNr}</span>
                              </Button>
                              {isOpen && (
                                <div className="mt-3 rounded-lg bg-muted/20 border border-border p-2" data-pdf-section>
                                  <QualityReportBody report={qr} farmName={farmName} createdByName={createdByName} />
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
        </div>{/* /exportRef wrapper */}
      </DialogContent>
    </Dialog>
  );
}

function MostRecentCard({ trip }: { trip: SFTrip }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
        <span className="font-semibold text-sm">Most Recent</span>
        {trip.lastReadingTime && (
          <span className="text-xs text-muted-foreground ml-auto">{trip.lastReadingTime}</span>
        )}
      </div>
      {trip.lastLocation && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {trip.lastLocation}
        </p>
      )}
      {trip.serialNumber && (
        <p className="text-xs font-mono text-muted-foreground mb-3">({trip.serialNumber})</p>
      )}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <Thermometer className="h-4 w-4 text-destructive" />
          <span className="text-lg font-bold text-destructive">
            {trip.lastTemp !== null ? `${trip.lastTemp} °C` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sun className="h-4 w-4 text-warning" />
          <span className="text-lg font-bold text-warning">
            {trip.lastLight !== null ? `${trip.lastLight} %` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Droplets className="h-4 w-4 text-accent" />
          <span className="text-lg font-bold text-accent">
            {trip.lastHumidity !== null ? `${trip.lastHumidity} %` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function OriginCard({ trip }: { trip: SFTrip }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
        <span className="font-semibold text-sm">Departed from Origin</span>
      </div>
      <p className="font-medium text-sm">{trip.originName}</p>
      <p className="text-xs text-muted-foreground mb-3">{trip.originAddress}</p>
      {trip.actualDepartureTime && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Actual Departure: {trip.actualDepartureTime}
        </div>
      )}
      {trip.carrier && (
        <p className="text-xs text-muted-foreground mt-1">Carrier: {trip.carrier}</p>
      )}
      <p className="text-xs font-mono text-muted-foreground mt-1">
        Internal: {trip.internalTripId}
      </p>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
