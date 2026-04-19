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
import { ArrowLeft, Search, ArrowUp, ArrowDown, Ship, AlertCircle, Layers, X, EyeOff, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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

type SortField = "tripId" | "tripStatus" | "plannedDepartureTime";
type SortDir = "asc" | "desc";

const ActiveSF = () => {
  const navigate = useNavigate();
  const { isCustomer, isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("tripId");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTrip, setSelectedTrip] = useState<SFTrip | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const { data: trips, isLoading, error, refetch } = useSensiwatchTrips();
  const { data: servicesOrders } = useServicesOrders();
  const { data: accounts } = useAccounts();
  const { data: customerFarms } = useCustomerFarms();
  const { data: containers } = useContainers();
  const vfActiveSet = useVesselFinderActiveSet(isAdmin);

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

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    // Only show trips whose linked order has purposeName "Sea Freight"
    let list = trips.filter((t) => {
      const info = lookupOrder(t.internalTripId);
      return info?.purposeName === "Sea Freight";
    });
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
  }, [trips, query, sortField, sortDir, lookupOrder]);

  const tripsWithLocation = useMemo(
    () => filtered.filter((t) => t.latitude !== null && t.longitude !== null),
    [filtered]
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
          <div className="rounded-xl px-3 py-2 flex items-center bg-card border border-border/50 shadow-sm shrink-0">
            <img src={chrysalLogo} alt="Chrysal" className="h-6 w-auto max-w-none block shrink-0" />
          </div>
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
            <SFWorldMap trips={tripsWithLocation} onSelectTrip={setSelectedTrip} />
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
          <div className="ml-auto flex items-center gap-2">
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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all trips"
                    />
                  </TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Internal Trip ID</TableHead>
                  <TableHead>Container #</TableHead>
                  <TableHead>Drop-off</TableHead>
                  <TableHead>Shipping</TableHead>
                  <TableHead>Origin &amp; Current Location</TableHead>
                  <TableHead>Destination</TableHead>
                  {isAdmin && <TableHead className="text-center">Tracking</TableHead>}
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
                      className="w-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(trip.tripId)}
                        onCheckedChange={() => toggleSelected(trip.tripId)}
                        aria-label={`Select trip ${trip.tripId}`}
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {info?.dippingWeek || <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {trip.internalTripId}
                      {trip.lastReadingTime && (
                        <div className="text-[10px] text-muted-foreground font-sans normal-case mt-0.5">
                          last: {new Date(trip.lastReadingTime).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {info?.containerNumber || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatShortDate(info?.dropoffDate ?? null)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatShortDate(info?.shippingDate ?? null)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{trip.originName}</div>
                      <div className="text-xs text-muted-foreground">{trip.originAddress}</div>
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
                    {isAdmin && (
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
