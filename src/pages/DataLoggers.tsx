import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { ArrowLeft, Loader2, AlertTriangle, Filter } from "lucide-react";
import chrysalLogo from "@/assets/chrysal-logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { ContainerDetailDialog } from "@/components/dashboard/ContainerDetailDialog";
import {
  useServicesOrders,
  useAccounts,
  useCustomerFarms,
  useContainers,
} from "@/hooks/useQualityData";
import { useSensiwatchTrips } from "@/hooks/useSensiwatchData";
import { useAllSensiwatchReadings } from "@/hooks/useAllSensiwatchReadings";
import {
  buildLoggerSeries,
  EXCEPTION_RULES,
  formatDuration,
  type ExceptionType,
  type LoggerSeries,
} from "@/lib/loggerExceptions";
import { stripLoggerSuffix } from "@/lib/sfFormat";
import type { SFTrip } from "@/pages/ActiveSF";

// Hue per metric line in the multigraph (one chosen color per metric)
const TEMP_HUE = 0;
const HUM_HUE = 210;
const LIGHT_HUE = 48;

// Cap how many flagged loggers to plot at once — recharts gets sluggish past
// ~20 series, and the UI is unreadable anyway. We pick the top N sorted by
// most-recent activity.
const MAX_PLOT_LOGGERS = 12;

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const TWELVE_WEEKS_MS = 12 * 7 * 24 * 60 * 60 * 1000;

