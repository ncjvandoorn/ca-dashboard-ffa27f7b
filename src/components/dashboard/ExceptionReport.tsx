import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, TrendingDown, ArrowRight, Sparkles, Loader2, AlertCircle, Info, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
}

const CURRENT_WEEK = 2612;
const WINDOW = 10;
const MIN_WEEK = CURRENT_WEEK - WINDOW + 1;

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

interface AIAnalysis {
  needsAttention: AttentionFarm[];
  mostImproved: ImprovedFarm[];
  industryInsight: string;
}

function buildFarmSummaries(reports: QualityReport[], accounts: Account[]) {
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  // Get reports in the analysis window and the prior window for trend comparison
  const recentByFarm = new Map<string, QualityReport[]>();
  const olderByFarm = new Map<string, QualityReport[]>();

  for (const r of reports) {
    if (r.weekNr <= 0) continue;
    if (r.weekNr >= MIN_WEEK && r.weekNr <= CURRENT_WEEK) {
      if (!recentByFarm.has(r.farmAccountId)) recentByFarm.set(r.farmAccountId, []);
      recentByFarm.get(r.farmAccountId)!.push(r);
    } else if (r.weekNr >= MIN_WEEK - WINDOW && r.weekNr < MIN_WEEK) {
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

    const extractWeekly = (reps: QualityReport[]) =>
      reps.map((r) => ({
        week: r.weekNr,
        intakePh: r.qrIntakePh,
        intakeEc: r.qrIntakeEc,
        intakeTemp: r.qrIntakeTempColdstore,
        intakeHumidity: r.qrIntakeHumidityColdstore,
        intakeColdstoreHours: r.qrIntakeColdstoreHours,
        intakeWaterQuality: r.qrIntakeWaterQuality,
        intakeTreatment: r.qrIntakeTreatment,
        intakeHeadSize: r.qrIntakeHeadSize,
        intakeStemLength: r.qrIntakeStemLength,
        exportPh: r.qrExportPh,
        exportEc: r.qrExportEc,
        exportTemp: r.qrExportTempColdstore,
        exportHumidity: r.qrExportHumidityColdstore,
        exportColdstoreHours: r.qrExportColdstoreHours,
        exportWaterQuality: r.qrExportWaterQuality,
        exportTreatment: r.qrExportTreatment,
        qualityRating: r.qrGenQualityRating,
        processingSpeed: r.qrPackProcessingSpeed,
        packingQuality: r.qrDispatchPackingQuality,
        packrate: r.qrDispatchPackrate,
        truckType: r.qrDispatchTruckType,
      }));

    summaries.push({
      farmId,
      farmName: accountMap.get(farmId) || "Unknown",
      recentWeeks: extractWeekly(sorted),
      priorWeeks: extractWeekly(olderSorted),
      reportCount: sorted.length,
    });
  }

  return summaries;
}

export function ExceptionReport({ reports, accounts, onSelectFarm, open, onOpenChange }: ExceptionReportProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const farmSummaries = buildFarmSummaries(reports, accounts);

      if (farmSummaries.length === 0) {
        setError("No farms with sufficient data in the last 10 weeks.");
        setLoading(false);
        return;
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-exceptions`;
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

      setAnalysis(data as AIAnalysis);
    } catch (e: any) {
      console.error("Exception analysis error:", e);
      const msg = e?.message || "Analysis failed";
      setError(msg);
      toast({
        title: "Analysis Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [reports, accounts]);

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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Exception Report
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Weeks {MIN_WEEK}–{CURRENT_WEEK} · AI-powered post-harvest quality analysis
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
            <Button variant="outline" size="sm" onClick={runAnalysis}>
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
                <p className="text-sm text-foreground leading-relaxed">{analysis.industryInsight}</p>
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
                  <p className="text-sm text-muted-foreground py-4 text-center">No significant improvements detected</p>
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

            {/* Re-analyze button */}
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={runAnalysis} className="gap-2 text-xs">
                <Sparkles className="h-3 w-3" />
                Re-analyze
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
