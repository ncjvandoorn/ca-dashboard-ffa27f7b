import { useState, useCallback, useRef, useMemo } from "react";
import { SharePageButton } from "@/components/SharePageButton";
import { ExceptionReportBody, type ExceptionAnalysis } from "@/components/dashboard/ExceptionReportBody";
import { Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { QualityReport, Account, Activity, ShipperReport, ShipperArrival, ServicesOrder, User } from "@/lib/csvParser";

interface ExceptionReportProps {
  reports: QualityReport[];
  accounts: Account[];
  activities?: Activity[];
  users?: User[];
  shipperReports?: ShipperReport[];
  shipperArrivals?: ShipperArrival[];
  servicesOrders?: ServicesOrder[];
  onSelectFarm: (farmId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideRefresh?: boolean;
  useSharedCache?: boolean;
}

const WINDOW = 12;
const ANALYSIS_VERSION = 3;
const NOTE_WEEKS_RECENT = 4;
const NOTE_WEEKS_PRIOR = 2;
const CRM_RECENT_DAYS = 120;
const CRM_MAX_PER_FARM = 8;
const SHIPPER_MAX_PER_FARM = 12;

function trimNote(note?: string | null, maxLen = 140): string | undefined {
  if (!note) return undefined;
  const cleaned = note.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length <= maxLen ? cleaned : `${cleaned.slice(0, maxLen - 1)}…`;
}

/** Week nr in YYWW format. Week 1 = the Sat–Fri week containing Jan 1. Weeks start Saturday. */
function getCurrentWeekNr(): number {
  const now = new Date();
  const daysSinceSat = (now.getDay() + 1) % 7; // Sat=0
  const currentSat = new Date(now);
  currentSat.setDate(now.getDate() - daysSinceSat);
  currentSat.setHours(0, 0, 0, 0);
  const jan1 = new Date(currentSat.getFullYear(), 0, 1);
  const jan1DaysSinceSat = (jan1.getDay() + 1) % 7;
  const week1Sat = new Date(jan1);
  week1Sat.setDate(jan1.getDate() - jan1DaysSinceSat);
  week1Sat.setHours(0, 0, 0, 0);
  const weekNum = Math.floor((currentSat.getTime() - week1Sat.getTime()) / (7 * 86400000)) + 1;
  const year = currentSat.getFullYear() % 100;
  return year * 100 + weekNum;
}

type AIAnalysis = ExceptionAnalysis;

interface WeekWindow {
  recentWeeks: number[];
  priorWeeks: number[];
  minWeek: number;
  maxWeek: number;
  cacheWeek: number;
}

function getWeekWindow(reports: QualityReport[]): WeekWindow {
  const currentWeek = getCurrentWeekNr();
  const uniqueWeeks = Array.from(new Set(reports.map((r) => r.weekNr).filter((w) => w > 0 && w <= currentWeek))).sort((a, b) => a - b);
  const recentWeeks = uniqueWeeks.slice(-WINDOW);
  const priorWeeks = uniqueWeeks.slice(Math.max(0, uniqueWeeks.length - WINDOW * 2), Math.max(0, uniqueWeeks.length - WINDOW));

  return {
    recentWeeks,
    priorWeeks,
    minWeek: recentWeeks[0] ?? 0,
    maxWeek: recentWeeks[recentWeeks.length - 1] ?? 0,
    cacheWeek: recentWeeks[recentWeeks.length - 1] ?? getCurrentWeekNr(),
  };
}

function trimNoteShort(note?: string | null, maxLen = 200): string | undefined {
  return trimNote(note, maxLen);
}

interface BuildContext {
  reports: QualityReport[];
  accounts: Account[];
  recentWeeks: number[];
  priorWeeks: number[];
  activities: Activity[];
  users: User[];
  shipperReports: ShipperReport[];
  shipperArrivals: ShipperArrival[];
  servicesOrders: ServicesOrder[];
}

function weekNrFromDate(ts: number | null | undefined): number | null {
  if (!ts) return null;
  const d = new Date(ts);
  const daysSinceSat = (d.getDay() + 1) % 7;
  const sat = new Date(d);
  sat.setDate(d.getDate() - daysSinceSat);
  sat.setHours(0, 0, 0, 0);
  const jan1 = new Date(sat.getFullYear(), 0, 1);
  const jan1DaysSinceSat = (jan1.getDay() + 1) % 7;
  const week1Sat = new Date(jan1);
  week1Sat.setDate(jan1.getDate() - jan1DaysSinceSat);
  week1Sat.setHours(0, 0, 0, 0);
  const wk = Math.floor((sat.getTime() - week1Sat.getTime()) / (7 * 86400000)) + 1;
  return (sat.getFullYear() % 100) * 100 + wk;
}

function buildFarmSummaries(ctx: BuildContext) {
  const { reports, accounts, recentWeeks, priorWeeks, activities, users, shipperReports, shipperArrivals, servicesOrders } = ctx;
  const recentSet = new Set(recentWeeks);
  const priorSet = new Set(priorWeeks);
  const recentNoteWeeks = new Set(recentWeeks.slice(-NOTE_WEEKS_RECENT));
  const priorNoteWeeks = new Set(priorWeeks.slice(-NOTE_WEEKS_PRIOR));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  // Index shipper events by farm via service orders.
  const ordersByFarm = new Map<string, ServicesOrder[]>();
  for (const o of servicesOrders) {
    if (!o.farmAccountId) continue;
    if (!ordersByFarm.has(o.farmAccountId)) ordersByFarm.set(o.farmAccountId, []);
    ordersByFarm.get(o.farmAccountId)!.push(o);
  }
  const shipperReportById = new Map(shipperReports.map((s) => [s.id, s]));
  const arrivalsByOrder = new Map<string, ShipperArrival[]>();
  for (const a of shipperArrivals) {
    if (!a.servicesOrderId) continue;
    if (!arrivalsByOrder.has(a.servicesOrderId)) arrivalsByOrder.set(a.servicesOrderId, []);
    arrivalsByOrder.get(a.servicesOrderId)!.push(a);
  }

  // Index recent CRM activities by farm.
  const cutoff = Date.now() - CRM_RECENT_DAYS * 86400000;
  const activitiesByFarm = new Map<string, Activity[]>();
  for (const a of activities) {
    if (!a.accountId) continue;
    const ts = a.startsAt ?? a.completedAt ?? a.createdAt ?? 0;
    if (!ts || ts < cutoff) continue;
    if (!activitiesByFarm.has(a.accountId)) activitiesByFarm.set(a.accountId, []);
    activitiesByFarm.get(a.accountId)!.push(a);
  }

  const recentByFarm = new Map<string, QualityReport[]>();
  const olderByFarm = new Map<string, QualityReport[]>();

  for (const r of reports) {
    if (r.weekNr <= 0) continue;
    if (recentSet.has(r.weekNr)) {
      if (!recentByFarm.has(r.farmAccountId)) recentByFarm.set(r.farmAccountId, []);
      recentByFarm.get(r.farmAccountId)!.push(r);
    } else if (priorSet.has(r.weekNr)) {
      if (!olderByFarm.has(r.farmAccountId)) olderByFarm.set(r.farmAccountId, []);
      olderByFarm.get(r.farmAccountId)!.push(r);
    }
  }

  const summaries: any[] = [];

  for (const [farmId, farmReports] of recentByFarm) {
    if (farmReports.length < 2) continue;

    const sorted = [...farmReports].sort((a, b) => a.weekNr - b.weekNr);
    const older = olderByFarm.get(farmId) || [];
    const olderSorted = [...older].sort((a, b) => a.weekNr - b.weekNr);

    // Use abbreviated keys to reduce payload size
    const extractWeekly = (reps: QualityReport[], noteWeeks: Set<number>) =>
      reps.map((r) => {
        const entry: Record<string, any> = {
          w: r.weekNr,
          iPh: r.qrIntakePh,
          iEc: r.qrIntakeEc,
          iT: r.qrIntakeTempColdstore,
          iH: r.qrIntakeHumidityColdstore,
          eT: r.qrExportTempColdstore,
          eH: r.qrExportHumidityColdstore,
          qR: r.qrGenQualityRating,
          wQ: r.qrIntakeWaterQuality,
          pS: r.qrPackProcessingSpeed,
        };

        if (noteWeeks.has(r.weekNr)) {
          const qualityNote = trimNote(r.qrGenQualityFlowers);
          const protocolNote = trimNote(r.qrGenProtocolChanges);
          const generalComment = trimNote(r.generalComment);
          if (qualityNote) entry.qN = qualityNote;
          if (protocolNote) entry.pN = protocolNote;
          if (generalComment) entry.gC = generalComment;
        }

        return entry;
      });

    // Build shipper events for this farm.
    const orders = ordersByFarm.get(farmId) || [];
    const shipperEvents: any[] = [];
    for (const o of orders) {
      const sr = o.shipperReportId ? shipperReportById.get(o.shipperReportId) : undefined;
      const stuffingTs = sr?.stuffingDate ?? o.dippingDate ?? null;
      const w = weekNrFromDate(stuffingTs ?? undefined) ?? 0;
      if (w > 0 && w < (recentWeeks[0] ?? 0)) continue;
      const arrivals = arrivalsByOrder.get(o.id) || [];
      const arr = arrivals.sort((a, b) => (b.arrivalDate ?? 0) - (a.arrivalDate ?? 0))[0];
      if (!sr && !arr) continue;
      const ev: Record<string, any> = { w };
      if (stuffingTs) ev.sd = new Date(stuffingTs).toISOString().slice(0, 10);
      if (sr?.loadingMin != null) ev.lm = sr.loadingMin;
      const stuffingComment = trimNoteShort(sr?.generalComments);
      if (stuffingComment) ev.gc = stuffingComment;
      if (arr?.arrivalDate) ev.ad = new Date(arr.arrivalDate).toISOString().slice(0, 10);
      if (arr?.dischargeWaitingMin != null) ev.dw = arr.dischargeWaitingMin;
      const aT = [arr?.arrivalTemp1, arr?.arrivalTemp2, arr?.arrivalTemp3].filter((v) => v != null);
      if (aT.length) ev.aT = aT;
      const vT = [arr?.afterVc1Temp, arr?.afterVc2Temp, arr?.afterVc3Temp].filter((v) => v != null);
      if (vT.length) ev.vT = vT;
      if (arr?.vcCycles != null) ev.vc = arr.vcCycles;
      if (arr?.vcDurationMin != null) ev.vd = arr.vcDurationMin;
      const arrivalComment = trimNoteShort(arr?.specificComments);
      if (arrivalComment) ev.ac = arrivalComment;
      shipperEvents.push(ev);
    }
    shipperEvents.sort((a, b) => (b.w ?? 0) - (a.w ?? 0));

    // Build recent CRM activities for this farm.
    const farmActs = (activitiesByFarm.get(farmId) || [])
      .sort((a, b) => (b.startsAt ?? b.completedAt ?? b.createdAt ?? 0) - (a.startsAt ?? a.completedAt ?? a.createdAt ?? 0))
      .slice(0, CRM_MAX_PER_FARM)
      .map((a) => {
        const ts = a.startsAt ?? a.completedAt ?? a.createdAt;
        const ev: Record<string, any> = {};
        if (ts) ev.d = new Date(ts).toISOString().slice(0, 10);
        if (a.type) ev.t = a.type;
        const subj = trimNoteShort(a.subject, 100);
        if (subj) ev.s = subj;
        const notes = trimNoteShort(a.description, 220);
        if (notes) ev.n = notes;
        const uname = a.assignedUserId ? userMap.get(a.assignedUserId) : null;
        if (uname) ev.u = uname;
        if (a.status) ev.st = a.status;
        return ev;
      });

    summaries.push({
      farmId,
      farmName: accountMap.get(farmId) || "Unknown",
      recentWeeks: extractWeekly(sorted, recentNoteWeeks),
      priorWeeks: extractWeekly(olderSorted.slice(-NOTE_WEEKS_PRIOR), priorNoteWeeks),
      shipperEvents: shipperEvents.slice(0, SHIPPER_MAX_PER_FARM),
      crmActivities: farmActs,
      reportCount: sorted.length,
    });
  }

  return summaries;
}

function scopeAnalysisToFarms(raw: any, allowedFarmIds: Set<string>) {
  if (!raw) return raw;

  const filterByFarm = (items: any) =>
    Array.isArray(items)
      ? items.filter((item) => item?.farmId && allowedFarmIds.has(item.farmId))
      : [];

  const needsAttention = filterByFarm(raw.needsAttention);
  const mostImproved = filterByFarm(raw.mostImproved);
  const topPerformers = filterByFarm(raw.topPerformers);
  const allFarmInsights = filterByFarm(raw.allFarmInsights);

  const removedScopedData =
    (Array.isArray(raw.needsAttention) && raw.needsAttention.length !== needsAttention.length) ||
    (Array.isArray(raw.mostImproved) && raw.mostImproved.length !== mostImproved.length) ||
    (Array.isArray(raw.topPerformers) && raw.topPerformers.length !== topPerformers.length) ||
    (Array.isArray(raw.allFarmInsights) && raw.allFarmInsights.length !== allFarmInsights.length);

  return {
    ...raw,
    needsAttention,
    mostImproved,
    topPerformers,
    allFarmInsights,
    industryInsight: removedScopedData
      ? "Analysis is scoped to the currently allowed farms only."
      : (raw.industryInsight || ""),
  };
}

export function ExceptionReport({
  reports,
  accounts,
  activities = [],
  users = [],
  shipperReports = [],
  shipperArrivals = [],
  servicesOrders = [],
  onSelectFarm,
  open,
  onOpenChange,
  hideRefresh,
  useSharedCache = true,
}: ExceptionReportProps) {
  const { isAdmin } = useAuth();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheWeekNr, setCacheWeekNr] = useState<number | null>(null);
  const weekWindow = useMemo(() => getWeekWindow(reports), [reports]);
  const allowedFarmIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);
  const isCustomerScope = !!hideRefresh; // only customers have hideRefresh=true
  const contentRef = useRef<HTMLDivElement>(null);

  /** Read the latest cached report (any week). Never generates. */
  const loadFromCache = useCallback(async (): Promise<boolean> => {
    if (!useSharedCache) return false;
    const { data: cached } = await supabase
      .from("exception_report_cache")
      .select("analysis, week_nr")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cachedAnalysis = cached?.analysis as Record<string, unknown> | undefined;
    if (cachedAnalysis) {
      const scopedCached = isCustomerScope ? scopeAnalysisToFarms(cachedAnalysis, allowedFarmIds) : cachedAnalysis;
      setAnalysis(scopedCached as AIAnalysis);
      setCacheWeekNr(cached?.week_nr ?? null);
      setFromCache(true);
      return true;
    }
    return false;
  }, [useSharedCache, isCustomerScope, allowedFarmIds]);

  /** Generate a fresh report. Admin-only — gated in the UI. */
  const runAnalysis = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setFromCache(false);

    const { minWeek, maxWeek, cacheWeek, recentWeeks, priorWeeks } = weekWindow;
    const shouldUseSharedCache = useSharedCache && allowedFarmIds.size > 0;

    try {
      if (recentWeeks.length < 2) {
        setError("No weekly report data available for the last 12 weeks.");
        return;
      }

      // Non-admin (or customer) must never generate — load latest cache instead.
      if (!isAdmin || hideRefresh) {
        const hit = await loadFromCache();
        if (!hit) setError("No cached analysis available yet. Please check back later.");
        return;
      }

      // Admin path: prefer this week's cache unless explicit refresh.
      if (shouldUseSharedCache && !forceRefresh) {
        const { data: cached } = await supabase
          .from("exception_report_cache")
          .select("analysis, week_nr")
          .eq("week_nr", cacheWeek)
          .maybeSingle();

        const cachedAnalysis = cached?.analysis as Record<string, unknown> | undefined;
        if (cachedAnalysis) {
          const scopedCached = isCustomerScope ? scopeAnalysisToFarms(cachedAnalysis, allowedFarmIds) : cachedAnalysis;
          setAnalysis(scopedCached as AIAnalysis);
          setCacheWeekNr(cached?.week_nr ?? cacheWeek);
          setFromCache(true);
          return;
        }
        // Fall through to: try latest cache from any prior week before generating.
        const latestHit = await loadFromCache();
        if (latestHit) return;
      }

      // No valid cache — run AI analysis for current scope (admin only)
      const farmSummaries = buildFarmSummaries({
        reports,
        accounts,
        recentWeeks,
        priorWeeks,
        activities,
        users,
        shipperReports,
        shipperArrivals,
        servicesOrders,
      });

      if (farmSummaries.length === 0) {
        setError("No farms with sufficient data in the last 12 weeks.");
        return;
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-exceptions`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          farmSummaries,
          weekRange: { min: minWeek, max: maxWeek },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis failed (${response.status})`);
      }

      const data = await response.json();
      if (data?.error) throw new Error(data.error);

      const versionedAnalysis = { ...(data as Record<string, unknown>), __v: ANALYSIS_VERSION };
      const scopedAnalysis = isCustomerScope ? scopeAnalysisToFarms(versionedAnalysis, allowedFarmIds) : versionedAnalysis;

      // Save to shared cache only for global/internal scope
      if (shouldUseSharedCache) {
        await supabase
          .from("exception_report_cache")
          .upsert({ week_nr: cacheWeek, analysis: versionedAnalysis }, { onConflict: "week_nr" });
      }

      setAnalysis(scopedAnalysis as AIAnalysis);
    } catch (e: any) {
      console.error("Exception analysis error:", e);
      const msg = e?.message || "Analysis failed";

      if (shouldUseSharedCache) {
        const hit = await loadFromCache();
        if (hit) {
          setError(null);
          toast({
            title: "Using cached report",
            description: "Live analysis failed, so the latest cached report was loaded.",
          });
          return;
        }
      }

      setError(msg);
      toast({
        title: "Analysis Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [reports, accounts, weekWindow, allowedFarmIds, useSharedCache, isAdmin, hideRefresh, isCustomerScope, loadFromCache]);

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    // Only auto-load on open if we don't already have an analysis loaded.
    // Non-admins: read latest cache (no generation). Admins: prefer cache, fall back to generation.
    if (isOpen && !analysis && !loading) {
      runAnalysis();
    }
  };

  const handleClick = (farmId: string) => {
    onSelectFarm(farmId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-0 shadow-card bg-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Exception Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <div ref={contentRef} className="p-2">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Exception Report
            </DialogTitle>
            {analysis && !loading && (
              <SharePageButton
                pageType="exception_report"
                getPayload={() => ({
                  analysis,
                  weekRange: { min: weekWindow.minWeek, max: weekWindow.maxWeek },
                })}
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Weeks {weekWindow.minWeek}–{weekWindow.maxWeek} · AI-powered post-harvest quality analysis
          </p>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing post-harvest quality data across all farms...</p>
            <p className="text-xs text-muted-foreground">Evaluating pH, EC, cold chain, humidity, treatments & more</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => runAnalysis()}>
              Retry Analysis
            </Button>
          </div>
        )}

        {analysis && !loading && (
          <>
            <ExceptionReportBody analysis={analysis} onSelectFarm={handleClick} />

            {/* Re-analyze / cache info */}
            <div className="mt-4 flex flex-col items-center gap-2">
              {fromCache && (
                <p className="text-xs text-muted-foreground">
                  Loaded from cache{cacheWeekNr ? ` · Week ${cacheWeekNr}` : ""}
                </p>
              )}
              {isAdmin && !hideRefresh && (
                <Button variant="outline" size="sm" onClick={() => runAnalysis(true)} className="gap-2 text-xs">
                  <RefreshCw className="h-3 w-3" />
                  {fromCache ? "Refresh Analysis (admin)" : "Re-analyze (admin)"}
                </Button>
              )}
            </div>
          </>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
