import { useState, useMemo, useEffect, useCallback } from "react";
import {
  MapPin, Sparkles, Loader2, RefreshCw,
  Filter, Check, Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  geocodeCustomer, preloadCloudCache, bestAddress, type GeoResult,
} from "@/lib/customerGeocode";
import type { Activity, User, Account, QualityReport } from "@/lib/csvParser";

interface Props {
  allActivities: Activity[];
  users: User[];
  accounts: Account[];
  reports: QualityReport[];
  activeUsers: { id: string; name: string }[];
}

const DAY_LABELS = ["Tue", "Wed", "Thu", "Fri"];
const MAX_VISITS_PER_WEEK = 12;
const MAX_VISITS_PER_DAY = 3;

/* -------------------- Week helpers (YYWW, Sat-Fri) -------------------- */

function getWeekNrForDate(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const daysSinceSat = (d.getDay() + 1) % 7;
  const currentSat = new Date(d);
  currentSat.setDate(d.getDate() - daysSinceSat);
  const jan1 = new Date(currentSat.getFullYear(), 0, 1);
  const jan1DaysSinceSat = (jan1.getDay() + 1) % 7;
  const week1Sat = new Date(jan1);
  week1Sat.setDate(jan1.getDate() - jan1DaysSinceSat);
  const weekNum = Math.floor((currentSat.getTime() - week1Sat.getTime()) / (7 * 86400000)) + 1;
  return (currentSat.getFullYear() % 100) * 100 + weekNum;
}

function weekNrToSaturday(wn: number): Date {
  const year = 2000 + Math.floor(wn / 100);
  const week = wn % 100;
  const jan1 = new Date(year, 0, 1);
  const jan1DaysSinceSat = (jan1.getDay() + 1) % 7;
  const week1Sat = new Date(jan1);
  week1Sat.setDate(jan1.getDate() - jan1DaysSinceSat);
  week1Sat.setHours(0, 0, 0, 0);
  const targetSat = new Date(week1Sat);
  targetSat.setDate(week1Sat.getDate() + (week - 1) * 7);
  return targetSat;
}

