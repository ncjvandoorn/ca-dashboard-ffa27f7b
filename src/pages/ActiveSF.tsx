import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSensiwatchTrips } from "@/hooks/useSensiwatchData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, ArrowUp, ArrowDown, Ship, RefreshCw, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TripDetailDialog } from "@/components/dashboard/TripDetailDialog";
import { SFWorldMap } from "@/components/dashboard/SFWorldMap";
import chrysalLogo from "@/assets/chrysal-logo.png";

export type SFTrip = {
  tripId: string;
  tripStatus: string;
  internalTripId: string;
  originName: string;
  originAddress: string;
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
  const { isCustomer } = useAuth();
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("tripId");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTrip, setSelectedTrip] = useState<SFTrip | null>(null);

  const { data: trips, isLoading, error, refetch } = useSensiwatchTrips();

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let list = trips;
    if (q) {
      list = list.filter((t) =>
        t.tripId.toLowerCase().includes(q) ||
        t.tripStatus.toLowerCase().includes(q) ||
        t.internalTripId.toLowerCase().includes(q) ||
        t.originName.toLowerCase().includes(q) ||
        t.carrier.toLowerCase().includes(q) ||
        (t.plannedDepartureTime || "").toLowerCase().includes(q)
      );
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
  }, [trips, query, sortField, sortDir]);

  const tripsWithLocation = useMemo(
    () => filtered.filter((t) => t.latitude !== null && t.longitude !== null),
    [filtered]
  );

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
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <div className="rounded-xl px-3 py-2 flex items-center bg-card border border-border/50 shadow-sm shrink-0">
            <img src={chrysalLogo} alt="Chrysal" className="h-6 w-auto max-w-none block shrink-0" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Ship className="h-5 w-5 text-primary" />
              Active Sea Freight
            </h1>
            <p className="text-sm text-muted-foreground">
              Live datalogger tracking for sea freight containers
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} className="ml-auto gap-2" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
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

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search trips…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} trip{filtered.length !== 1 ? "s" : ""}
          </span>
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
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("tripId")}>
                    Trip ID <SortIcon field="tripId" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("tripStatus")}>
                    Trip Status <SortIcon field="tripStatus" />
                  </TableHead>
                  <TableHead>Internal Trip ID</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead className="text-center">Stops</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("plannedDepartureTime")}>
                    Planned Departure <SortIcon field="plannedDepartureTime" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((trip) => (
                  <TableRow
                    key={trip.tripId}
                    className="cursor-pointer hover:bg-primary/5 transition-colors"
                    onClick={() => setSelectedTrip(trip)}
                  >
                    <TableCell className="font-semibold text-primary">{trip.tripId}</TableCell>
                    <TableCell>{statusBadge(trip.tripStatus)}</TableCell>
                    <TableCell className="font-mono text-xs">{trip.internalTripId}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{trip.originName}</div>
                      <div className="text-xs text-muted-foreground">{trip.originAddress}</div>
                    </TableCell>
                    <TableCell>{trip.carrier || "—"}</TableCell>
                    <TableCell className="text-center">{trip.stops}</TableCell>
                    <TableCell className="text-sm">{trip.plannedDepartureTime || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <TripDetailDialog trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
    </div>
  );
};

export default ActiveSF;
