import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSensiwatchTrips } from "@/hooks/useSensiwatchData";
import { useServicesOrders, useAccounts, useCustomerFarms, useContainers } from "@/hooks/useQualityData";
import { useVesselFinderActiveSet } from "@/hooks/useVesselFinder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, ArrowUp, ArrowDown, Ship, AlertCircle, Layers, X, EyeOff, Eye, Activity, Radio } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripDetailDialog } from "@/components/dashboard/TripDetailDialog";
import { CompareTripsDialog } from "@/components/dashboard/CompareTripsDialog";
import { SFWorldMap } from "@/components/dashboard/SFWorldMap";
import chrysalLogo from "@/assets/chrysal-logo.png";
import { stripLoggerSuffix, formatShortDate } from "@/lib/sfFormat";
import { PageHeaderActions } from "@/components/PageHeaderActions";

export { stripLoggerSuffix, formatShortDate };

export type SFTrip = {
  tripId: string;
  tripStatus: string;
  internalTripId: string;
  originName: string;
  originAddress: string;
  destinationName: string;
  carrier: string;
  stops: number;
  plannedDepartureTime: string | null;
  actualDepartureTime: string | null;
  latitude: number | null;
  longitude: number | null;
  serialNumber: string | null;
  lastTemp: number | null;
  lastLight: number | null;
  lastHumidity: number | null;
  lastReadingTime: string | null;
  lastLocation: string | null;
};

type SortField = "tripId" | "tripStatus" | "plannedDepartureTime" | "week";
type SortDir = "asc" | "desc";

