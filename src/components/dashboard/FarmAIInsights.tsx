import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, Award, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

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

interface FarmAIInsightsProps {
  farmId: string;
}

export function FarmAIInsights({ farmId }: FarmAIInsightsProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCache() {
      setLoading(true);
      const { data } = await supabase
        .from("exception_report_cache")
        .select("analysis")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data?.analysis) {
        setAnalysis(data.analysis as unknown as AIAnalysis);
      }
      setLoading(false);
    }
    loadCache();
  }, []);

  if (loading) {
    return (
      <div className="mb-8 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Info className="w-4 h-4" />
          Loading AI insights…
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  // Find this farm in any category
  const attention = analysis.needsAttention?.find((f) => f.farmId === farmId);
  const improved = analysis.mostImproved?.find((f) => f.farmId === farmId);
  const topPerformer = analysis.topPerformers?.find((f) => f.farmId === farmId);

  if (!attention && !improved && !topPerformer) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-8"
    >
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <Info className="w-4 h-4" />
        AI Quality Insights (Last 12 Weeks)
      </h3>

      <div className="space-y-4">
        {attention && (
          <div
            className={`rounded-xl border p-5 ${
              attention.severity === "critical"
                ? "border-destructive/30 bg-destructive/5"
                : "border-warning/30 bg-warning/5"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 p-1.5 rounded-full ${
                  attention.severity === "critical"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-warning/15 text-warning"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground text-sm uppercase tracking-wide">
                    {attention.severity === "critical" ? "Needs Attention" : "Warning"}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 mb-3">{attention.summary}</p>
                <ul className="space-y-1.5">
                  {attention.details.map((d, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {attention.affectedMetrics.map((m) => (
                    <Badge key={m} variant="outline" className="text-xs border-destructive/30 text-destructive">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {improved && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-full bg-accent/15 text-accent">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground text-sm uppercase tracking-wide">
                  Most Improved
                </span>
                <p className="text-sm text-foreground/80 mt-1 mb-3">{improved.summary}</p>
                <ul className="space-y-1.5">
                  {improved.details.map((d, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent/40 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {improved.improvedMetrics.map((m) => (
                    <Badge key={m} variant="outline" className="text-xs border-accent/30 text-accent">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {topPerformer && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-full bg-primary/15 text-primary">
                <Award className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground text-sm uppercase tracking-wide">
                  Top Performer
                </span>
                <p className="text-sm text-foreground/80 mt-1 mb-3">{topPerformer.summary}</p>
                <ul className="space-y-1.5">
                  {topPerformer.details.map((d, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {topPerformer.strongMetrics.map((m) => (
                    <Badge key={m} variant="outline" className="text-xs border-primary/30 text-primary">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
