import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { QualityReport, Account } from "@/lib/csvParser";

interface ExceptionReportProps {
  reports: QualityReport[];
  accounts: Account[];
  onSelectFarm: (farmId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Current week: 2512 (week 12, 2025). Last 10 weeks = 2503..2512
const CURRENT_WEEK = 2612;
const WINDOW = 10;
const MIN_WEEK = CURRENT_WEEK - WINDOW + 1;

// Ideal ranges for quality parameters
const IDEAL = {
  ph: { min: 3.5, max: 5.0 },
  ec: { min: 400, max: 800 },
  temp: { min: 1, max: 5 },
  humidity: { min: 70, max: 90 },
  qualityRating: { best: 1, worst: 3 },
};

interface FarmScore {
  farmId: string;
  farmName: string;
  deviationScore: number; // higher = worse
  trendScore: number; // negative = improving, positive = worsening
  recentReportCount: number;
  flags: string[];
}

function deviation(value: number | null, range: { min: number; max: number }): number {
  if (value === null) return 0;
  if (value < range.min) return (range.min - value) / (range.max - range.min);
  if (value > range.max) return (value - range.max) / (range.max - range.min);
  return 0;
}

function computeFarmScores(reports: QualityReport[], accounts: Account[]): FarmScore[] {
  // Group reports by farm for the recent window
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

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const scores: FarmScore[] = [];

  for (const [farmId, farmReports] of recentByFarm) {
    if (farmReports.length < 2) continue;

    const flags: string[] = [];
    let totalDeviation = 0;
    let deviationCount = 0;

    // Compute average deviation across all recent reports
    for (const r of farmReports) {
      const d1 = deviation(r.qrIntakePh, IDEAL.ph);
      const d2 = deviation(r.qrIntakeEc, IDEAL.ec);
      const d3 = deviation(r.qrIntakeTempColdstore, IDEAL.temp);
      const d4 = deviation(r.qrIntakeHumidityColdstore, IDEAL.humidity);
      
      if (d1 > 0) { totalDeviation += d1; deviationCount++; }
      if (d2 > 0) { totalDeviation += d2; deviationCount++; }
      if (d3 > 0) { totalDeviation += d3; deviationCount++; }
      if (d4 > 0) { totalDeviation += d4; deviationCount++; }

      // Quality rating: 3 = bad
      if (r.qrGenQualityRating === 3) {
        totalDeviation += 1.5;
        deviationCount++;
      }
      if (r.qrExportWaterQuality === 3 || r.qrIntakeWaterQuality === 3) {
        totalDeviation += 0.5;
        deviationCount++;
      }
    }

    const avgDeviation = deviationCount > 0 ? totalDeviation / farmReports.length : 0;

    // Flag high-deviation areas
    const avgPh = avg(farmReports.map((r) => r.qrIntakePh));
    const avgEc = avg(farmReports.map((r) => r.qrIntakeEc));
    const avgTemp = avg(farmReports.map((r) => r.qrIntakeTempColdstore));

    if (avgPh !== null && (avgPh < IDEAL.ph.min || avgPh > IDEAL.ph.max)) flags.push("pH out of range");
    if (avgEc !== null && (avgEc < IDEAL.ec.min || avgEc > IDEAL.ec.max)) flags.push("EC out of range");
    if (avgTemp !== null && (avgTemp < IDEAL.temp.min || avgTemp > IDEAL.temp.max)) flags.push("Temperature concern");

    // Trend: compare recent avg deviation to older period
    const olderReports = olderByFarm.get(farmId) || [];
    let olderDeviation = 0;
    let olderCount = 0;
    for (const r of olderReports) {
      const d1 = deviation(r.qrIntakePh, IDEAL.ph);
      const d2 = deviation(r.qrIntakeEc, IDEAL.ec);
      const d3 = deviation(r.qrIntakeTempColdstore, IDEAL.temp);
      const d4 = deviation(r.qrIntakeHumidityColdstore, IDEAL.humidity);
      if (d1 > 0) { olderDeviation += d1; olderCount++; }
      if (d2 > 0) { olderDeviation += d2; olderCount++; }
      if (d3 > 0) { olderDeviation += d3; olderCount++; }
      if (d4 > 0) { olderDeviation += d4; olderCount++; }
    }
    const olderAvg = olderReports.length > 0 && olderCount > 0 ? olderDeviation / olderReports.length : avgDeviation;
    const trendScore = avgDeviation - olderAvg; // positive = worsening

    if (trendScore > 0.1) flags.push("Worsening trend");
    if (trendScore < -0.1) flags.push("Improving trend");

    scores.push({
      farmId,
      farmName: accountMap.get(farmId) || "Unknown Farm",
      deviationScore: avgDeviation,
      trendScore,
      recentReportCount: farmReports.length,
      flags,
    });
  }

  return scores;
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function ExceptionReport({ reports, accounts, onSelectFarm, open, onOpenChange }: ExceptionReportProps) {
  const { worst, improved } = useMemo(() => {
    const scores = computeFarmScores(reports, accounts);

    // Worst: highest combined deviation + worsening trend
    const worstSorted = [...scores]
      .sort((a, b) => (b.deviationScore + Math.max(0, b.trendScore)) - (a.deviationScore + Math.max(0, a.trendScore)))
      .slice(0, 5);

    // Most improved: biggest negative trend (was bad, now better)
    const improvedSorted = [...scores]
      .filter((s) => s.trendScore < 0)
      .sort((a, b) => a.trendScore - b.trendScore)
      .slice(0, 5);

    return { worst: worstSorted, improved: improvedSorted };
  }, [reports, accounts]);

  const handleClick = (farmId: string) => {
    onSelectFarm(farmId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-0 shadow-card bg-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
        >
          <AlertTriangle className="h-4 w-4 text-warning" />
          Exception Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Exception Report
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Weeks {MIN_WEEK}–{CURRENT_WEEK} · Based on pH, EC, temperature, humidity & quality ratings
          </p>
        </DialogHeader>

        {/* Worst performing */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Needs Attention
            </h3>
          </div>
          <div className="space-y-2">
            {worst.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No significant deviations found</p>
            ) : (
              worst.map((farm, i) => (
                <motion.button
                  key={farm.farmId}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  onClick={() => handleClick(farm.farmId)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors duration-150 text-left group"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate group-hover:text-destructive transition-colors">
                      {farm.farmName}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {farm.flags.map((f) => (
                        <span key={f} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                          {f}
                        </span>
                      ))}
                      <span className="text-[10px] text-muted-foreground">
                        {farm.recentReportCount} reports
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-destructive flex-shrink-0 transition-colors" />
                </motion.button>
              ))
            )}
          </div>
        </div>

        {/* Most improved */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Most Improved
            </h3>
          </div>
          <div className="space-y-2">
            {improved.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No significant improvements detected</p>
            ) : (
              improved.map((farm, i) => (
                <motion.button
                  key={farm.farmId}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 + 0.25, duration: 0.2 }}
                  onClick={() => handleClick(farm.farmId)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors duration-150 text-left group"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate group-hover:text-accent transition-colors">
                      {farm.farmName}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {farm.flags.map((f) => (
                        <span key={f} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                          {f}
                        </span>
                      ))}
                      <span className="text-[10px] text-muted-foreground">
                        {farm.recentReportCount} reports
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent flex-shrink-0 transition-colors" />
                </motion.button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
