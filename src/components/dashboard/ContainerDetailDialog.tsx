import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SFTrip, SFOrderInfo } from "@/pages/ActiveSF";
import { useSensiwatchReadings, useMultiSensiwatchReadings, useSensiwatchTripPaths } from "@/hooks/useSensiwatchData";
import {
  useShipperReports,
  useShipperArrivals,
  useServicesOrders,
  useAccounts,
  useQualityReports,
  useUsers,
} from "@/hooks/useQualityData";
import {
  Thermometer,
  Droplets,
  Sun,
  MapPin,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Container as ContainerIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TripPathMap } from "./TripPathMap";
import { useMemo, useRef, useState } from "react";
import { VesselTrackingCard } from "./VesselTrackingCard";
import { SharePageButton } from "@/components/SharePageButton";
import { useAuth } from "@/hooks/useAuth";
import type { VFTracking } from "@/hooks/useVesselFinder";
import { QualityReportBody } from "./QualityReportBody";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 as Loader2Icon } from "lucide-react";

/**
 * Detail dialog for a *container* — handles the case where a single physical
 * container has multiple services orders and multiple datalogger trips.
 *
 * - If `trips.length === 1` it behaves identically to `TripDetailDialog`.
 * - Otherwise the per-trip cards (Most Recent, Origin, Multigraph, route map)
 *   are shown inside tabs (one tab per logger), while shared sections
 *   (Orders, Shipper Reports) remain at container scope.
 */