const ActiveSF = () => {
  const navigate = useNavigate();
  const { isCustomer, isAdmin, customerAccount } = useAuth();
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("week");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTrip, setSelectedTrip] = useState<SFTrip | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [onlySF, setOnlySF] = useState(true);
  const [onlyActiveDL, setOnlyActiveDL] = useState(false);
  const [onlyLiveTracking, setOnlyLiveTracking] = useState(false);
  const [year, setYear] = useState<string>("2026");

  const { data: trips, isLoading, error, refetch } = useSensiwatchTrips();
  const { data: servicesOrders } = useServicesOrders();
  const { data: accounts } = useAccounts();
  const { data: customerFarms } = useCustomerFarms();
  const { data: containers } = useContainers();
  const vfActiveSet = useVesselFinderActiveSet(isAdmin || isCustomer);

  // Load hidden trip IDs (visible to all authenticated users)
  const loadHidden = useCallback(async () => {
    const { data, error } = await supabase.from("sf_hidden_trips").select("trip_id");
    if (!error && data) setHiddenIds(new Set(data.map((r) => r.trip_id)));
  }, []);
  useEffect(() => { loadHidden(); }, [loadHidden]);

  const toggleHidden = async (tripId: string) => {
    if (!isAdmin) return;
    const isHidden = hiddenIds.has(tripId);
    if (isHidden) {
      const { error } = await supabase.from("sf_hidden_trips").delete().eq("trip_id", tripId);
      if (error) { toast({ title: "Failed to unhide", description: error.message, variant: "destructive" }); return; }
      setHiddenIds((prev) => { const n = new Set(prev); n.delete(tripId); return n; });
    } else {
      const { error } = await supabase.from("sf_hidden_trips").insert({ trip_id: tripId });
      if (error) { toast({ title: "Failed to hide", description: error.message, variant: "destructive" }); return; }
      setHiddenIds((prev) => new Set(prev).add(tripId));
    }
  };

  // Map orderNumber -> { customerName, farmName, dippingWeek, bookingCode, containerNumber, containerId, dropoffDate, shippingDate, purposeName, orderId }
  const orderInfo = useMemo(() => {
    const accountMap = new Map((accounts || []).map((a) => [a.id, a.name] as const));
    const farmAccountId = new Map(
      (customerFarms || []).map((f) => [f.id, f.farmAccountId] as const)
    );
    const containerMap = new Map(
      (containers || []).map((c) => [c.id, c] as const)
    );
    const m = new Map<string, {
      orderId: string;
      customer: string; farm: string; dippingWeek: string;
      bookingCode: string; containerNumber: string; containerId: string;
      dropoffDate: number | null; shippingDate: number | null;
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
        containerId: o.containerId || "",
        dropoffDate: c?.dropoffDate ?? null,
        shippingDate: c?.shippingDate ?? null,
        purposeName: o.purposeName || "",
      });
    }
    return m;
  }, [servicesOrders, accounts, customerFarms, containers]);

  const lookupOrder = useCallback(
    (internalId: string) => orderInfo.get(stripLoggerSuffix(internalId)) || null,
    [orderInfo]
  );

  // Build the master list of rows: one per services order, plus orphan trips
  // (sensiwatch trips whose internal id doesn't match any order). Each row is
  // a synthetic SFTrip — for orders without a logger, sensor fields are null.
  const allRows = useMemo<SFTrip[]>(() => {
    // Index sensiwatch trips by stripped internal trip id (= orderNumber)
    const tripByOrder = new Map<string, SFTrip>();
    for (const t of trips) {
      const key = stripLoggerSuffix(t.internalTripId);
      if (key && !tripByOrder.has(key)) tripByOrder.set(key, t);
    }
    const rows: SFTrip[] = [];
    const usedTripIds = new Set<string>();
    // 1) one row per services order
    for (const [orderNumber, info] of orderInfo.entries()) {
      const t = tripByOrder.get(orderNumber);
      if (t) {
        usedTripIds.add(t.tripId);
        rows.push(t);
      } else {
        // Synthetic row for an order with no datalogger trip yet
        rows.push({
          tripId: `order:${info.orderId}`,
          tripStatus: "No Logger",
          internalTripId: orderNumber,
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
        });
      }
    }
    // 2) orphan trips not linked to an order
    for (const t of trips) {
      if (!usedTripIds.has(t.tripId)) rows.push(t);
    }
    return rows;
  }, [trips, orderInfo]);

  // Build the list of distinct years available, derived from dippingWeek (YYWW).
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const info of orderInfo.values()) {
      const yy = (info.dippingWeek || "").slice(0, 2);
      if (/^\d{2}$/.test(yy)) years.add(`20${yy}`);
    }
    // Always include the default year so the dropdown is never empty.
    years.add("2026");
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [orderInfo]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const yearSuffix = year ? year.slice(-2) : "";
    let list = allRows.filter((t) => {
      const info = lookupOrder(t.internalTripId);
      // Year filter — match dippingWeek YY prefix. Rows with no dippingWeek
      // are kept only when they're orphans (no order info at all).
      if (year && info && !(info.dippingWeek || "").startsWith(yearSuffix)) return false;
      // Only SF: keep rows whose linked order has purpose "Sea Freight".
      // Orphan trips (no order) are excluded when this toggle is on.
      if (onlySF && info?.purposeName !== "Sea Freight") return false;
      // Only active DL: must have a sensiwatch trip with readings
      if (onlyActiveDL && !t.serialNumber) return false;
      // Only live tracking: must have an enabled VF tracker for this container
      if (onlyLiveTracking) {
        const vf = info?.containerId ? vfActiveSet.get(info.containerId) : null;
        if (!vf || !vf.enabled) return false;
      }
      return true;
    });
    // Customers: only trips whose linked order belongs to them.
    if (isCustomer) {
      if (!customerAccount) {
        list = [];
      } else {
        const myOrderIds = new Set(
          (servicesOrders || [])
            .filter((o) => o.customerAccountId === customerAccount.customerAccountId)
            .map((o) => o.orderNumber)
            .filter(Boolean)
        );
        list = list.filter((t) => myOrderIds.has(stripLoggerSuffix(t.internalTripId)));
      }
    }
    // Hide rows admin marked as hidden — bypassed by Show hidden.
    if (!(isAdmin && showHidden)) {
      list = list.filter((t) => !hiddenIds.has(t.tripId));
    }
    if (q) {
      list = list.filter((t) => {
        const info = lookupOrder(t.internalTripId);
        const haystack = [
          t.tripId,
          t.tripStatus,
          t.internalTripId,
          t.originName,
          t.originAddress,
          t.destinationName,
          t.carrier,
          t.serialNumber,
          t.lastLocation,
          t.lastTemp != null ? String(t.lastTemp) : "",
          t.lastHumidity != null ? String(t.lastHumidity) : "",
          t.lastReadingTime,
          t.plannedDepartureTime,
          t.actualDepartureTime,
          String(t.stops ?? ""),
          info?.dippingWeek,
          info?.bookingCode,
          info?.containerNumber,
          info?.customer,
          info?.farm,
          info?.purposeName,
          formatShortDate(info?.dropoffDate ?? null),
          formatShortDate(info?.shippingDate ?? null),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      if (sortField === "tripId") {
        return sortDir === "asc"
          ? Number(a.tripId) - Number(b.tripId)
          : Number(b.tripId) - Number(a.tripId);
      }
      if (sortField === "tripStatus") {
        return sortDir === "asc"
          ? a.tripStatus.localeCompare(b.tripStatus)
          : b.tripStatus.localeCompare(a.tripStatus);
      }
      if (sortField === "plannedDepartureTime") {
        const av = a.plannedDepartureTime || "";
        const bv = b.plannedDepartureTime || "";
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return 0;
    });
  }, [allRows, query, sortField, sortDir, lookupOrder, hiddenIds, isAdmin, isCustomer, customerAccount, servicesOrders, showHidden, onlySF, onlyActiveDL, onlyLiveTracking, vfActiveSet]);

  // Map tripId -> VF active tracking info (when available for the trip's container)
  const vfByTrip = useMemo(() => {
    const m = new Map<string, ReturnType<typeof vfActiveSet.get>>();
    for (const t of filtered) {
      const info = lookupOrder(t.internalTripId);
      const vf = info?.containerId ? vfActiveSet.get(info.containerId) : null;
      if (vf && vf.enabled && vf.status === "success") m.set(t.tripId, vf);
    }
    return m;
  }, [filtered, lookupOrder, vfActiveSet]);

  const tripsWithLocation = useMemo(
    () =>
      filtered.filter((t) => {
        if (t.latitude !== null && t.longitude !== null) return true;
        const vf = vfByTrip.get(t.tripId);
        const gen = vf?.response?.general;
        return !!(gen?.currentLocation?.vessel || gen?.origin || gen?.destination);
      }),
    [filtered, vfByTrip]
  );

  // Selected trips, kept in same order as `filtered` for stable display.
  const selectedTrips = useMemo(
    () => filtered.filter((t) => selectedIds.has(t.tripId)),
    [filtered, selectedIds]
  );

  const toggleSelected = (tripId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tripId)) next.delete(tripId);
      else next.add(tripId);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.tripId));
  const someFilteredSelected = !allFilteredSelected && filtered.some((t) => selectedIds.has(t.tripId));
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.tripId)));
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc"
      ? <ArrowUp className="inline h-3 w-3 ml-1" />
      : <ArrowDown className="inline h-3 w-3 ml-1" />;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      "In Transit": "bg-primary/10 text-primary",
      "InTransit": "bg-primary/10 text-primary",
      "Not Started": "bg-muted text-muted-foreground",
      "NotStarted": "bg-muted text-muted-foreground",
      "Completed": "bg-accent/10 text-accent",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || "bg-muted text-muted-foreground"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="chrysal-gradient h-1.5" />
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Go to dashboard"
            className="rounded-xl px-3 py-2 flex items-center bg-card border border-border/50 shadow-sm shrink-0 hover:bg-accent/10 transition-colors cursor-pointer"
          >
            <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto max-w-none block shrink-0" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Ship className="h-5 w-5 text-primary" />
              Active Sea Freight
            </h1>
            <p className="text-sm text-muted-foreground">
              Live datalogger tracking for sea freight containers
            </p>
          </div>
          <PageHeaderActions />
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 mb-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Could not load trips: {error}</span>
            <Button variant="outline" size="sm" onClick={refetch} className="ml-auto">Retry</Button>
          </div>
        )}

        {/* World Map */}
        {tripsWithLocation.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm mb-6 overflow-hidden">
            <SFWorldMap trips={tripsWithLocation} vfByTrip={vfByTrip} onSelectTrip={setSelectedTrip} />
          </div>
        )}

        {/* Search + compare actions */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search week, booking, container, customer, farm, serial, location, temp…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} trip{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Toggle
              size="sm"
              variant="outline"
              pressed={onlySF}
              onPressedChange={setOnlySF}
              aria-label="Only Sea Freight"
            >
              <Ship className="h-4 w-4" />
              Only SF
            </Toggle>
            <Toggle
              size="sm"
              variant="outline"
              pressed={onlyActiveDL}
              onPressedChange={setOnlyActiveDL}
              aria-label="Only active dataloggers"
            >
              <Activity className="h-4 w-4" />
              Only active DL
            </Toggle>
            <Toggle
              size="sm"
              variant="outline"
              pressed={onlyLiveTracking}
              onPressedChange={setOnlyLiveTracking}
              aria-label="Only live tracking"
            >
              <Radio className="h-4 w-4" />
              Only live tracking
            </Toggle>
            {isAdmin && hiddenIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHidden((s) => !s)}
                className="text-muted-foreground"
              >
                {showHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {showHidden ? "Hide hidden" : `Show hidden (${hiddenIds.size})`}
              </Button>
            )}
            {selectedIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
                Clear ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              disabled={selectedIds.size < 2}
              onClick={() => setCompareOpen(true)}
            >
              <Layers className="h-4 w-4" />
              View together
              {selectedIds.size >= 2 && (
                <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">
                  {selectedIds.size}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Trip Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 && !error ? (
          <div className="rounded-xl border border-border bg-card shadow-sm p-12 text-center">
            <Ship className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No trips found</p>
            <p className="text-xs text-muted-foreground mt-1">Try refreshing or adjusting your search</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className={isAdmin ? "w-20" : "w-10"}>
                    <Checkbox
                      checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all trips"
                    />
                  </TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Container #</TableHead>
                  <TableHead>Drop-off</TableHead>
                  <TableHead>Shipping</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Destination</TableHead>
                  {(isAdmin || isCustomer) && <TableHead className="text-center">Tracking</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((trip) => {
                  const info = lookupOrder(trip.internalTripId);
                  return (
                  <TableRow
                    key={trip.tripId}
                    data-state={selectedIds.has(trip.tripId) ? "selected" : undefined}
                    className="cursor-pointer hover:bg-primary/5 transition-colors"
                    onClick={() => setSelectedTrip(trip)}
                  >
                    <TableCell
                      className={isAdmin ? "w-20" : "w-10"}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <Checkbox
                          checked={selectedIds.has(trip.tripId)}
                          onCheckedChange={() => toggleSelected(trip.tripId)}
                          aria-label={`Select trip ${trip.tripId}`}
                        />
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); toggleHidden(trip.tripId); }}
                            title={hiddenIds.has(trip.tripId) ? "Unhide row" : "Hide row for everyone"}
                          >
                            {hiddenIds.has(trip.tripId) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {info?.dippingWeek || <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {info?.containerNumber || (
                        <span className="text-muted-foreground normal-case font-sans">
                          {trip.internalTripId || "—"}
                        </span>
                      )}
                      {(() => {
                        const vf = info?.containerId ? vfActiveSet.get(info.containerId) : null;
                        const fmt = (iso: string | null | undefined) =>
                          iso
                            ? new Date(iso).toLocaleString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : null;
                        const lastQuality = fmt(trip.lastReadingTime);
                        const lastLocation =
                          vf?.enabled && vf.lastLocationAt
                            ? fmt(new Date(vf.lastLocationAt).toISOString())
                            : null;
                        if (!lastQuality && !lastLocation) return null;
                        return (
                          <div className="text-[10px] text-muted-foreground font-sans normal-case mt-0.5 leading-tight space-y-0.5">
                            {lastQuality && <div>Last quality: {lastQuality}</div>}
                            {lastLocation && <div>Last location: {lastLocation}</div>}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatShortDate(info?.dropoffDate ?? null)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatShortDate(info?.shippingDate ?? null)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{trip.originName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{trip.destinationName || "—"}</div>
                      {(() => {
                        const vf = info?.containerId ? vfActiveSet.get(info.containerId) : null;
                        if (!vf || !vf.enabled || (!vf.destinationName && !vf.destinationDate)) return null;
                        return (
                          <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                            {vf.destinationDate && (
                              <span>ETA {formatShortDate(vf.destinationDate * 1000)}</span>
                            )}
                            {vf.destinationName && (
                              <span>{vf.destinationDate ? " · " : ""}{vf.destinationName}</span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    {(isAdmin || isCustomer) && (
                      <TableCell className="text-center">
                        {(() => {
                          const vf = info?.containerId ? vfActiveSet.get(info.containerId) : null;
                          if (!vf || !vf.enabled) {
                            return <span className="text-muted-foreground/50 text-xs">—</span>;
                          }
                          const cls =
                            vf.status === "success" ? "bg-accent" :
                            vf.status === "error" ? "bg-destructive" :
                            "bg-primary animate-pulse";
                          return (
                            <span className="inline-flex items-center gap-1.5 text-[10px]">
                              <span className={`h-2 w-2 rounded-full ${cls}`} />
                              {vf.status !== "success" && (
                                <span className="text-muted-foreground capitalize">{vf.status}</span>
                              )}
                            </span>
                          );
                        })()}
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <TripDetailDialog
        trip={selectedTrip}
        orderInfo={selectedTrip ? lookupOrder(selectedTrip.internalTripId) : null}
        onClose={() => setSelectedTrip(null)}
      />

      {/* Compare-trips dialog */}
      <CompareTripsDialog
        open={compareOpen && selectedTrips.length >= 2}
        trips={selectedTrips}
        lookupOrder={lookupOrder}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
};

export type SFOrderInfo = {
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
} | null;

export default ActiveSF;
