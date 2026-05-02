import { useState, useMemo, useEffect, useCallback } from "react";
import {
  MapPin, Sparkles, Loader2, RefreshCw, Route, AlertTriangle, Plus, X,
  ChevronLeft, ChevronRight, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  geocodeCustomer, preloadCloudCache, bestAddress, type GeoResult,
} from "@/lib/customerGeocode";
import { useUserCustomers, buildResponsibleResolver } from "@/lib/userCustomer";
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

// Module-level cache so switching tabs / unmounting+remounting the planner
// shows the previously-loaded AI plan instantly (no spinner) instead of
// re-querying the cache table each time. Manual "Reload AI plan" still
// fetches fresh.
const planCache: Record<number, { plan: WeeklyPlan; loadedAt: string }> = {};
// Cache computed routes per week so geocoding/route-building only runs once
// per session unless the underlying plan or selected users change.
const routesCache: Record<string, Record<string, PlannedFarm[]>> = {};

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
  source: "urgent" | "suggested" | "commercial" | "crm" | "coverage";
  visitScore?: number;
}

interface WeeklyPlan {
  urgentFarmVisits?: Array<{ farmId?: string; farmName: string; reason?: string; suggestedUser?: string; priority?: string }>;
  suggestedNewActivities?: Array<{ type?: string; farmName: string; reason?: string; suggestedUser?: string; priority?: string }>;
  commercialFollowups?: Array<{ farmName: string; customer?: string; trialNumber?: string; keyProduct?: string; reason?: string }>;
}

interface PlannedFarm extends PlanVisit {
  geo: GeoResult | null;
  day: string; // Mon..Fri
  order: number; // 1..N within the user
}

function normalizeName(s: string): string {
  return (s || "").trim().toLowerCase();
}

/* Approximate home-base coordinates per sales rep first name.
 * Trips start AND end at this base; visits are ordered as a loop. */
const USER_HOME_BASE: Record<string, { city: string; lat: number; lon: number }> = {
  paul:    { city: "Nairobi", lat: -1.2921, lon: 36.8219 },
  steven:  { city: "Nairobi", lat: -1.2921, lon: 36.8219 },
  steve:   { city: "Nairobi", lat: -1.2921, lon: 36.8219 },
  patrick: { city: "Nakuru",  lat: -0.3031, lon: 36.0800 },
  peter:   { city: "Nakuru",  lat: -0.3031, lon: 36.0800 },
};

function homeBaseFor(userName: string): { city: string; lat: number; lon: number } | null {
  const first = (userName || "").trim().toLowerCase().split(/\s+/)[0];
  return USER_HOME_BASE[first] || null;
}

/* Nearest-neighbor TSP loop: starts at `home`, visits all farms via
 * shortest next-hop, returns to `home`. Falls back to original order
 * when geo data is missing. If no home is provided, starts at the
 * farm closest to the centroid of the farm set. */
