import { useMemo } from "react";
import { motion } from "framer-motion";
import { CloudSun, Info, Bug, Eye, TrendingUp, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface WeeklyAssessment {
  weekNr: number;
  weatherSummary: string;
  qualityImpactScore: number;
  keyObservations: string[];
}
interface PestDisease {
  name: string;
  category: "disease" | "pest";
  severity: "low" | "moderate" | "high";
  trend: "increasing" | "stable" | "decreasing";
  weeksObserved: number[];
  farmsAffected: string[];
  environmentalDriver: string;
  notes: string;
}
interface WeeklyQuality {
  weekNr: number;
  avgQualityRating: number;
}
export interface SeasonalityAnalysis {
  weeklyAssessment: WeeklyAssessment[];
  pestAndDisease: PestDisease[];
  seasonalSummary: string;
  outlook: string;
  averageQualityByWeek: WeeklyQuality[];
}

const severityColors: Record<string, string> = {
  low: "bg-accent/15 text-accent",
  moderate: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

function impactColor(score: number) {
  if (score <= 3) return "text-accent";
  if (score <= 6) return "text-warning";
  return "text-destructive";
}
function impactBg(score: number) {
  if (score <= 3) return "bg-accent/10";
  if (score <= 6) return "bg-warning/10";
  return "bg-destructive/10";
}

interface SeasonalityInsightsBodyProps {
  analysis: SeasonalityAnalysis;
  /** When true, farm names in pest/disease cards are hidden (customer view). */
  hideFarms?: boolean;
}

export function SeasonalityInsightsBody({ analysis, hideFarms = false }: SeasonalityInsightsBodyProps) {
  const chartData = useMemo(() => {
    const assessmentMap = new Map(analysis.weeklyAssessment.map((w) => [w.weekNr, w.qualityImpactScore]));
    const qualityMap = new Map(analysis.averageQualityByWeek.map((w) => [w.weekNr, w.avgQualityRating]));
    const allWeeks = new Set([...assessmentMap.keys(), ...qualityMap.keys()]);
    return [...allWeeks].sort((a, b) => a - b).map((week) => ({
      week,
      "Weather Impact": assessmentMap.get(week) ?? null,
      "Avg Quality": qualityMap.get(week) ?? null,
    }));
  }, [analysis]);

  return (
    <>
      {/* Seasonal Summary */}
      <div className="chrysal-gradient-subtle rounded-lg p-4 mt-2">
        <div className="flex gap-3">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{analysis.seasonalSummary.replace(/\\n/g, "\n")}</p>
        </div>
      </div>

      {/* Impact Chart */}
      {chartData.length > 0 && (
        <div className="mt-5 bg-card rounded-xl border border-border/40 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Weather Impact & Quality Trend
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="impactGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="qualityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(207, 100%, 35%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(207, 100%, 35%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis yAxisId="left" domain={[0, 10]} tick={{ fontSize: 11 }} label={{ value: "Impact", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
              <YAxis yAxisId="right" orientation="right" domain={[1, 3]} tick={{ fontSize: 11 }} label={{ value: "Quality", angle: 90, position: "insideRight", style: { fontSize: 10 } }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
              <Area yAxisId="left" type="monotone" dataKey="Weather Impact" stroke="hsl(0, 72%, 51%)" fill="url(#impactGrad)" strokeWidth={2} dot={{ r: 3 }} />
              <Area yAxisId="right" type="monotone" dataKey="Avg Quality" stroke="hsl(207, 100%, 35%)" fill="url(#qualityGrad)" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            Weather Impact (1-10, higher = worse) · Avg Quality Rating (1=Good, 3=Bad)
          </p>
        </div>
      )}

      {/* Weekly Assessment */}
      <div className="mt-5">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Weekly Conditions</h3>
        </div>
        <div className="space-y-2">
          {[...analysis.weeklyAssessment].sort((a, b) => b.weekNr - a.weekNr).map((week, i) => (
            <motion.div
              key={week.weekNr}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${impactBg(week.qualityImpactScore)} ${impactColor(week.qualityImpactScore)}`}>
                {week.qualityImpactScore}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-foreground">Wk {week.weekNr}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{week.weatherSummary}</p>
                {week.keyObservations.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {week.keyObservations.map((obs, j) => (
                      <p key={j} className="text-[11px] text-muted-foreground">• {obs}</p>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pest & Disease */}
      {analysis.pestAndDisease.length > 0 && (
        <div className="mt-6">
          {analysis.pestAndDisease.some((pd) => pd.category === "disease") && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Disease Incidence</h3>
              </div>
              <div className="space-y-2">
                {analysis.pestAndDisease.filter((pd) => pd.category === "disease").map((pd, i) => (
                  <motion.div key={pd.name} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 + 0.3, duration: 0.2 }} className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{pd.name}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${severityColors[pd.severity]}`}>{pd.severity}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        pd.trend === "increasing" ? "bg-destructive/10 text-destructive" :
                        pd.trend === "decreasing" ? "bg-accent/10 text-accent" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {pd.trend === "increasing" ? "↑ increasing" : pd.trend === "decreasing" ? "↓ decreasing" : "→ stable"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">{pd.notes}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <span className="font-medium text-foreground/70">Driver:</span> {pd.environmentalDriver}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                      <span><span className="font-medium text-foreground/70">Weeks:</span> {pd.weeksObserved.join(", ")}</span>
                      {pd.farmsAffected.length > 0 && (
                        <span><span className="font-medium text-foreground/70">Farms:</span> {pd.farmsAffected.join(", ")}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {analysis.pestAndDisease.some((pd) => pd.category === "pest") && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bug className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Pest Incidence</h3>
              </div>
              <div className="space-y-2">
                {analysis.pestAndDisease.filter((pd) => pd.category === "pest").map((pd, i) => (
                  <motion.div key={pd.name} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 + 0.45, duration: 0.2 }} className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{pd.name}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${severityColors[pd.severity]}`}>{pd.severity}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        pd.trend === "increasing" ? "bg-destructive/10 text-destructive" :
                        pd.trend === "decreasing" ? "bg-accent/10 text-accent" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {pd.trend === "increasing" ? "↑ increasing" : pd.trend === "decreasing" ? "↓ decreasing" : "→ stable"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">{pd.notes}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <span className="font-medium text-foreground/70">Driver:</span> {pd.environmentalDriver}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                      <span><span className="font-medium text-foreground/70">Weeks:</span> {pd.weeksObserved.join(", ")}</span>
                      {pd.farmsAffected.length > 0 && (
                        <span><span className="font-medium text-foreground/70">Farms:</span> {pd.farmsAffected.join(", ")}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Outlook */}
      {analysis.outlook && (
        <div className="mt-6 bg-primary/5 rounded-lg p-4">
          <div className="flex gap-3">
            <CloudSun className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Outlook</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{analysis.outlook.replace(/\\n/g, "\n")}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