interface Props {
  /** All datalogger trips that belong to this container. May be empty for
   *  orders without any sensor data. */
  trips: SFTrip[];
  /** All services orders that belong to this container. Used for the orders
   *  & arrivals listing. */
  orders: SFOrderInfo[];
  /** Container metadata. `containerId` is required to load shipper/order
   *  info; the rest is informational. */
  container: {
    containerId: string;
    containerNumber: string;
    bookingCode: string;
    dropoffDate: number | null;
    shippingDate: number | null;
  } | null;
  onClose: () => void;
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ContainerDetailDialog({ trips, orders, container, onClose }: Props) {
  const open = !!container;
  const { isAdmin, isCustomer } = useAuth();
  const [vfTracking, setVfTracking] = useState<VFTracking | null>(null);

  const { data: shipperReports } = useShipperReports();
  const { data: shipperArrivals } = useShipperArrivals();
  const { data: servicesOrders } = useServicesOrders();
  const { data: accounts } = useAccounts();
  const { data: qualityReports } = useQualityReports();
  const { data: users } = useUsers();
  const [expandedReportFor, setExpandedReportFor] = useState<string | null>(null);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const { paths } = useSensiwatchTripPaths();
  const { data: combinedReadings } = useMultiSensiwatchReadings(
    trips.map((t) => t.serialNumber).filter((s): s is string => !!s)
  );

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

  const containerId = container?.containerId || "";

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

  // Pick a trip to use for the route map / VF tracking — the most recently
  // updated one is the most useful representative.
  const representativeTrip = useMemo(() => {
    if (!trips.length) return null;
    return [...trips].sort((a, b) => {
      const ta = a.lastReadingTime ? new Date(a.lastReadingTime).getTime() : 0;
      const tb = b.lastReadingTime ? new Date(b.lastReadingTime).getTime() : 0;
      return tb - ta;
    })[0];
  }, [trips]);

  // Default the active tab to the freshest trip whenever the dialog opens.
  const currentActiveTripId =
    activeTripId && trips.some((t) => t.tripId === activeTripId)
      ? activeTripId
      : representativeTrip?.tripId ?? null;

  if (!container) return null;

  const hasMultipleTrips = trips.length > 1;
  const title = container.containerNumber || container.bookingCode || "Container";

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg pr-8">
            <ContainerIcon className="h-5 w-5 text-primary" />
            {title}
            {hasMultipleTrips && (
              <Badge variant="secondary" className="text-[10px]">
                {trips.length} loggers
              </Badge>
            )}
            {orders.length > 1 && (
              <Badge variant="secondary" className="text-[10px]">
                {orders.length} orders
              </Badge>
            )}
            <SharePageButton
              pageType="container_detail"
              getPayload={() => {
                const repTripPath = representativeTrip
                  ? paths.find((p) => p.tripId === representativeTrip.tripId)
                  : null;
                const vfGen = vfTracking?.response?.general;
                const vfSchedule = vfTracking?.response?.schedule;
                const vfRoute = (vfTracking?.status === "success" && vfGen) ? {
                  carrier: vfGen.carrier ?? null,
                  origin: vfGen.origin ? { lat: vfGen.origin.latitude, lon: vfGen.origin.longitude, name: vfGen.origin.name ?? null } : null,
                  destination: vfGen.destination ? { lat: vfGen.destination.latitude, lon: vfGen.destination.longitude, name: vfGen.destination.name ?? null } : null,
                  schedule: (vfSchedule || [])
                    .filter((s) => typeof s.latitude === "number" && typeof s.longitude === "number")
                    .map((s) => ({ lat: s.latitude, lon: s.longitude, name: s.name ?? null, country: s.country ?? null })),
                  vessel: vfGen.currentLocation?.vessel && typeof vfGen.currentLocation.vessel.latitude === "number"
                    ? { lat: vfGen.currentLocation.vessel.latitude, lon: vfGen.currentLocation.vessel.longitude, name: vfGen.currentLocation.vessel.name ?? null, speed: vfGen.currentLocation.vessel.speed ?? null }
                    : null,
                } : null;
                const vfSummary = (vfTracking?.status === "success" && vfGen) ? {
                  status: vfTracking.status,
                  carrier: vfGen.carrier ?? null,
                  vesselName: vfGen.currentLocation?.vessel?.name ?? null,
                  vesselSpeed: vfGen.currentLocation?.vessel?.speed ?? null,
                  progress: typeof vfGen.progress === "number" ? vfGen.progress : null,
                  destinationName: vfGen.destination?.name ?? null,
                  destinationDate: vfGen.destination?.date ?? null,
                  updatedAt: vfGen.updatedAt ?? null,
                  containerNumber: vfGen.containerNumber ?? null,
                  portName: vfGen.currentLocation?.port?.name ?? null,
                } : null;
                return {
                  container: {
                    containerNumber: container.containerNumber,
                    bookingCode: container.bookingCode,
                    dropoffDate: formatDate(container.dropoffDate),
                    shippingDate: formatDate(container.shippingDate),
                  },
                  vfRoute,
                  vfSummary,
                  trips: trips.map((t) => ({
                    tripId: t.tripId,
                    serialNumber: t.serialNumber,
                    originName: t.originName,
                    originAddress: t.originAddress,
                    destinationName: t.destinationName,
                    actualDepartureTime: t.actualDepartureTime,
                    carrier: t.carrier,
                    internalTripId: t.internalTripId,
                    lastTemp: t.lastTemp,
                    lastHumidity: t.lastHumidity,
                    lastLight: t.lastLight,
                    lastReadingTime: t.lastReadingTime,
                    lastLocation: t.lastLocation,
                    latitude: t.latitude,
                    longitude: t.longitude,
                  })),
                  map: {
                    points: repTripPath?.points.map((p) => ({ lat: p.lat, lon: p.lon, address: p.address })) || [],
                    destination: repTripPath?.destination || null,
                    current: representativeTrip && representativeTrip.latitude != null && representativeTrip.longitude != null
                      ? { lat: representativeTrip.latitude, lon: representativeTrip.longitude, label: representativeTrip.lastLocation }
                      : null,
                  },
                  combinedReadings: combinedReadings.map((r) => ({ ...r })),
                  serials: trips.map((t) => t.serialNumber).filter((s): s is string => !!s),
                  shipperReports: detailReports.map((r) => ({
                    weekNr: r.weekNr,
                    stuffingDate: formatDate(r.stuffingDate),
                    loadingMin: r.loadingMin,
                    generalComments: r.generalComments,
                  })),
                  orders: detailOrders.map((o) => {
                    const arr = detailArrivals.find((x) => x.order.id === o.id)?.arrival;
                    const qr = o.qualityReportId ? qualityReportMap.get(o.qualityReportId) : null;
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
                      qualityReport: qr ? {
                        report: qr,
                        farmName: accountNameMap.get(qr.farmAccountId) || accountNameMap.get(o.farmAccountId) || "—",
                        createdByName:
                          (qr.submittedByUserId && userNameMap.get(qr.submittedByUserId)) ||
                          (qr.createdByUserId && userNameMap.get(qr.createdByUserId)) ||
                          (qr.updatedByUserId && userNameMap.get(qr.updatedByUserId)) ||
                          qr.signoffName || "—",
                      } : null,
                    };
                  }),
                };
              }}
            />
          </DialogTitle>
        </DialogHeader>