const DataLoggers = () => {
  const navigate = useNavigate();
  const [activeFilters, setActiveFilters] = useState<Set<ExceptionType>>(
    new Set(EXCEPTION_RULES.map((r) => r.key))
  );
  const [last12Weeks, setLast12Weeks] = useState(true);
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);

  const { data: readings, isLoading: loadingReadings, error } = useAllSensiwatchReadings();
  const { data: trips } = useSensiwatchTrips();
  const { data: servicesOrders } = useServicesOrders();
  const { data: accounts } = useAccounts();
  const { data: customerFarms } = useCustomerFarms();
  const { data: containers } = useContainers();

  // Same orderInfo map as Active SF, so click-to-detail can reuse the
  // ContainerDetailDialog.
  const orderInfo = useMemo(() => {
    const accountMap = new Map((accounts || []).map((a) => [a.id, a.name] as const));
    const farmAccountId = new Map(
      (customerFarms || []).map((f) => [f.id, f.farmAccountId] as const)
    );
    const containerMap = new Map((containers || []).map((c) => [c.id, c] as const));
    const m = new Map<string, {
      orderId: string;
      customer: string;
      farm: string;
      dippingWeek: string;
      bookingCode: string;
      containerNumber: string;
      containerId: string;
      dropoffDate: number | null;
      shippingDate: number | null;
      purposeName: string;
    }>();
    for (const o of servicesOrders || []) {
      if (!o.orderNumber) continue;
      const farmId = farmAccountId.get(o.farmAccountId) || o.farmAccountId;
      const c = containerMap.get(o.containerId);
      m.set(o.orderNumber, {
        orderId: o.id,
        customer: accountMap.get(o.customerAccountId) || "",
        farm: accountMap.get(farmId) || "",
        dippingWeek: o.dippingWeek || "",
        bookingCode: c?.bookingCode || "",
        containerNumber: c?.containerNumber || "",
        containerId: c ? o.containerId : "",
        dropoffDate: c?.dropoffDate ?? null,
        shippingDate: c?.shippingDate ?? null,
        purposeName: o.purposeName || "",
      });
    }
    return m;
  }, [servicesOrders, accounts, customerFarms, containers]);

  // Compute exception series once (heavy — only runs when readings change).
  const allSeries = useMemo(() => buildLoggerSeries(readings), [readings]);

  // Filter to loggers that have at least one *currently selected* exception.
  const flaggedSeries = useMemo(() => {
    return allSeries
      .filter((s) => s.flags.some((f) => activeFilters.has(f.rule)))
      .sort((a, b) => (b.lastTime || "").localeCompare(a.lastTime || ""));
  }, [allSeries, activeFilters]);

  // Per-rule counts (independent of current filter selection — for the chips)
  const ruleCounts = useMemo(() => {
    const counts: Record<ExceptionType, number> = {
      temp_above_5: 0,
      temp_above_15: 0,
      humidity_below_70: 0,
      light_high: 0,
    };
    for (const s of allSeries) {
      for (const f of s.flags) counts[f.rule]++;
    }
    return counts;
  }, [allSeries]);

  // Build the merged time-series for the multigraph (top N flagged loggers).
  const plotSeries = useMemo(() => flaggedSeries.slice(0, MAX_PLOT_LOGGERS), [flaggedSeries]);

  const chartData = useMemo(() => {
    type Row = { time: string; ts: number } & Record<string, number | string | null>;
    const merged = new Map<string, Row>();
    for (const s of plotSeries) {
      for (const r of s.readings) {
        if (!r.time) continue;
        const existing = merged.get(r.time) || { time: r.time, ts: new Date(r.time).getTime() };
        if (r.temp != null) (existing as any)[`temp_${s.serial}`] = r.temp;
        if (r.humidity != null) (existing as any)[`hum_${s.serial}`] = r.humidity;
        if (r.light != null) (existing as any)[`light_${s.serial}`] = r.light;
        merged.set(r.time, existing as Row);
      }
    }
    return Array.from(merged.values()).sort((a, b) => a.ts - b.ts);
  }, [plotSeries]);

  // Map serial → most-recent SFTrip (for popup)
  const tripsBySerial = useMemo(() => {
    const m = new Map<string, SFTrip[]>();
    for (const t of trips) {
      if (!t.serialNumber) continue;
      if (!m.has(t.serialNumber)) m.set(t.serialNumber, []);
      m.get(t.serialNumber)!.push(t);
    }
    return m;
  }, [trips]);

  const toggleFilter = (key: ExceptionType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Resolve the container for a clicked serial. Picks the most-recent SFTrip
  // for that serial, looks up its order, and opens ContainerDetailDialog.
  const resolveSelected = useMemo(() => {
    if (!selectedSerial) return null;
    const serialTrips = tripsBySerial.get(selectedSerial) || [];
    if (serialTrips.length === 0) return null;
    // Pick the trip with the most recent reading
    const newest = [...serialTrips].sort((a, b) =>
      (b.lastReadingTime || "").localeCompare(a.lastReadingTime || "")
    )[0];
    const info = orderInfo.get(stripLoggerSuffix(newest.internalTripId));
    if (!info?.containerId) {
      // No real container — surface trip data only
      return {
        trips: serialTrips,
        orders: [],
        container: {
          containerId: "",
          containerNumber: "",
          bookingCode: "",
          dropoffDate: null,
          shippingDate: null,
        },
      };
    }
    // Gather all SFTrips that belong to this container (so the dialog can
    // tab between every logger on this container).
    const containerTrips = trips.filter((t) => {
      const i = orderInfo.get(stripLoggerSuffix(t.internalTripId));
      return i?.containerId === info.containerId;
    });
    const orders = (servicesOrders || []).filter((o) => o.containerId === info.containerId);
    return {
      trips: containerTrips,
      orders,
      container: {
        containerId: info.containerId,
        containerNumber: info.containerNumber,
        bookingCode: info.bookingCode,
        dropoffDate: info.dropoffDate,
        shippingDate: info.shippingDate,
      },
    };
  }, [selectedSerial, tripsBySerial, orderInfo, trips, servicesOrders]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Top bar — same two-row pattern as other pages */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img src={chrysalLogo} alt="Chrysal" className="h-9 w-auto" />
            </div>
            <PageHeaderActions />
          </div>
          <div className="container mx-auto px-6 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h1 className="text-2xl font-semibold">Data Loggers — Exception Report</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Loggers across all trips that hit one of the exception rules below. Click any
              row to inspect the container, orders and full sensor history.
            </p>
          </div>
        </header>

        <main className="container mx-auto px-6 py-6 space-y-6">
          {/* Filter chips */}
          <section className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-2">
              <Filter className="h-3.5 w-3.5" /> Show loggers with:
            </span>
            {EXCEPTION_RULES.map((r) => {
              const active = activeFilters.has(r.key);
              return (
                <UITooltip key={r.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toggleFilter(r.key)}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors"
                      style={{
                        borderColor: active ? `hsl(${r.hue}, 70%, 45%)` : "hsl(var(--border))",
                        background: active ? `hsl(${r.hue}, 70%, 45%, 0.12)` : "transparent",
                        color: active ? `hsl(${r.hue}, 70%, 35%)` : "hsl(var(--muted-foreground))",
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: `hsl(${r.hue}, 70%, 45%)`, opacity: active ? 1 : 0.4 }}
                      />
                      <span className="font-medium">{r.shortLabel}</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {ruleCounts[r.key]}
                      </Badge>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-muted-foreground mt-0.5">{r.description}</div>
                    </div>
                  </TooltipContent>
                </UITooltip>
              );
            })}
          </section>

          {/* Status / loading */}
          {loadingReadings && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Analysing every datalogger reading…</span>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Could not load readings: {error}
            </div>
          )}

          {/* Multigraph */}
          {!loadingReadings && (
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <h2 className="font-semibold text-base">
                  Combined Multigraph · {plotSeries.length} flagged logger{plotSeries.length !== 1 ? "s" : ""}
                  {flaggedSeries.length > MAX_PLOT_LOGGERS && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (showing {MAX_PLOT_LOGGERS} most recent of {flaggedSeries.length})
                    </span>
                  )}
                </h2>
                <span className="text-xs text-muted-foreground">
                  Temp °C (left) · Humidity % (right) · Light dotted
                </span>
              </div>
              {plotSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  No loggers match the current filters.
                </p>
              ) : (
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10 }}
                        interval={Math.max(0, Math.floor(chartData.length / 8))}
                        tickFormatter={(v: string) =>
                          v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""
                        }
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
                      {/* Threshold guide lines */}
                      {activeFilters.has("temp_above_5") && (
                        <ReferenceLine yAxisId="left" y={5} stroke={`hsl(${TEMP_HUE}, 70%, 45%)`} strokeDasharray="2 4" strokeOpacity={0.4} />
                      )}
                      {activeFilters.has("temp_above_15") && (
                        <ReferenceLine yAxisId="left" y={15} stroke={`hsl(${TEMP_HUE}, 70%, 35%)`} strokeDasharray="2 4" strokeOpacity={0.5} />
                      )}
                      {activeFilters.has("humidity_below_70") && (
                        <ReferenceLine yAxisId="right" y={70} stroke={`hsl(${HUM_HUE}, 70%, 45%)`} strokeDasharray="2 4" strokeOpacity={0.4} />
                      )}
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={(v: string) => (v ? new Date(v).toLocaleString("en-GB") : "")}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {plotSeries.map((s) => (
                        <Line
                          key={`temp-${s.serial}`}
                          yAxisId="left"
                          type="monotone"
                          dataKey={`temp_${s.serial}`}
                          name={`${s.serial} · Temp`}
                          stroke={`hsl(${TEMP_HUE}, 70%, 45%)`}
                          strokeOpacity={0.85}
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls
                        />
                      ))}
                      {plotSeries.map((s) => (
                        <Line
                          key={`hum-${s.serial}`}
                          yAxisId="right"
                          type="monotone"
                          dataKey={`hum_${s.serial}`}
                          name={`${s.serial} · RH`}
                          stroke={`hsl(${HUM_HUE}, 70%, 45%)`}
                          strokeOpacity={0.6}
                          strokeWidth={1}
                          dot={false}
                          connectNulls
                        />
                      ))}
                      {plotSeries.map((s) => (
                        <Line
                          key={`light-${s.serial}`}
                          yAxisId="right"
                          type="monotone"
                          dataKey={`light_${s.serial}`}
                          name={`${s.serial} · Light`}
                          stroke={`hsl(${LIGHT_HUE}, 80%, 45%)`}
                          strokeOpacity={0.55}
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          )}

          {/* Flagged loggers table */}
          {!loadingReadings && (
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-baseline justify-between">
                <h2 className="font-semibold text-base">
                  Flagged Loggers · {flaggedSeries.length}
                </h2>
                <span className="text-xs text-muted-foreground">Click a row for full details</span>
              </div>
              {flaggedSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">
                  No loggers match the current filters.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Logger</TableHead>
                      <TableHead>Container · Booking</TableHead>
                      <TableHead>Customer · Farm</TableHead>
                      <TableHead>Exceptions</TableHead>
                      <TableHead>Last reading</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flaggedSeries.map((s) => {
                      const repInternal = s.internalTripIds[s.internalTripIds.length - 1] || "";
                      const orderNumber = stripLoggerSuffix(repInternal);
                      const info = orderInfo.get(orderNumber);
                      return (
                        <TableRow
                          key={s.serial}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedSerial(s.serial)}
                        >
                          <TableCell className="font-mono text-xs">{info?.dippingWeek || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{orderNumber || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{s.serial}</TableCell>
                          <TableCell className="text-xs">
                            <div className="font-mono">{info?.containerNumber || "—"}</div>
                            {info?.bookingCode && (
                              <div className="text-[10px] text-muted-foreground">{info.bookingCode}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{info?.customer || "—"}</div>
                            {info?.farm && (
                              <div className="text-[10px] text-muted-foreground">{info.farm}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {s.flags
                                .filter((f) => activeFilters.has(f.rule))
                                .map((f) => {
                                  const rule = EXCEPTION_RULES.find((r) => r.key === f.rule)!;
                                  return (
                                    <span
                                      key={f.rule}
                                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                      style={{
                                        background: `hsl(${rule.hue}, 70%, 45%, 0.15)`,
                                        color: `hsl(${rule.hue}, 70%, 30%)`,
                                      }}
                                      title={`${rule.label} · ${formatDuration(f.durationMs)}`}
                                    >
                                      {rule.shortLabel}
                                      <span className="opacity-70">{formatDuration(f.durationMs)}</span>
                                    </span>
                                  );
                                })}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {shortDate(s.lastTime)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>
          )}
        </main>

        {resolveSelected && (
          <ContainerDetailDialog
            trips={resolveSelected.trips}
            orders={resolveSelected.orders as any}
            container={resolveSelected.container}
            onClose={() => setSelectedSerial(null)}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default DataLoggers;
