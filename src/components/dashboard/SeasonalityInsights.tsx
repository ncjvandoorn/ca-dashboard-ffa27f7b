import { useState, useCallback, useMemo, useRef } from "react";
import { SharePageButton } from "@/components/SharePageButton";
import { SeasonalityInsightsBody, type SeasonalityAnalysis } from "@/components/dashboard/SeasonalityInsightsBody";
import { CloudSun, Loader2, AlertCircle, RefreshCw } from "lucide-react";
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

interface SeasonalityInsightsProps {
  reports: QualityReport[];
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WINDOW = 12;

/** Week nr in YYWW format. Week 1 = the Sat–Fri week containing Jan 1. Weeks start Saturday. */
function getCurrentWeekNr(): number {
  const now = new Date();
  const daysSinceSat = (now.getDay() + 1) % 7;
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

function getSeasonalityWeekWindow(reports: QualityReport[]) {
  const currentWeek = getCurrentWeekNr();
  const uniqueWeeks = Array.from(new Set(reports.map((r) => r.weekNr).filter((w) => w > 0 && w <= currentWeek))).sort((a, b) => a - b);
  const recentWeeks = uniqueWeeks.slice(-WINDOW);
  return { weeks: new Set(recentWeeks), min: recentWeeks[0] ?? 0, max: recentWeeks[recentWeeks.length - 1] ?? 0 };
}

function buildAllFarmSummaries(reports: QualityReport[], accounts: Account[], weekSet: Set<number>) {
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const byFarm = new Map<string, QualityReport[]>();

  for (const r of reports) {
    if (weekSet.has(r.weekNr)) {
      if (!byFarm.has(r.farmAccountId)) byFarm.set(r.farmAccountId, []);
      byFarm.get(r.farmAccountId)!.push(r);
    }
  }

  const summaries: any[] = [];
  for (const [farmId, farmReports] of byFarm) {
    if (farmReports.length < 1) continue;
    const sorted = [...farmReports].sort((a, b) => a.weekNr - b.weekNr);
    summaries.push({
      farmId,
      farmName: accountMap.get(farmId) || "Unknown",
      weeks: sorted.map((r) => ({
        week: r.weekNr,
        qualityRating: r.qrGenQualityRating,
        qualityFlowersNote: r.qrGenQualityFlowers,
        protocolChangesNote: r.qrGenProtocolChanges,
        generalComment: r.generalComment,
        intakeTemp: r.qrIntakeTempColdstore,
        intakeHumidity: r.qrIntakeHumidityColdstore,
        exportTemp: r.qrExportTempColdstore,
        exportHumidity: r.qrExportHumidityColdstore,
        intakeWaterQuality: r.qrIntakeWaterQuality,
        exportWaterQuality: r.qrExportWaterQuality,
        intakePh: r.qrIntakePh,
        intakeEc: r.qrIntakeEc,
      })),
    });
  }
  return summaries;
}

export function SeasonalityInsights({ reports, accounts, open, onOpenChange }: SeasonalityInsightsProps) {
  const { isAdmin, isCustomer } = useAuth();
  const [analysis, setAnalysis] = useState<SeasonalityAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheWeekNr, setCacheWeekNr] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const weekWindow = useMemo(() => getSeasonalityWeekWindow(reports), [reports]);

  /** Read the latest cached seasonality report (any week). Never generates. */
  const loadFromCache = useCallback(async (): Promise<boolean> => {
    const { data: cached } = await (supabase as any)
      .from("seasonality_report_cache")
      .select("analysis, week_nr")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.analysis) {
      setAnalysis(cached.analysis as unknown as SeasonalityAnalysis);
      setCacheWeekNr(cached?.week_nr ?? null);
      setFromCache(true);
      return true;
    }
    return false;
  }, []);

  const runAnalysis = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setFromCache(false);

    const currentWeek = weekWindow.max || getCurrentWeekNr();

    try {
      // Non-admins: load latest cache only, never generate.
      if (!isAdmin) {
        const hit = await loadFromCache();
        if (!hit) setError("No cached analysis available yet. Please check back later.");
        return;
      }

      // Admin: prefer current-week cache unless explicit refresh.
      if (!forceRefresh) {
        const { data: cached } = await (supabase as any)
          .from("seasonality_report_cache")
          .select("analysis, week_nr")
          .eq("week_nr", currentWeek)
          .maybeSingle();

        if (cached?.analysis) {
          setAnalysis(cached.analysis as unknown as SeasonalityAnalysis);
          setCacheWeekNr(cached?.week_nr ?? currentWeek);
          setFromCache(true);
          setLoading(false);
          return;
        }

        // Fall back to latest cache before generating.
        const latestHit = await loadFromCache();
        if (latestHit) {
          setLoading(false);
          return;
        }
      }

      // No cache — run AI analysis (admin only)
      const farmSummaries = buildAllFarmSummaries(reports, accounts, weekWindow.weeks);
      if (farmSummaries.length === 0) {
        setError("No farms with data in the last 12 weeks.");
        setLoading(false);
        return;
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-seasonality`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ farmSummaries }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis failed (${response.status})`);
      }

      const data = await response.json();
      if (data?.error) throw new Error(data.error);

      // Save to cache
      await (supabase as any)
        .from("seasonality_report_cache")
        .upsert({ week_nr: currentWeek, analysis: data }, { onConflict: "week_nr" });

      setAnalysis(data as SeasonalityAnalysis);
      setCacheWeekNr(currentWeek);
    } catch (e: any) {
      console.error("Seasonality analysis error:", e);
      const msg = e?.message || "Analysis failed";
      // Try to fall back to any cached report so the UI isn't blank.
      const hit = await loadFromCache();
      if (hit) {
        toast({ title: "Using cached report", description: "Live analysis failed, showing the latest cached report." });
        return;
      }
      setError(msg);
      toast({ title: "Analysis Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [reports, accounts, weekWindow, isAdmin, loadFromCache]);

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !analysis && !loading) {
      runAnalysis();
    }
  };

  // chart computation lives inside SeasonalityInsightsBody now

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-0 shadow-card bg-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
        >
          <CloudSun className="h-4 w-4 text-primary" />
          Seasonality Insights
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <div ref={contentRef} className="p-2">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CloudSun className="h-5 w-5 text-primary" />
              Seasonality Insights
            </DialogTitle>
            {analysis && !loading && (
              <SharePageButton
                pageType="seasonality"
                getPayload={() => ({
                  analysis,
                  weekRange: { min: weekWindow.min, max: weekWindow.max },
                })}
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Weeks {weekWindow.min}–{weekWindow.max} · Weather & pest patterns from quality data
          </p>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing seasonal patterns across all farms...</p>
            <p className="text-xs text-muted-foreground">Interpreting staff observations, quality trends & environmental signals</p>
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
            <SeasonalityInsightsBody analysis={analysis} hideFarms={isCustomer} />

            {/* Refresh / cache info */}
            <div className="mt-4 flex flex-col items-center gap-2">
              {fromCache && (
                <p className="text-xs text-muted-foreground">
                  Loaded from cache{cacheWeekNr ? ` · Week ${cacheWeekNr}` : ""}
                </p>
              )}
              {isAdmin && (
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