function nearestNeighborLoop<T extends { geo: GeoResult | null }>(
  items: T[],
  home: { lat: number; lon: number } | null,
): T[] {
  const withGeo = items.filter(i => i.geo);
  const without = items.filter(i => !i.geo);
  if (withGeo.length === 0) return without;

  const sqd = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const dLat = a.lat - b.lat; const dLon = a.lon - b.lon;
    return dLat * dLat + dLon * dLon;
  };

  // Anchor for first hop: home if known, otherwise centroid.
  const anchor = home ?? (() => {
    const lat = withGeo.reduce((s, x) => s + x.geo!.lat, 0) / withGeo.length;
    const lon = withGeo.reduce((s, x) => s + x.geo!.lon, 0) / withGeo.length;
    return { lat, lon };
  })();

  const visited = new Set<number>();
  const order: T[] = [];
  let current = anchor;
  while (visited.size < withGeo.length) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < withGeo.length; i++) {
      if (visited.has(i)) continue;
      const d = sqd(current, withGeo[i].geo!);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    visited.add(bestIdx);
    order.push(withGeo[bestIdx]);
    current = withGeo[bestIdx].geo!;
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

/* -------------------- Confirmation helpers -------------------- */

interface PlannerConfirmation {
  id: string;
  week_nr: number;
  user_id: string;
  farm_name: string;
  source: "ai" | "added";
  checked: boolean;
}

/** Saturday 00:00 → next Saturday 00:00 covering the YYWW week. */
function weekTimeBounds(wn: number): { start: number; end: number } {
  const sat = weekNrToSaturday(wn);
  const start = sat.getTime();
  const end = start + 7 * 86400000;
  return { start, end };
}

/** Did this farm receive ANY Visit-type activity (any status) inside the given YYWW week? */
function farmVisitedInWeek(farmName: string, accounts: Account[], activities: Activity[], wn: number): boolean {
  const target = normalizeName(farmName);
  if (!target) return false;
  const acc = accounts.find(a => normalizeName(a.name) === target);
  if (!acc) return false;
  const { start, end } = weekTimeBounds(wn);
  for (const a of activities) {
    if (a.accountId !== acc.id) continue;
    if ((a.type || "").toLowerCase() !== "visit") continue;
    const t = a.startsAt ?? a.completedAt ?? a.createdAt;
    if (!t) continue;
    if (t >= start && t < end) return true;
  }
  return false;
}

/* -------------------- Component -------------------- */

export function AIPlannerView({ allActivities, users, accounts, reports, activeUsers }: Props) {
  const selectedWeek = useMemo(() => getWeekNrForDate(new Date()), []);
  // Selection mirrors the parent-controlled active users list (the unified
  // "All Users" filter in the CRM toolbar). When the filter changes upstream,
  // we always reflect exactly that set — no stale single-user lock-in.
  const selectedUserIds = useMemo(() => activeUsers.map(u => u.id), [activeUsers]);
  const userSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);

  const initialCached = planCache[selectedWeek];
  const [plan, setPlan] = useState<WeeklyPlan | null>(initialCached?.plan ?? null);
  const [planLoadedAt, setPlanLoadedAt] = useState<string | null>(initialCached?.loadedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const routesKeyInit = `${selectedWeek}|${initialCached?.loadedAt || ""}|${[...activeUsers.map(u=>u.id)].sort().join(",")}`;
  const [routes, setRoutes] = useState<Record<string, PlannedFarm[]>>(() => routesCache[routesKeyInit] || {});
  const [computingRoutes, setComputingRoutes] = useState(false);

  // Confirmations: this week + all prior weeks (to compute carry-over misses).
  const [confirmations, setConfirmations] = useState<PlannerConfirmation[]>([]);
  const [, setConfLoaded] = useState(false);

  const loadConfirmations = useCallback(async () => {
    const { data, error } = await supabase
      .from("crm_planner_confirmations")
      .select("id, week_nr, user_id, farm_name, source, checked")
      .lte("week_nr", selectedWeek);
    if (error) {
      console.error("loadConfirmations error", error);
      return;
    }
    setConfirmations((data || []) as PlannerConfirmation[]);
    setConfLoaded(true);
  }, [selectedWeek]);

  useEffect(() => { loadConfirmations(); }, [loadConfirmations]);

  // Fast lookup for current-week confirmations.
  const confByKey = useMemo(() => {
    const m = new Map<string, PlannerConfirmation>();
    for (const c of confirmations) {
      if (c.week_nr !== selectedWeek) continue;
      m.set(`${c.user_id}|${normalizeName(c.farm_name)}`, c);
    }
    return m;
  }, [confirmations, selectedWeek]);

  // "Added" farms per user for this week (manually added during meeting).
  const addedByUser = useMemo(() => {
    const m = new Map<string, PlannerConfirmation[]>();
    for (const c of confirmations) {
      if (c.week_nr !== selectedWeek) continue;
      if (c.source !== "added") continue;
      const arr = m.get(c.user_id) || [];
      arr.push(c);
      m.set(c.user_id, arr);
    }
    return m;
  }, [confirmations, selectedWeek]);

  // Carry-over misses: confirmed (checked=true) farms in any prior week (< selectedWeek)
  // for which NO Visit-type activity exists in their committed week — and which
  // also haven't been visited in any week since.
  const carryOverByUser = useMemo(() => {
    const out = new Map<string, Array<{ farmName: string; weekNr: number; source: "ai" | "added" }>>();
    for (const c of confirmations) {
      if (c.week_nr >= selectedWeek) continue;
      if (!c.checked) continue;
      let visitedSince = false;
      for (let w = c.week_nr; w < selectedWeek; w++) {
        if (farmVisitedInWeek(c.farm_name, accounts, allActivities, w)) { visitedSince = true; break; }
      }
      if (visitedSince) continue;
      const arr = out.get(c.user_id) || [];
      if (!arr.some(x => normalizeName(x.farmName) === normalizeName(c.farm_name))) {
        arr.push({ farmName: c.farm_name, weekNr: c.week_nr, source: c.source });
      }
      out.set(c.user_id, arr);
    }
    for (const [, arr] of out) arr.sort((a, b) => a.weekNr - b.weekNr);
    return out;
  }, [confirmations, selectedWeek, accounts, allActivities]);

  /** Toggle / create a confirmation for the current week. */
  const toggleConfirmation = useCallback(async (
    userId: string,
    farmName: string,
    source: "ai" | "added",
    nextChecked: boolean,
  ) => {
    const key = `${userId}|${normalizeName(farmName)}`;
    const existing = confByKey.get(key);
    setConfirmations(prev => {
      const without = prev.filter(c => !(c.week_nr === selectedWeek && c.user_id === userId && normalizeName(c.farm_name) === normalizeName(farmName)));
      return [...without, {
        id: existing?.id ?? `temp-${Date.now()}`,
        week_nr: selectedWeek,
        user_id: userId,
        farm_name: farmName,
        source,
        checked: nextChecked,
      }];
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (existing && !existing.id.startsWith("temp-")) {
      const { error } = await supabase
        .from("crm_planner_confirmations")
        .update({ checked: nextChecked, source })
        .eq("id", existing.id);
      if (error) {
        toast({ title: "Could not save", description: error.message, variant: "destructive" });
        loadConfirmations();
      }
    } else {
      const { error } = await supabase
        .from("crm_planner_confirmations")
        .upsert({
          week_nr: selectedWeek,
          user_id: userId,
          farm_name: farmName,
          source,
          checked: nextChecked,
          created_by: user?.id ?? null,
        }, { onConflict: "week_nr,user_id,farm_name" });
      if (error) {
        toast({ title: "Could not save", description: error.message, variant: "destructive" });
      }
      loadConfirmations();
    }
  }, [confByKey, selectedWeek, loadConfirmations]);

  /** Remove an "added" farm entirely. */
  const removeAddedFarm = useCallback(async (userId: string, farmName: string) => {
    const key = `${userId}|${normalizeName(farmName)}`;
    const existing = confByKey.get(key);
    setConfirmations(prev => prev.filter(c => !(c.week_nr === selectedWeek && c.user_id === userId && normalizeName(c.farm_name) === normalizeName(farmName))));
    if (existing && !existing.id.startsWith("temp-")) {
      const { error } = await supabase
        .from("crm_planner_confirmations")
        .delete()
        .eq("id", existing.id);
      if (error) {
        toast({ title: "Could not remove", description: error.message, variant: "destructive" });
        loadConfirmations();
      }
    }
  }, [confByKey, selectedWeek, loadConfirmations]);

  const accountByName = useMemo(() => {
    const m = new Map<string, Account>();
    for (const a of accounts) m.set(normalizeName(a.name), a);
    return m;
  }, [accounts]);

  const accountById = useMemo(() => {
    const m = new Map<string, Account>();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  const userNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.name);
    for (const u of activeUsers) m.set(u.id, u.name);
    return m;
  }, [users, activeUsers]);

  const { data: userCustomerRows } = useUserCustomers();
  const resolveResponsible = useMemo(
    () => buildResponsibleResolver(userCustomerRows || []),
    [userCustomerRows],
  );

  // Load cached plan for the selected week. `forceSpinner` is true only on
  // explicit user-triggered reload — automatic loads keep the previously
  // displayed plan visible (no flash of the loading state).
  const loadPlan = useCallback(async (forceSpinner = false) => {
    if (forceSpinner || !planCache[selectedWeek]) setLoading(true);
    try {
      const { data } = await supabase
        .from("weekly_plan_cache")
        .select("analysis, created_at")
        .eq("week_nr", selectedWeek)
        .maybeSingle();
      if (data?.analysis) {
        const p = data.analysis as WeeklyPlan;
        planCache[selectedWeek] = { plan: p, loadedAt: data.created_at };
        setPlan(p);
        setPlanLoadedAt(data.created_at);
      } else if (forceSpinner) {
        setPlan(null);
        setPlanLoadedAt(null);
      }
    } catch (e) {
      console.error("AIPlanner: load plan error", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWeek]);

  useEffect(() => { loadPlan(false); }, [loadPlan]);

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

      // Commercial trial follow-ups — top priority sales opportunities.
      // These have no suggestedUser, so resolve via the per-farm/customer sales rep.
      for (const v of (plan.commercialFollowups || [])) {
        const rep = resolveResponsible(v.farmName) || resolveResponsible(v.customer) || "";
        const reasonParts = [
          v.trialNumber ? `Trial ${v.trialNumber}` : "",
          v.keyProduct ? `(${v.keyProduct})` : "",
          v.reason || "",
        ].filter(Boolean);
        allVisits.push({
          farmId: undefined,
          farmName: v.farmName,
          reason: reasonParts.join(" · ") || "Commercial trial follow-up",
          suggestedUser: rep,
          priority: "critical",
          source: "commercial",
          visitScore: 100,
        });
      }

      // Deterministic fallback: if the AI returns too few visits, fill the
      // Tuesday–Friday capacity from real CRM + quality data instead of leaving
      // the route almost empty. The AI still sets priorities; this only prevents
      // candidate farms from being skipped by an under-filled AI response.
      const recentByFarm = new Map<string, QualityReport[]>();
      for (const r of reports) {
        if (!r.farmAccountId) continue;
        const arr = recentByFarm.get(r.farmAccountId) || [];
        arr.push(r);
        recentByFarm.set(r.farmAccountId, arr);
      }
      for (const arr of recentByFarm.values()) arr.sort((a, b) => b.weekNr - a.weekNr);

      const openByFarm = new Map<string, Activity[]>();
      for (const a of allActivities) {
        if (!a.accountId || (a.status !== "To Do" && a.status !== "In Progress")) continue;
        const arr = openByFarm.get(a.accountId) || [];
        arr.push(a);
        openByFarm.set(a.accountId, arr);
      }

      const now = Date.now();
      for (const [farmId, openItems] of openByFarm.entries()) {
        const acc = accountById.get(farmId);
        if (!acc) continue;
        const oldest = openItems.reduce((max, a) => Math.max(max, a.createdAt ? Math.floor((now - a.createdAt) / 86400000) : 0), 0);
        const visitActivity = openItems.find((a) => (a.type || "").toLowerCase() === "visit") || openItems[0];
        const suggestedUser = userNameById.get(visitActivity.assignedUserId || visitActivity.ownerUserId) || "";
        allVisits.push({
          farmId,
          farmName: acc.name,
          reason: `${oldest >= 14 ? "Overdue" : "Open"} CRM item: ${visitActivity.subject || "follow-up"}`,
          suggestedUser,
          priority: oldest >= 14 ? "high" : "medium",
          source: "crm",
          visitScore: oldest >= 14 ? 70 + Math.min(oldest, 30) : 35 + Math.min(oldest, 20),
        });
      }

      for (const [farmId, farmReports] of recentByFarm.entries()) {
        if (openByFarm.has(farmId)) continue;
        const acc = accountById.get(farmId);
        if (!acc) continue;
        const latest = farmReports[0];
        const responsible = resolveResponsible(acc.name) || "";
        const hasStaffNote = Boolean(latest.qrGenQualityFlowers || latest.qrGenProtocolChanges || latest.generalComment);
        const badRating = (latest.qrGenQualityRating || 0) >= 2;
        const tempIssue = (latest.qrExportTempColdstore || 0) > 6 || (latest.qrIntakeTempColdstore || 0) > 6;
        const phIssue = (latest.qrIntakePh || 0) > 5.5 || (latest.qrExportPh || 0) > 5.5;
        if (!responsible || (!hasStaffNote && !badRating && !tempIssue && !phIssue)) continue;
        const reasons = [
          badRating ? `quality rating ${latest.qrGenQualityRating}` : "",
          tempIssue ? "temperature issue" : "",
          phIssue ? "pH issue" : "",
          hasStaffNote ? "staff note" : "",
        ].filter(Boolean);
        allVisits.push({
          farmId,
          farmName: acc.name,
          reason: `Coverage visit: latest week ${latest.weekNr} has ${reasons.join(", ")}`,
          suggestedUser: responsible,
          priority: badRating || tempIssue ? "high" : "medium",
          source: "coverage",
          visitScore: (badRating ? 60 : 0) + (tempIssue ? 45 : 0) + (phIssue ? 35 : 0) + (hasStaffNote ? 25 : 0),
        });
      }

      // Group by suggested user (only those in selectedUserIds).
      // Match tolerantly: exact, then first-name + last-name prefix
      // (handles "Steve Mbogo" in CSV vs "Steven Mbogo" in user list).
      const userByName = new Map<string, string>();
      for (const u of activeUsers) userByName.set(normalizeName(u.name), u.id);
      const resolveUserId = (name: string): string | undefined => {
        const n = normalizeName(name);
        if (!n) return undefined;
        if (userByName.has(n)) return userByName.get(n);
        const [firstA, ...restA] = n.split(/\s+/);
        const lastA = restA.join(" ");
        for (const [uname, uid] of userByName.entries()) {
          const [firstB, ...restB] = uname.split(/\s+/);
          const lastB = restB.join(" ");
          if (!lastA || !lastB) continue;
          if (lastA !== lastB) continue;
          // Same last name + one first name is a prefix of the other (min 3 chars)
          const minLen = Math.min(firstA.length, firstB.length);
          if (minLen >= 3 && firstA.slice(0, minLen) === firstB.slice(0, minLen)) {
            return uid;
          }
        }
        return undefined;
      };

      const byUserId = new Map<string, PlanVisit[]>();
      for (const v of allVisits) {
        const id = resolveUserId(v.suggestedUser);
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
        // Cap at 12 by priority/source/score, keeping commercial follow-ups first.
        const trimmed = [...visits]
          .sort((a, b) => {
            const pa = prioRank[a.priority?.toLowerCase()] ?? 9;
            const pb = prioRank[b.priority?.toLowerCase()] ?? 9;
            if (pa !== pb) return pa - pb;
            const sourceRank: Record<PlanVisit["source"], number> = { commercial: 0, urgent: 1, crm: 2, coverage: 3, suggested: 4 };
            if (a.source !== b.source) return sourceRank[a.source] - sourceRank[b.source];
            const sa = a.visitScore ?? 0;
            const sb = b.visitScore ?? 0;
            if (sa !== sb) return sb - sa;
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

        // Order by nearest-neighbor loop starting/ending at user's home base.
        const userName = activeUsers.find(u => u.id === uid)?.name || "";
        const home = homeBaseFor(userName);
        const ordered = nearestNeighborLoop(geocoded, home);

        // Distribute across Mon-Fri
        const days = distributeAcrossWeek(ordered.length);
        const planned: PlannedFarm[] = ordered.map((f, i) => ({
          ...f,
          day: days[i] || "Tue",
          order: i + 1,
        }));
        out[uid] = planned;
      }

      const key = `${selectedWeek}|${planLoadedAt || ""}|${[...userSet].sort().join(",")}`;
      routesCache[key] = out;
      setRoutes(out);
    } catch (e) {
      console.error("AIPlanner: buildRoutes error", e);
      toast({ title: "Failed to build routes", variant: "destructive" });
    } finally {
      setComputingRoutes(false);
    }
  }, [plan, planLoadedAt, selectedWeek, activeUsers, userSet, accountByName, accountById, userNameById, allActivities, reports, resolveResponsible]);

  // Auto-build routes when plan or selection changes — but skip the heavy
  // work (and the spinner) if we already have a cached result for this exact
  // (week + plan version + users) combination.
  useEffect(() => {
    if (!plan) return;
    const key = `${selectedWeek}|${planLoadedAt || ""}|${[...userSet].sort().join(",")}`;
    const cached = routesCache[key];
    if (cached) {
      setRoutes(cached);
      return;
    }
    buildRoutes();
  }, [plan, planLoadedAt, selectedWeek, userSet, buildRoutes]);

  // Refresh = trigger AI to regenerate the weekly plan for the selected week,
  // then reload from cache. Reuses analyze-weekly-plan via ComingWeekView's
  // edge function. To avoid duplicating the heavy payload-build, we just call
  // the function with a minimal hint and rely on the user using "Current Week"
  // for full regeneration. Here we offer a soft-refresh that re-reads cache.
  const refreshFromCache = useCallback(() => {
    loadPlan(true);
    toast({ title: "Reloaded latest AI plan from cache" });
  }, [loadPlan]);

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
            const home = homeBaseFor(u.name);
            return (
              <div key={u.id} className="rounded-lg border border-border bg-background overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-muted/30 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{u.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{visits.length} visit{visits.length === 1 ? "" : "s"}</Badge>
                    {home && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <MapPin className="h-2.5 w-2.5" /> Base: {home.city}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Route className="h-3.5 w-3.5" />
                    {home ? `Loop from ${home.city}` : "Shortest path"} · {geocodedCount}/{visits.length} geocoded
                  </div>
                </div>

                {/* Carry-over misses (top priority — must visit) */}
                {(carryOverByUser.get(u.id)?.length || 0) > 0 && (
                  <div className="px-3 pt-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive uppercase tracking-wide">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Top priority — committed but not visited
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {(carryOverByUser.get(u.id) || []).map(m => (
                        <div
                          key={`miss-${m.farmName}-${m.weekNr}`}
                          className="rounded-md border-2 border-destructive bg-destructive/10 px-2.5 py-2 text-[11px] shadow-[0_0_0_1px_hsl(var(--destructive)/0.4)]"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{m.farmName}</div>
                              <div className="text-[10px] text-destructive/80">
                                Promised week {m.weekNr} · still no Visit recorded
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {visits.length === 0 && (addedByUser.get(u.id)?.length || 0) === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground italic">
                    No AI-suggested visits this week.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-border">
                    <div className="bg-background p-2 min-h-[140px]">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">Mon</div>
                      <div className="text-[11px] text-muted-foreground/70 italic">Office day</div>
                    </div>
                    {DAY_LABELS.map(day => {
                      const items = byDay.get(day)!;
                      return (
                        <div key={day} className="bg-background p-2 min-h-[140px]">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">{day}</div>
                          <div className="space-y-1.5">
                            {items.length === 0 && <div className="text-[11px] text-muted-foreground/60 italic">—</div>}
                            {items.map(v => {
                              const cKey = `${u.id}|${normalizeName(v.farmName)}`;
                              const conf = confByKey.get(cKey);
                              const isChecked = !!conf?.checked;
                              return (
                              <div
                                key={`${v.farmName}-${v.order}`}
                                className={`rounded border px-2 py-1.5 text-[11px] ${
                                  isChecked ? "ring-1 ring-primary/40 " : ""
                                }${
                                  v.source === "urgent"
                                    ? "border-destructive/40 bg-destructive/5"
                                    : v.source === "commercial"
                                    ? "border-amber-500/40 bg-amber-500/10"
                                    : v.source === "crm"
                                    ? "border-accent/40 bg-accent/10"
                                    : v.source === "coverage"
                                    ? "border-secondary/40 bg-secondary/20"
                                    : "border-primary/30 bg-primary/5"
                                }`}
                                title={v.reason}
                              >
                                <div className="flex items-start gap-1.5">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(val) => toggleConfirmation(u.id, v.farmName, "ai", val === true)}
                                    className="mt-0.5"
                                    aria-label={`Confirm visit to ${v.farmName}`}
                                  />
                                  <span className="font-mono text-[10px] text-muted-foreground">#{v.order}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{v.farmName}</div>
                                    <div className="text-[10px] text-muted-foreground line-clamp-2">{v.reason}</div>
                                  </div>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Manually added farms for this week */}
                <AddedFarmsRow
                  userId={u.id}
                  added={addedByUser.get(u.id) || []}
                  accounts={accounts}
                  onAdd={(farmName) => toggleConfirmation(u.id, farmName, "added", true)}
                  onRemove={(farmName) => removeAddedFarm(u.id, farmName)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------- Added farms row -------------------- */

interface AddedFarmsRowProps {
  userId: string;
  added: PlannerConfirmation[];
  accounts: Account[];
  onAdd: (farmName: string) => void;
  onRemove: (farmName: string) => void;
}

function AddedFarmsRow({ added, accounts, onAdd, onRemove }: AddedFarmsRowProps) {
  const [open, setOpen] = useState(false);
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );
  const addedSet = useMemo(
    () => new Set(added.map(a => normalizeName(a.farm_name))),
    [added],
  );
  return (
    <div className="border-t border-border bg-muted/20 px-3 py-2 flex items-center gap-2 flex-wrap">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        Added this week
      </span>
      {added.map(a => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 pl-2 pr-1 py-0.5 text-[11px]"
        >
          {a.farm_name}
          <button
            type="button"
            onClick={() => onRemove(a.farm_name)}
            className="rounded-full hover:bg-destructive/20 p-0.5"
            aria-label={`Remove ${a.farm_name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]">
            <Plus className="h-3 w-3" /> Add farm
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[280px]" align="start">
          <Command>
            <CommandInput placeholder="Search farm…" className="h-9" />
            <CommandList>
              <CommandEmpty>No farm found.</CommandEmpty>
              <CommandGroup>
                {sortedAccounts.map(acc => {
                  const already = addedSet.has(normalizeName(acc.name));
                  return (
                    <CommandItem
                      key={acc.id}
                      value={acc.name}
                      disabled={already}
                      onSelect={() => {
                        if (already) return;
                        onAdd(acc.name);
                        setOpen(false);
                      }}
                    >
                      {acc.name}
                      {already && <span className="ml-auto text-[10px] text-muted-foreground">added</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