        <div ref={exportRef} className="space-y-4">
          {/* Container summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs" data-pdf-section>
            <SummaryStat label="Booking" value={container.bookingCode || "—"} mono />
            <SummaryStat label="Drop-off" value={formatDate(container.dropoffDate)} />
            <SummaryStat label="Shipping" value={formatDate(container.shippingDate)} />
            <SummaryStat label="Loggers" value={String(trips.length)} />
          </div>

          {/* Vessel tracking — visible to everyone signed in. Edit rights:
              admin + Chrysal/TA staff (full); customers locked to defaults. */}
          <div data-pdf-section>
            <VesselTrackingCard
              containerId={containerId || null}
              defaultContainerNumber={container.containerNumber || null}
              isAdmin={isAdmin}
              isCustomer={isCustomer}
              isInternalStaff={!isAdmin && !isCustomer}
              onTrackingChange={setVfTracking}
            />
          </div>

          {/* Per-trip section — tabs when there's more than one logger.
              The multigraph is rendered ONCE below at container scope so all
              loggers can be compared on a single chart. */}
          {trips.length === 0 ? (
            <NoLoggerSection
              vfTracking={vfTracking}
              orderNumbers={detailOrders.map((o) => o.orderNumber).filter(Boolean) as string[]}
              canManage={isAdmin || (!isAdmin && !isCustomer)}
            />
          ) : hasMultipleTrips ? (
            <Tabs
              value={currentActiveTripId ?? undefined}
              onValueChange={setActiveTripId}
              className="w-full"
            >
              <TabsList className="flex-wrap h-auto">
                {trips.map((t) => (
                  <TabsTrigger key={t.tripId} value={t.tripId} className="text-xs">
                    Trip {t.tripId}
                    {t.serialNumber && (
                      <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                        ({t.serialNumber})
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {trips.map((t) => (
                <TabsContent key={t.tripId} value={t.tripId} className="space-y-4 mt-4">
                  <TripSection trip={t} vfTracking={vfTracking} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <TripSection trip={trips[0]} vfTracking={vfTracking} />
          )}

          {/* Combined multigraph — when multiple loggers, overlays all of them
              on one chart so transit conditions can be compared at a glance. */}
          {trips.length > 0 && (
            <div data-pdf-section>
              <CombinedMultigraph trips={trips} />
            </div>
          )}

          {/* Shipper Reports — container-level */}
          {containerId && (
            <div className="mt-2 space-y-6 text-sm">
              <section data-pdf-section>
                <h3 className="font-semibold mb-2">
                  Shipper Reports ({detailReports.length})
                </h3>
                {detailReports.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No shipper reports.</p>
                ) : (
                  <div className="space-y-2">
                    {detailReports.map((r) => (
                      <div
                        key={r.id}
                        className="border border-border rounded-md p-3 text-xs space-y-1"
                      >
                        <div className="flex justify-between">
                          <span>
                            Week <span className="font-mono">{r.weekNr}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Stuffed: {formatDate(r.stuffingDate)}
                          </span>
                        </div>
                        {r.loadingMin !== null && (
                          <div className="text-muted-foreground">Loading: {r.loadingMin} min</div>
                        )}
                        {r.generalComments && (
                          <p className="text-foreground/80 italic">"{r.generalComments}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section data-pdf-section>
                <h3 className="font-semibold mb-2">
                  Orders &amp; Arrivals ({detailOrders.length})
                </h3>
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
                            {o.statusName && (
                              <Badge variant="secondary" className="text-[10px]">
                                {o.statusName}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Farm:{" "}
                            <span className="text-foreground">
                              {accountNameMap.get(o.farmAccountId) || o.farmAccountId.slice(0, 8)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Customer:{" "}
                            <span className="text-foreground">
                              {accountNameMap.get(o.customerAccountId) ||
                                o.customerAccountId.slice(0, 8)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground grid grid-cols-3 gap-1 pt-1">
                            <span>
                              Pallets: <span className="text-foreground">{o.pallets ?? "—"}</span>
                            </span>
                            <span>
                              Forecast:{" "}
                              <span className="text-foreground">
                                {typeof o.forecast === "number"
                                  ? o.forecast.toLocaleString("de-DE")
                                  : o.forecast ?? "—"}
                              </span>
                            </span>
                            <span>
                              Wk: <span className="text-foreground">{o.dippingWeek || "—"}</span>
                            </span>
                          </div>
                          {arrival && (
                            <div className="mt-2 pt-2 border-t border-border text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="font-medium">Arrival</span>
                                <span className="text-muted-foreground">
                                  {formatDate(arrival.arrivalDate)}
                                </span>
                              </div>
                              {(arrival.arrivalTemp1 !== null ||
                                arrival.arrivalTemp2 !== null ||
                                arrival.arrivalTemp3 !== null) && (
                                <div className="text-muted-foreground">
                                  Temps:{" "}
                                  {[
                                    arrival.arrivalTemp1,
                                    arrival.arrivalTemp2,
                                    arrival.arrivalTemp3,
                                  ]
                                    .filter((v) => v !== null)
                                    .join(" / ")}{" "}
                                  °C
                                </div>
                              )}
                              {arrival.dischargeWaitingMin !== null && (
                                <div className="text-muted-foreground">
                                  Discharge wait: {arrival.dischargeWaitingMin} min
                                </div>
                              )}
                              {arrival.specificComments && (
                                <p className="text-foreground/80 italic">
                                  "{arrival.specificComments}"
                                </p>
                              )}
                            </div>
                          )}
                          {(() => {
                            const qrId = o.qualityReportId;
                            const qr = qrId ? qualityReportMap.get(qrId) : null;
                            if (!qr) return null;
                            const isOpen = expandedReportFor === o.id;
                            const farmName =
                              accountNameMap.get(qr.farmAccountId) ||
                              accountNameMap.get(o.farmAccountId) ||
                              "—";
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
                                  {isOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                  <FileText className="h-3.5 w-3.5" />
                                  {isOpen ? "Hide Quality Report" : "Quality Report"}
                                  <span className="text-muted-foreground ml-1">· wk {qr.weekNr}</span>
                                </Button>
                                {isOpen && (
                                  <div
                                    className="mt-3 rounded-lg bg-muted/20 border border-border p-2"
                                    data-pdf-section
                                  >
                                    <QualityReportBody
                                      report={qr}
                                      farmName={farmName}
                                      createdByName={createdByName}
                                    />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A single trip's panel: route map, summary cards, and per-trip statistics.
 *  The multigraph itself is rendered once at container scope so multiple
 *  loggers can be compared on one chart. */
function TripSection({ trip, vfTracking }: { trip: SFTrip; vfTracking: VFTracking | null }) {
  const { readings } = useSensiwatchReadings(
    trip.serialNumber ?? null,
    trip.actualDepartureTime ?? null
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border overflow-hidden" data-pdf-section>
        <TripPathMap trip={trip} height={280} vfTracking={vfTracking} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-pdf-section>
        <MostRecentCard trip={trip} />
        <OriginCard trip={trip} />
      </div>

      <div className="grid grid-cols-3 gap-4" data-pdf-section>
        <StatBox
          label="Avg Temperature"
          value={
            readings.length > 0
              ? (readings.reduce((s, r) => s + r.temp, 0) / readings.length).toFixed(1) + " °C"
              : "—"
          }
          color="text-primary"
        />
        <StatBox
          label="Avg Humidity"
          value={
            readings.length > 0
              ? (readings.reduce((s, r) => s + r.humidity, 0) / readings.length).toFixed(1) + " %"
              : "—"
          }
          color="text-accent"
        />
        <StatBox
          label="Max Light"
          value={
            readings.length > 0
              ? Math.max(...readings.map((r) => r.light)).toFixed(1) + " %"
              : "—"
          }
          color="text-warning"
        />
      </div>
    </div>
  );
}

/** Shown when a container has no datalogger trips attached.
 *  - If VesselFinder tracking is active, still show the route map (with VF only).
 *  - Admin/staff can manually attach a datalogger by typing its internal trip id. */
function NoLoggerSection({
  vfTracking,
  orderNumbers,
  canManage,
}: {
  vfTracking: VFTracking | null;
  orderNumbers: string[];
  canManage: boolean;
}) {
  const [internalId, setInternalId] = useState("");
  const [orderNumber, setOrderNumber] = useState<string>(orderNumbers[0] || "");
  const [saving, setSaving] = useState(false);

  const hasVf = vfTracking?.status === "success" && !!vfTracking.response?.general;

  const syntheticTrip: SFTrip = useMemo(
    () => ({
      tripId: "vf-only",
      tripStatus: "Live tracking",
      internalTripId: "",
      originName: "",
      originAddress: "",
      destinationName: "",
      carrier: "",
      stops: 0,
      plannedDepartureTime: null,
      actualDepartureTime: null,
      latitude: null,
      longitude: null,
      serialNumber: null,
      lastTemp: null,
      lastLight: null,
      lastHumidity: null,
      lastReadingTime: null,
      lastLocation: null,
      isBackfillOnly: false,
    }),
    []
  );

  const handleAttach = async () => {
    const id = internalId.trim();
    if (!id || !orderNumber) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("sf_logger_attachments")
        .upsert(
          { order_number: orderNumber, internal_trip_id: id },
          { onConflict: "order_number" }
        );
      if (error) throw error;
      toast({
        title: "Datalogger attached",
        description: `Linked trip ${id} to order ${orderNumber}. Reload to see the trip.`,
      });
      setInternalId("");
    } catch (e: any) {
      toast({ title: "Failed to attach", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {hasVf && (
        <div className="rounded-xl border border-border overflow-hidden" data-pdf-section>
          <TripPathMap trip={syntheticTrip} height={280} vfTracking={vfTracking} />
        </div>
      )}
      <div className="rounded-xl border border-border p-4 bg-card">
        <p className="text-sm font-semibold mb-1">No datalogger attached</p>
        <p className="text-xs text-muted-foreground mb-3">
          {canManage
            ? "If a datalogger trip exists for this container, attach it here using its SensiWatch trip id, internal trip id, or device serial number."
            : "No datalogger trip is linked to this container yet."}
        </p>
        {canManage && orderNumbers.length > 0 && (
          <div className="space-y-2">
            {orderNumbers.length > 1 && (
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Attach to order</label>
                <Select value={orderNumber} onValueChange={setOrderNumber}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {orderNumbers.map((on) => (
                      <SelectItem key={on} value={on} className="text-xs font-mono">
                        {on}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">SensiWatch trip id, internal trip id, or device serial</label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={internalId}
                  onChange={(e) => setInternalId(e.target.value)}
                  placeholder="e.g. 3670537 or PKF9A00WS4"
                  className="h-8 text-xs font-mono"
                />
                <Button size="sm" onClick={handleAttach} disabled={!internalId.trim() || saving} className="h-8 text-xs">
                  {saving ? <Loader2Icon className="h-3 w-3 animate-spin" /> : "Attach"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Enter any of: SensiWatch trip id (e.g. <code>3670537</code>), internal trip id (without the <code>-1</code>/<code>-2</code> logger suffix), or device serial number (e.g. <code>PKF9A00WS4</code>).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// gets a temp/humidity/light triple drawn in the same hue family so they're
// visually grouped.
const LOGGER_COLORS: { temp: string; humidity: string; light: string }[] = [
  { temp: "hsl(207, 100%, 35%)", humidity: "hsl(90, 67%, 41%)", light: "hsl(38, 92%, 50%)" },
  { temp: "hsl(340, 75%, 45%)", humidity: "hsl(170, 70%, 38%)", light: "hsl(20, 90%, 55%)" },
  { temp: "hsl(265, 65%, 50%)", humidity: "hsl(195, 75%, 42%)", light: "hsl(55, 90%, 50%)" },
  { temp: "hsl(0, 70%, 45%)", humidity: "hsl(140, 60%, 40%)", light: "hsl(45, 95%, 52%)" },
];

/** Combined multigraph for one or many loggers on a container. When only a
 *  single logger is present this is identical to the previous per-trip graph;
 *  with multiple loggers each metric gets one line per serial. */
function CombinedMultigraph({ trips }: { trips: SFTrip[] }) {
  const serials = useMemo(
    () => trips.map((t) => t.serialNumber).filter((s): s is string => !!s),
    [trips]
  );
  const { data, isLoading } = useMultiSensiwatchReadings(serials);
  const isMulti = serials.length > 1;

  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-semibold text-sm mb-3">
        Multigraph
        {isMulti && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({serials.length} loggers combined)
          </span>
        )}
      </h3>
      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading sensor data…</span>
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No sensor readings available.
        </p>
      ) : (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval={Math.max(0, Math.floor(data.length / 6))}
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
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {serials.flatMap((sn, i) => {
                const c = LOGGER_COLORS[i % LOGGER_COLORS.length];
                const suffix = isMulti ? ` · ${sn}` : "";
                return [
                  <Line
                    key={`t-${sn}`}
                    yAxisId="left"
                    type="monotone"
                    dataKey={`temp_${sn}`}
                    name={`Temp (°C)${suffix}`}
                    stroke={c.temp}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />,
                  <Line
                    key={`h-${sn}`}
                    yAxisId="right"
                    type="monotone"
                    dataKey={`humidity_${sn}`}
                    name={`Humidity (%)${suffix}`}
                    stroke={c.humidity}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />,
                  <Line
                    key={`l-${sn}`}
                    yAxisId="right"
                    type="monotone"
                    dataKey={`light_${sn}`}
                    name={`Light (%)${suffix}`}
                    stroke={c.light}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />,
                ];
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : "font-medium"}`}>{value}</div>
    </div>
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
      {trip.isBackfillOnly && (
        <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5">
          <p className="text-[11px] text-warning-foreground/90 leading-tight">
            <span className="font-semibold">Historical data only</span> — no live
            update since the backfill (last reading: 19 Apr 23:59).
          </p>
        </div>
      )}
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
      <p className="font-medium text-sm">{trip.originName || "—"}</p>
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
