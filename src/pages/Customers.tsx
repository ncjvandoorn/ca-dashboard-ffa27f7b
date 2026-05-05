import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import chrysalLogo from "@/assets/chrysal-logo.png";
import { useAccounts, useActivities, useUsers } from "@/hooks/useQualityData";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { CustomersMap, type CustomerMarker } from "@/components/dashboard/CustomersMap";
import { ActivityDialog } from "@/components/dashboard/ActivityDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2, RefreshCw } from "lucide-react";
import { bestAddress, geocodeCustomer, isEastAfricaAccount, preloadCloudCache } from "@/lib/customerGeocode";

interface EACustomer {
  id: string;
  name: string;
  address: string;
}

// Module-level cache so re-mounting the Customers page (after navigating away
// and back) shows the previously geocoded markers instantly. Manual "Refresh"
// still re-geocodes from scratch.
let markersCache: CustomerMarker[] = [];

export default function Customers() {
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useAccounts();
  const { data: activities = [] } = useActivities();
  const { data: users = [] } = useUsers();
  const [markers, setMarkers] = useState<CustomerMarker[]>(() => markersCache);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [activeFarm, setActiveFarm] = useState<{ id: string; name: string } | null>(null);

  const eaCustomers: EACustomer[] = useMemo(() => {
    if (!accounts) return [];
    return accounts
      .filter((a) => isEastAfricaAccount(a.deliveryAddress, a.mainAddress))
      .map((a) => ({ id: a.id, name: a.name, address: bestAddress(a.deliveryAddress, a.mainAddress) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts]);

  // Geocode in series (Nominatim asks ≤1 req/s). Cloud + local cache make repeats instant.
  useEffect(() => {
    if (eaCustomers.length === 0) return;

    // Skip rebuilding entirely if we already have a cached marker set covering
    // every East-Africa customer and the user did not request a refresh.
    if (!forceRefresh && markersCache.length > 0) {
      const cachedIds = new Set(markersCache.map((m) => m.id));
      const allCovered = eaCustomers.every((c) => cachedIds.has(c.id));
      if (allCovered) {
        setMarkers(markersCache);
        setProgress({ done: eaCustomers.length, total: eaCustomers.length });
        return;
      }
    }

    let cancelled = false;
    setProgress({ done: 0, total: eaCustomers.length });
    setMarkers([]);

    (async () => {
      // Preload cloud cache once so cached entries resolve synchronously.
      await preloadCloudCache();
      if (cancelled) return;

      const out: CustomerMarker[] = [];
      for (let i = 0; i < eaCustomers.length; i++) {
        if (cancelled) return;
        const c = eaCustomers[i];
        const geo = await geocodeCustomer(c.name, c.address, forceRefresh);
        if (geo && !cancelled) {
          out.push({
            id: c.id,
            name: c.name,
            address: c.address,
            lat: geo.lat,
            lon: geo.lon,
            source: geo.source,
          });
          setMarkers([...out]);
        }
        setProgress({ done: i + 1, total: eaCustomers.length });
        await new Promise((r) => setTimeout(r, 50));
      }
      if (!cancelled) {
        markersCache = out;
        setForceRefresh(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eaCustomers, refreshKey, forceRefresh]);

  const mappedIds = useMemo(() => new Set(markers.map((m) => m.id)), [markers]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return eaCustomers;
    const q = search.toLowerCase();
    return eaCustomers.filter((c) => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q));
  }, [eaCustomers, search]);

  const filteredMarkers = useMemo(() => {
    if (!search.trim()) return markers;
    const q = search.toLowerCase();
    return markers.filter((m) => m.name.toLowerCase().includes(q) || m.address.toLowerCase().includes(q));
  }, [markers, search]);

  const isGeocoding = progress.total > 0 && progress.done < progress.total;

  const handleSelectMarker = useCallback((m: CustomerMarker) => {
    setActiveFarm({ id: m.id, name: m.name });
  }, []);

  const handleSelectCustomer = useCallback((c: EACustomer) => {
    setActiveFarm({ id: c.id, name: c.name });
  }, []);

  const handleRefresh = useCallback(() => {
    setForceRefresh(true);
    setRefreshKey((k) => k + 1);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="chrysal-gradient h-1.5" />
        <div className="max-w-[1600px] mx-auto px-6 pt-8 space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-[560px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="chrysal-gradient h-1.5" />
      <div className="max-w-[1600px] mx-auto px-6">
        <header className="sticky top-0 z-10 backdrop-blur-sm py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                aria-label="Go to dashboard"
                className="rounded-xl px-3 py-2 flex items-center bg-card border border-border/50 shadow-sm shrink-0 hover:bg-accent/10 transition-colors cursor-pointer"
              >
                <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto max-w-none block shrink-0" />
              </button>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Customers — East Africa</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {eaCustomers.length} customers ·{" "}
                  {isGeocoding ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Locating {progress.done}/{progress.total}…
                    </span>
                  ) : (
                    `${markers.length} mapped`
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isGeocoding}
                className="gap-1.5"
                title="Re-geocode all customers and update the cloud cache"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isGeocoding ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <PageHeaderActions />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Map */}
          <div className="col-span-12 lg:col-span-9 bg-card rounded-xl shadow-card p-2">
            <CustomersMap markers={filteredMarkers} height={620} onSelect={handleSelectMarker} />
            <div className="flex items-center gap-4 px-3 py-2 text-xs text-muted-foreground">
              <LegendDot color="hsl(160, 60%, 40%)" label="Known farm" />
              <LegendDot color="hsl(210, 70%, 50%)" label="Geocoded address" />
              <LegendDot color="hsl(35, 85%, 55%)" label="City-level" />
            </div>
          </div>

          {/* Sidebar list */}
          <div className="col-span-12 lg:col-span-3 bg-card rounded-xl shadow-card p-4 flex flex-col">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {filteredCustomers.length} of {eaCustomers.length} shown
            </p>
            <div className="overflow-auto max-h-[560px] divide-y divide-border">
              {filteredCustomers.map((c) => {
                const mapped = mappedIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className="py-2.5 w-full text-left hover:bg-accent/5 px-2 -mx-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ background: mapped ? "hsl(160, 60%, 40%)" : "hsl(0, 0%, 70%)" }}
                        title={mapped ? "Mapped" : "Not mapped"}
                      />
                      <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5 ml-4">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                      <span>{c.address || <em className="opacity-60">No address</em>}</span>
                    </div>
                  </button>
                );
              })}
              {filteredCustomers.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No customers match.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ActivityDialog
        open={!!activeFarm}
        onOpenChange={(o) => { if (!o) setActiveFarm(null); }}
        farmId={activeFarm?.id || ""}
        farmName={activeFarm?.name || ""}
        activities={activities}
        users={users}
        analysis={null}
      />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full border border-white" style={{ background: color }} />
      {label}
    </span>
  );
}
