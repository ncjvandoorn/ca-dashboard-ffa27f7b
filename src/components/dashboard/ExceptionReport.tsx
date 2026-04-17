import { useState, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { ExportPdfButton } from "@/components/dashboard/ExportPdfButton";
import { AlertTriangle, TrendingUp, TrendingDown, ArrowRight, Sparkles, Loader2, AlertCircle, Info, RefreshCw } from "lucide-react";
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
import type { QualityReport, Account } from "@/lib/csvParser";

interface ExceptionReportProps {
  reports: QualityReport[];
  accounts: Account[];
  onSelectFarm: (farmId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideRefresh?: boolean;
  useSharedCache?: boolean;
}

const WINDOW = 12;
const ANALYSIS_VERSION = 2;
const NOTE_WEEKS_RECENT = 4;
const NOTE_WEEKS_PRIOR = 2;

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

interface AttentionFarm {
  farmId: string;
  farmName: string;
  severity: "critical" | "warning";
  summary: string;
  details: string[];
  affectedMetrics: string[];
}

interface ImprovedFarm {
  farmId: string;
  farmName: string;
  summary: string;
  details: string[];
  improvedMetrics: string[];
}

interface TopPerformerFarm {
  farmId: string;
  farmName: string;
  summary: string;
  details: string[];
  strongMetrics: string[];
}

interface AIAnalysis {
  needsAttention: AttentionFarm[];
  mostImproved: ImprovedFarm[];
  topPerformers?: TopPerformerFarm[];
  industryInsight: string;
}

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

function buildFarmSummaries(reports: QualityReport[], accounts: Account[], recentWeeks: number[], priorWeeks: number[]) {
  const recentSet = new Set(recentWeeks);
  const priorSet = new Set(priorWeeks);
  const recentNoteWeeks = new Set(recentWeeks.slice(-NOTE_WEEKS_RECENT));
  const priorNoteWeeks = new Set(priorWeeks.slice(-NOTE_WEEKS_PRIOR));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

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

    summaries.push({
      farmId,
      farmName: accountMap.get(farmId) || "Unknown",
      recentWeeks: extractWeekly(sorted, recentNoteWeeks),
      priorWeeks: extractWeekly(olderSorted.slice(-NOTE_WEEKS_PRIOR), priorNoteWeeks),
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
      const farmSummaries = buildFarmSummaries(reports, accounts, recentWeeks, priorWeeks);

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
        const { data: latestCached } = await supabase
          .from("exception_report_cache")
          .select("analysis")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const latestAnalysis = latestCached?.analysis as { __v?: number } | undefined;
        if (latestAnalysis && latestAnalysis.__v === ANALYSIS_VERSION) {
          const scopedLatest = isCustomerScope ? scopeAnalysisToFarms(latestAnalysis, allowedFarmIds) : latestAnalysis;
          setAnalysis(scopedLatest as AIAnalysis);
          setFromCache(true);
          setError(null);
          toast({
            title: "Using cached report",
            description: "Live analysis timed out, so the latest cached report was loaded.",
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
  }, [reports, accounts, weekWindow, allowedFarmIds, useSharedCache]);

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
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
              <ExportPdfButton targetRef={contentRef} filename="exception-report" size="sm" />
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
            {/* Industry insight */}
            {analysis.industryInsight && (
              <div className="chrysal-gradient-subtle rounded-lg p-4 mt-2 flex gap-3">
                <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-foreground leading-relaxed space-y-2">
                  {analysis.industryInsight.split(/\n\n?/).filter(Boolean).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Needs Attention */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Needs Attention
                </h3>
              </div>
              <div className="space-y-2">
                {analysis.needsAttention.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No farms flagged — all within acceptable ranges</p>
                ) : (
                  analysis.needsAttention.map((farm, i) => (
                    <motion.button
                      key={farm.farmId}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      onClick={() => handleClick(farm.farmId)}
                      className="w-full flex items-start gap-4 p-4 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors duration-150 text-left group"
                    >
                      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        farm.severity === "critical"
                          ? "bg-destructive/20 text-destructive"
                          : "bg-warning/20 text-warning"
                      }`}>
                        {farm.severity === "critical" ? "!" : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate group-hover:text-destructive transition-colors">
                          {farm.farmName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{farm.summary}</p>
                        <div className="mt-2 space-y-0.5">
                          {farm.details.map((d, j) => (
                            <p key={j} className="text-[11px] text-muted-foreground">• {d}</p>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {farm.affectedMetrics.map((m) => (
                            <span key={m} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              farm.severity === "critical"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-warning/10 text-warning"
                            }`}>
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-destructive flex-shrink-0 transition-colors mt-1" />
                    </motion.button>
                  ))
                )}
              </div>
            </div>

            {/* Most Improved */}
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Most Improved
                </h3>
              </div>
              <div className="space-y-2">
                {analysis.mostImproved.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No significant improvements detected in the analysis window</p>
                ) : (
                  analysis.mostImproved.map((farm, i) => (
                    <motion.button
                      key={farm.farmId}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 + 0.25, duration: 0.2 }}
                      onClick={() => handleClick(farm.farmId)}
                      className="w-full flex items-start gap-4 p-4 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors duration-150 text-left group"
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate group-hover:text-accent transition-colors">
                          {farm.farmName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{farm.summary}</p>
                        <div className="mt-2 space-y-0.5">
                          {farm.details.map((d, j) => (
                            <p key={j} className="text-[11px] text-muted-foreground">• {d}</p>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {farm.improvedMetrics.map((m) => (
                            <span key={m} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent flex-shrink-0 transition-colors mt-1" />
                    </motion.button>
                  ))
                )}
              </div>
            </div>

            {/* Top Performers */}
            {analysis.topPerformers && analysis.topPerformers.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Top Performers
                  </h3>
                </div>
                <div className="space-y-2">
                  {analysis.topPerformers.map((farm, i) => (
                    <motion.button
                      key={farm.farmId}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 + 0.5, duration: 0.2 }}
                      onClick={() => handleClick(farm.farmId)}
                      className="w-full flex items-start gap-4 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors duration-150 text-left group"
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {farm.farmName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{farm.summary}</p>
                        <div className="mt-2 space-y-0.5">
                          {farm.details.map((d, j) => (
                            <p key={j} className="text-[11px] text-muted-foreground">• {d}</p>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {farm.strongMetrics.map((m) => (
                            <span key={m} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors mt-1" />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Re-analyze / cache info */}
            <div className="mt-4 flex flex-col items-center gap-2">
              {fromCache && (
                <p className="text-xs text-muted-foreground">
                  Loaded from cache · Generated this week
                </p>
              )}
              {!hideRefresh && (
                <Button variant="outline" size="sm" onClick={() => runAnalysis(true)} className="gap-2 text-xs">
                  <RefreshCw className="h-3 w-3" />
                  {fromCache ? "Refresh Analysis" : "Re-analyze"}
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
