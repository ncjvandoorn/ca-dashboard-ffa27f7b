import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSensiwatchTrips } from "@/hooks/useSensiwatchData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, ArrowUp, ArrowDown, Ship } from "lucide-react";
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

// Mock data based on the screenshots — will be replaced by API data
const MOCK_TRIPS: SFTrip[] = [
  { tripId: "3768633", tripStatus: "Not Started", internalTripId: "SO00006270-1", originName: "Kisima Farm Floriculture Dept.", originAddress: "4C69, +J48,,Muchiene,,60200, KE", carrier: "", stops: 1, plannedDepartureTime: null, actualDepartureTime: null, latitude: -0.15, longitude: 36.96, serialNumber: "PKF9A012H4", lastTemp: null, lastLight: null, lastHumidity: null, lastReadingTime: null, lastLocation: null },
  { tripId: "3767436", tripStatus: "In Transit", internalTripId: "SO00006290-1", originName: "Nini Ltd.", originAddress: "5CV6, Q6M,,Naivasha,,20117, KE", carrier: "", stops: 1, plannedDepartureTime: null, actualDepartureTime: "14/04/2026 08:30:00", latitude: 15.5, longitude: -30.2, serialNumber: "PKF9A015K2", lastTemp: 3.2, lastLight: 0, lastHumidity: 94.1, lastReadingTime: "15/04/2026 12:30:00", lastLocation: "Atlantic Ocean" },
  { tripId: "3767424", tripStatus: "In Transit", internalTripId: "SO00006288-1", originName: "Nini Ltd.", originAddress: "5CV6, Q6M,,Naivasha,,20117, KE", carrier: "", stops: 1, plannedDepartureTime: null, actualDepartureTime: "13/04/2026 10:15:00", latitude: 25.3, longitude: -20.5, serialNumber: "PKF9A018M1", lastTemp: 2.8, lastLight: 0, lastHumidity: 95.2, lastReadingTime: "15/04/2026 14:20:00", lastLocation: "Atlantic Ocean" },
  { tripId: "3761762", tripStatus: "In Transit", internalTripId: "SO00006272-1", originName: "Shalimar Flowers Ltd.", originAddress: "77PR, RH,,Kasarani,,00608, KE", carrier: "", stops: 1, plannedDepartureTime: null, actualDepartureTime: "14/04/2026 08:47:59", latitude: -1.1, longitude: 37.0, serialNumber: "PKF9A012H4", lastTemp: 4.88, lastLight: 0, lastHumidity: 95.5, lastReadingTime: "15/04/2026 17:46:46", lastLocation: "Nairobi, Kenya" },
  { tripId: "3759705", tripStatus: "Not Started", internalTripId: "SO00000121-2", originName: "Triachem", originAddress: "Kruisstraat, 5,,Joure,Friesland,8501BP, NL", carrier: "", stops: 1, plannedDepartureTime: null, actualDepartureTime: null, latitude: 52.97, longitude: 5.8, serialNumber: null, lastTemp: null, lastLight: null, lastHumidity: null, lastReadingTime: null, lastLocation: null },
  { tripId: "3734769", tripStatus: "In Transit", internalTripId: "SO00006235-1", originName: "Flamingo Horticulture Kenya Ltd.", originAddress: "59RX, +HH4,,Sulmac Village,,20151, KE", carrier: "", stops: 1, plannedDepartureTime: null, actualDepartureTime: "10/04/2026 06:00:00", latitude: 48.2, longitude: -5.1, serialNumber: "PKF9A020P3", lastTemp: 1.5, lastLight: 0, lastHumidity: 96.0, lastReadingTime: "15/04/2026 10:00:00", lastLocation: "Bay of Biscay" },
  { tripId: "3728936", tripStatus: "In Transit", internalTripId: "SO00006203-1", originName: "Mt. Elgon Orchards", originAddress: "Chepcoina,,Mount Elgon,,, KE", carrier: "Maersk", stops: 1, plannedDepartureTime: null, actualDepartureTime: "08/04/2026 14:00:00", latitude: 51.9, longitude: 4.5, serialNumber: "PKF9A025R7", lastTemp: 2.1, lastLight: 0, lastHumidity: 93.8, lastReadingTime: "15/04/2026 16:00:00", lastLocation: "Rotterdam, NL" },
  { tripId: "3728928", tripStatus: "In Transit", internalTripId: "SO00006202-1", originName: "Mt. Elgon Orchards", originAddress: "Chepcoina,,Mount Elgon,,, KE", carrier: "Maersk", stops: 1, plannedDepartureTime: null, actualDepartureTime: "08/04/2026 14:30:00", latitude: 51.4, longitude: 3.6, serialNumber: "PKF9A026S8", lastTemp: 2.3, lastLight: 0, lastHumidity: 94.2, lastReadingTime: "15/04/2026 15:30:00", lastLocation: "Antwerp, BE" },
  { tripId: "3728887", tripStatus: "In Transit", internalTripId: "SO00006205-1", originName: "Mt. Elgon Orchards", originAddress: "Chepcoina,,Mount Elgon,,, KE", carrier: "Maersk", stops: 1, plannedDepartureTime: null, actualDepartureTime: "08/04/2026 15:00:00", latitude: 36.0, longitude: -10.0, serialNumber: "PKF9A027T9", lastTemp: 3.0, lastLight: 0, lastHumidity: 92.5, lastReadingTime: "15/04/2026 14:00:00", lastLocation: "Off Portugal" },
  { tripId: "3728875", tripStatus: "In Transit", internalTripId: "SO00006204-1", originName: "Mt. Elgon Orchards", originAddress: "Chepcoina,,Mount Elgon,,, KE", carrier: "Maersk", stops: 1, plannedDepartureTime: null, actualDepartureTime: "08/04/2026 15:30:00", latitude: 30.5, longitude: -15.2, serialNumber: "PKF9A028U0", lastTemp: 3.5, lastLight: 0, lastHumidity: 91.8, lastReadingTime: "15/04/2026 13:00:00", lastLocation: "Off Morocco" },
  { tripId: "3723871", tripStatus: "In Transit", internalTripId: "SO00006192-1", originName: "Ol-Njorowa Limited", originAddress: "6CJJ, 4C8,,Karagita,,20117, KE", carrier: "", stops: 1, plannedDepartureTime: null, actualDepartureTime: "07/04/2026 09:00:00", latitude: 5.0, longitude: 20.0, serialNumber: "PKF9A030W2", lastTemp: 4.0, lastLight: 0, lastHumidity: 90.5, lastReadingTime: "15/04/2026 11:00:00", lastLocation: "Gulf of Guinea" },
  { tripId: "3723810", tripStatus: "In Transit", internalTripId: "SO00006164-1", originName: "Bilashaka", originAddress: "77JR, +XPM,,Kasarani,,00618, KE", carrier: "Long Storage", stops: 1, plannedDepartureTime: "07/04/2026 10:56:00", actualDepartureTime: "07/04/2026 10:56:00", latitude: 35.5, longitude: -75.5, serialNumber: "PKF9A032Y4", lastTemp: 1.8, lastLight: 0, lastHumidity: 97.0, lastReadingTime: "15/04/2026 09:00:00", lastLocation: "Off North Carolina, US" },
];

type SortField = "tripId" | "tripStatus" | "plannedDepartureTime";
type SortDir = "asc" | "desc";

const ActiveSF = () => {
  const navigate = useNavigate();
  const { isCustomer } = useAuth();
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("tripId");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTrip, setSelectedTrip] = useState<SFTrip | null>(null);

  // TODO: replace with real API data when available
  const trips = MOCK_TRIPS;
  const isLoading = false;

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
      "Not Started": "bg-muted text-muted-foreground",
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
        </div>

        {/* World Map */}
        <div className="rounded-xl border border-border bg-card shadow-sm mb-6 overflow-hidden">
          <SFWorldMap trips={tripsWithLocation} onSelectTrip={setSelectedTrip} />
        </div>

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