function weekDateRange(wn: number): string {
  const sat = weekNrToSaturday(wn);
  const monday = new Date(sat); monday.setDate(sat.getDate() + 2);
  const friday = new Date(sat); friday.setDate(sat.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${fmt(monday)} – ${fmt(friday)} ${friday.getFullYear()}`;
}

function shiftWeek(wn: number, delta: number): number {
  let year = Math.floor(wn / 100);
  let week = (wn % 100) + delta;
  while (week < 1) { year -= 1; week += 52; }
  while (week > 52) { year += 1; week -= 52; }
  return year * 100 + week;
}

/* -------------------- Plan-shape helpers -------------------- */

interface PlanVisit {
  farmId?: string;
  farmName: string;
  reason: string;
  suggestedUser: string;
  priority: string;
  source: "urgent" | "suggested";
}

interface PlannedFarm extends PlanVisit {
  geo: GeoResult | null;
  day: string; // Mon..Fri
  order: number; // 1..N within the user
}

function normalizeName(s: string): string {
  return (s || "").trim().toLowerCase();
}

/* Nearest-neighbor TSP starting from the geographic centroid's nearest farm.
 * Falls back to original order when geo data is missing. */
function nearestNeighborOrder<T extends { geo: GeoResult | null }>(items: T[]): T[] {
  const withGeo = items.filter(i => i.geo);
  const without = items.filter(i => !i.geo);
  if (withGeo.length <= 1) return [...withGeo, ...without];

  // Start from the northernmost farm (highest lat) — gives stable predictable ordering.
  let startIdx = 0;
  for (let i = 1; i < withGeo.length; i++) {
    if ((withGeo[i].geo!.lat) > (withGeo[startIdx].geo!.lat)) startIdx = i;
  }

  const visited = new Set<number>([startIdx]);
  const order: T[] = [withGeo[startIdx]];
  while (visited.size < withGeo.length) {
    const last = order[order.length - 1].geo!;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < withGeo.length; i++) {
      if (visited.has(i)) continue;
      const g = withGeo[i].geo!;
      const dLat = g.lat - last.lat;
      const dLon = g.lon - last.lon;
      const d = dLat * dLat + dLon * dLon;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    visited.add(bestIdx);
    order.push(withGeo[bestIdx]);
  }
  return [...order, ...without];
}

/* Spread N visits across Mon..Fri as evenly as possible (front-loaded). */
function distributeAcrossWeek(n: number): string[] {
  if (n === 0) return [];
  const days: string[] = [];
  const numDays = DAY_LABELS.length;
  const capped = Math.min(n, numDays * MAX_VISITS_PER_DAY);
  const base = Math.floor(capped / numDays);
  const extra = capped % numDays;
  const counts = DAY_LABELS.map((_, i) => Math.min(MAX_VISITS_PER_DAY, base + (i < extra ? 1 : 0)));
  counts.forEach((c, i) => {
    for (let k = 0; k < c; k++) days.push(DAY_LABELS[i]);
  });
  return days;
}

/* -------------------- Component -------------------- */

export function AIPlannerView({ accounts, activeUsers }: Props) {
  const selectedWeek = useMemo(() => getWeekNrForDate(new Date()), []);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => activeUsers.map(u => u.id));
  // Keep selection in sync with the preselected users from settings.
  useEffect(() => {
    setSelectedUserIds((prev) => {
      const active = new Set(activeUsers.map(u => u.id));
      const filtered = prev.filter(id => active.has(id));
      // If nothing valid is selected (e.g. first load), default to all active.
      return filtered.length === 0 ? activeUsers.map(u => u.id) : filtered;
    });
  }, [activeUsers]);
  const userSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);

  const [plan, setPlan] = useState<any | null>(null);
  const [planLoadedAt, setPlanLoadedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [routes, setRoutes] = useState<Record<string, PlannedFarm[]>>({});
  const [computingRoutes, setComputingRoutes] = useState(false);

  const accountByName = useMemo(() => {
    const m = new Map<string, Account>();
    for (const a of accounts) m.set(normalizeName(a.name), a);
    return m;
  }, [accounts]);

  // Load cached plan for the selected week
  const loadPlan = useCallback(async () => {
    setLoading(true);
    setPlan(null);
    setRoutes({});
    try {
      const { data } = await supabase
        .from("weekly_plan_cache")
        .select("analysis, created_at")
        .eq("week_nr", selectedWeek)
        .maybeSingle();
      if (data?.analysis) {
        setPlan(data.analysis);
        setPlanLoadedAt(data.created_at);
      } else {
        setPlanLoadedAt(null);
      }
    } catch (e) {
      console.error("AIPlanner: load plan error", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWeek]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // Build visit proposals per selected user, then geocode + order
  const buildRoutes = useCallback(async () => {
    if (!plan) return;
    setComputingRoutes(true);
    try {
      await preloadCloudCache();

      // Collect all "visit" proposals: urgentFarmVisits (always Visit) +
      // suggestedNewActivities filtered to type=Visit.
      const allVisits: PlanVisit[] = [];
      for (const v of (plan.urgentFarmVisits || [])) {
        allVisits.push({
          farmId: v.farmId,
          farmName: v.farmName,
          reason: v.reason || "",
          suggestedUser: v.suggestedUser || "",
          priority: v.priority || "high",
          source: "urgent",
        });
      }
      for (const v of (plan.suggestedNewActivities || [])) {
        if ((v.type || "").toLowerCase() !== "visit") continue;
        allVisits.push({
          farmId: undefined,
          farmName: v.farmName,
          reason: v.reason || "",
          suggestedUser: v.suggestedUser || "",
          priority: v.priority || "medium",
          source: "suggested",
        });
      }

      // Group by suggested user (only those in selectedUserIds)
      const userById = new Map(activeUsers.map(u => [u.id, u]));
      const userByName = new Map<string, string>(); // lowercase name -> id
      for (const u of activeUsers) userByName.set(normalizeName(u.name), u.id);

      const byUserId = new Map<string, PlanVisit[]>();
      for (const v of allVisits) {
        const id = userByName.get(normalizeName(v.suggestedUser));
        if (!id || !userSet.has(id)) continue;
        if (!byUserId.has(id)) byUserId.set(id, []);
        // Prevent same-farm duplicates per user
        const arr = byUserId.get(id)!;
        if (!arr.some(x => normalizeName(x.farmName) === normalizeName(v.farmName))) {
          arr.push(v);
        }
      }

      // Priority order helper
      const prioRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

      const out: Record<string, PlannedFarm[]> = {};

      for (const [uid, visits] of byUserId.entries()) {
        // Cap at 10 by priority then source (urgent first)
        const trimmed = [...visits]
          .sort((a, b) => {
            const pa = prioRank[a.priority?.toLowerCase()] ?? 9;
            const pb = prioRank[b.priority?.toLowerCase()] ?? 9;
            if (pa !== pb) return pa - pb;
            if (a.source !== b.source) return a.source === "urgent" ? -1 : 1;
            return 0;
          })
          .slice(0, MAX_VISITS_PER_WEEK);

        // Geocode each farm
        const geocoded = await Promise.all(trimmed.map(async (v) => {
          const acc = accountByName.get(normalizeName(v.farmName));
          let geo: GeoResult | null = null;
          if (acc) {
            const addr = bestAddress(acc.deliveryAddress, acc.mainAddress);
            try { geo = await geocodeCustomer(acc.name, addr); } catch { geo = null; }
          }
          return { ...v, geo };
        }));

        // Order by nearest-neighbor (shortest path between farms)
        const ordered = nearestNeighborOrder(geocoded);

        // Distribute across Mon-Fri
        const days = distributeAcrossWeek(ordered.length);
        const planned: PlannedFarm[] = ordered.map((f, i) => ({
          ...f,
          day: days[i] || "Mon",
          order: i + 1,
        }));
        out[uid] = planned;
      }

      setRoutes(out);
    } catch (e) {
      console.error("AIPlanner: buildRoutes error", e);
      toast({ title: "Failed to build routes", variant: "destructive" });
    } finally {
      setComputingRoutes(false);
    }
  }, [plan, activeUsers, userSet, accountByName]);

  // Auto-build routes when plan changes
  useEffect(() => { if (plan) buildRoutes(); }, [plan, buildRoutes]);

  // Refresh = trigger AI to regenerate the weekly plan for the selected week,
  // then reload from cache. Reuses analyze-weekly-plan via ComingWeekView's
  // edge function. To avoid duplicating the heavy payload-build, we just call
  // the function with a minimal hint and rely on the user using "Current Week"
  // for full regeneration. Here we offer a soft-refresh that re-reads cache.
  const refreshFromCache = useCallback(() => {
    loadPlan();
    toast({ title: "Reloaded latest AI plan from cache" });
  }, [loadPlan]);

  const allUsersSelected = selectedUserIds.length === activeUsers.length;

  const usersToShow = useMemo(
    () => activeUsers.filter(u => userSet.has(u.id)),
    [activeUsers, userSet],
  );

  const totalVisits = useMemo(
    () => Object.values(routes).reduce((sum, arr) => sum + arr.length, 0),
    [routes],
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm font-semibold">
          Week {selectedWeek} <span className="text-muted-foreground font-normal">· {weekDateRange(selectedWeek)}</span>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Filter className="h-4 w-4" />
              Users ({selectedUserIds.length}/{activeUsers.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border mb-1">
              <span className="text-xs font-medium">Filter users</span>
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setSelectedUserIds(allUsersSelected ? [] : activeUsers.map(u => u.id))}
              >
                {allUsersSelected ? "Clear" : "All"}
              </button>
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-0.5 pr-2">
                {activeUsers.map(u => {
                  const checked = userSet.has(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left text-sm"
                    >
                      <div className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary" : "border-border"}`}>
                        {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="truncate">{u.name}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline" size="sm" className="h-8 gap-1.5"
          onClick={refreshFromCache}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Reload AI plan
        </Button>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {planLoadedAt && (
            <span>AI plan from {new Date(planLoadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          )}
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <MapPin className="h-3 w-3 mr-1" /> {totalVisits} visits planned
          </Badge>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading AI plan…
        </div>
      ) : !plan ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center space-y-3">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
          <div className="text-sm font-medium">No AI plan cached for week {selectedWeek}</div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Open the <b>Current Week</b> page and click <b>Generate / Refresh</b> to build the AI plan,
            then come back here. The AI Planner reuses the same plan to propose visit routes per user.
          </p>
        </div>
      ) : computingRoutes ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Computing visit routes…
        </div>
      ) : usersToShow.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Select one or more users to see their proposed visit routes.
        </div>
      ) : (
        <div className="space-y-4">
          {usersToShow.map(u => {
            const visits = routes[u.id] || [];
            const byDay = new Map<string, PlannedFarm[]>();
            for (const d of DAY_LABELS) byDay.set(d, []);
            for (const v of visits) byDay.get(v.day)!.push(v);
            const geocodedCount = visits.filter(v => v.geo).length;
            return (
              <div key={u.id} className="rounded-lg border border-border bg-background overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-muted/30 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{u.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{visits.length} visit{visits.length === 1 ? "" : "s"}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Route className="h-3.5 w-3.5" />
                    Ordered by shortest path · {geocodedCount}/{visits.length} geocoded
                  </div>
                </div>

                {visits.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground italic">
                    No AI-suggested visits this week.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-border">
                    {DAY_LABELS.map(day => {
                      const items = byDay.get(day)!;
                      return (
                        <div key={day} className="bg-background p-2 min-h-[140px]">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">{day}</div>
                          <div className="space-y-1.5">
                            {items.length === 0 && <div className="text-[11px] text-muted-foreground/60 italic">—</div>}
                            {items.map(v => (
                              <div
                                key={`${v.farmName}-${v.order}`}
                                className={`rounded border px-2 py-1.5 text-[11px] ${
                                  v.source === "urgent"
                                    ? "border-destructive/40 bg-destructive/5"
                                    : "border-primary/30 bg-primary/5"
                                }`}
                                title={v.reason}
                              >
                                <div className="flex items-start gap-1">
                                  <span className="font-mono text-[10px] text-muted-foreground">#{v.order}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{v.farmName}</div>
                                    <div className="text-[10px] text-muted-foreground line-clamp-2">{v.reason}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
