import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight, Sparkles, Info } from "lucide-react";

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
export interface ExceptionAnalysis {
  needsAttention: AttentionFarm[];
  mostImproved: ImprovedFarm[];
  topPerformers?: TopPerformerFarm[];
  industryInsight: string;
}

interface ExceptionReportBodyProps {
  analysis: ExceptionAnalysis;
  /** When provided, rows are clickable and dispatch this. In shared mode, omit. */
  onSelectFarm?: (farmId: string) => void;
}

export function ExceptionReportBody({ analysis, onSelectFarm }: ExceptionReportBodyProps) {
  const interactive = !!onSelectFarm;
  const handle = (farmId: string) => onSelectFarm?.(farmId);
  const Tag = (interactive ? motion.button : motion.div) as any;

  return (
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
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Needs Attention</h3>
        </div>
        <div className="space-y-2">
          {analysis.needsAttention.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No farms flagged — all within acceptable ranges</p>
          ) : (
            analysis.needsAttention.map((farm, i) => (
              <Tag
                key={farm.farmId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                onClick={interactive ? () => handle(farm.farmId) : undefined}
                className={`w-full flex items-start gap-4 p-4 rounded-lg bg-destructive/5 transition-colors duration-150 text-left group ${interactive ? "hover:bg-destructive/10" : ""}`}
              >
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  farm.severity === "critical" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                }`}>
                  {farm.severity === "critical" ? "!" : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm text-foreground truncate transition-colors ${interactive ? "group-hover:text-destructive" : ""}`}>
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
                        farm.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                      }`}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                {interactive && <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-destructive flex-shrink-0 transition-colors mt-1" />}
              </Tag>
            ))
          )}
        </div>
      </div>

      {/* Most Improved */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Most Improved</h3>
        </div>
        <div className="space-y-2">
          {analysis.mostImproved.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No significant improvements detected in the analysis window</p>
          ) : (
            analysis.mostImproved.map((farm, i) => (
              <Tag
                key={farm.farmId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 + 0.25, duration: 0.2 }}
                onClick={interactive ? () => handle(farm.farmId) : undefined}
                className={`w-full flex items-start gap-4 p-4 rounded-lg bg-accent/5 transition-colors duration-150 text-left group ${interactive ? "hover:bg-accent/10" : ""}`}
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm text-foreground truncate transition-colors ${interactive ? "group-hover:text-accent" : ""}`}>
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
                {interactive && <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent flex-shrink-0 transition-colors mt-1" />}
              </Tag>
            ))
          )}
        </div>
      </div>

      {/* Top Performers */}
      {analysis.topPerformers && analysis.topPerformers.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Top Performers</h3>
          </div>
          <div className="space-y-2">
            {analysis.topPerformers.map((farm, i) => (
              <Tag
                key={farm.farmId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 + 0.5, duration: 0.2 }}
                onClick={interactive ? () => handle(farm.farmId) : undefined}
                className={`w-full flex items-start gap-4 p-4 rounded-lg bg-primary/5 transition-colors duration-150 text-left group ${interactive ? "hover:bg-primary/10" : ""}`}
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm text-foreground truncate transition-colors ${interactive ? "group-hover:text-primary" : ""}`}>
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
                {interactive && <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors mt-1" />}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
