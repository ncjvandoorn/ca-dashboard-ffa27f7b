import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, Award, Info, CheckCircle, Shield, ClipboardList, FileText, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityDialog } from "@/components/dashboard/ActivityDialog";
import { FarmReportsDialog } from "@/components/dashboard/FarmReportsDialog";
import { SalesDialog } from "@/components/dashboard/SalesDialog";
import type { Activity, QualityReport, User, ServicesOrder } from "@/lib/csvParser";

interface FarmInsight {
  farmId: string;
  farmName: string;
  status: "critical" | "warning" | "stable" | "good" | "excellent";
  summary: string;
  details: string[];
  keyMetrics: string[];
}

interface AIAnalysis {
  needsAttention?: any[];
  mostImproved?: any[];
  topPerformers?: any[];
  allFarmInsights?: FarmInsight[];
  industryInsight?: string;
}

interface FarmAIInsightsProps {
  farmId: string;
  farmName: string;
  activities: Activity[];
  reports: QualityReport[];
  users: User[];
  hideActivity?: boolean;
}

const statusConfig = {
  critical: {
    icon: AlertTriangle,
    label: "Needs Attention",
    border: "border-destructive/30",
    bg: "bg-destructive/5",
    iconBg: "bg-destructive/15 text-destructive",
    dot: "bg-destructive/40",
    badgeBorder: "border-destructive/30 text-destructive",
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    border: "border-warning/30",
    bg: "bg-warning/5",
    iconBg: "bg-warning/15 text-warning",
    dot: "bg-warning/40",
    badgeBorder: "border-warning/30 text-warning",
  },
  stable: {
    icon: Info,
    label: "Stable",
    border: "border-border",
    bg: "bg-muted/30",
    iconBg: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
    badgeBorder: "border-border text-muted-foreground",
  },
  good: {
    icon: CheckCircle,
    label: "Good",
    border: "border-accent/30",
    bg: "bg-accent/5",
    iconBg: "bg-accent/15 text-accent",
    dot: "bg-accent/40",
    badgeBorder: "border-accent/30 text-accent",
  },
  excellent: {
    icon: Shield,
    label: "Top Performer",
    border: "border-primary/30",
    bg: "bg-primary/5",
    iconBg: "bg-primary/15 text-primary",
    dot: "bg-primary/40",
    badgeBorder: "border-primary/30 text-primary",
  },
};

export function FarmAIInsights({ farmId, farmName, activities, reports, users, hideActivity }: FarmAIInsightsProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

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

  // Always render — show activity button even without insights
  const farmInsight = analysis?.allFarmInsights?.find((f) => f.farmId === farmId);

  const config = farmInsight ? (statusConfig[farmInsight.status] || statusConfig.stable) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-8"
      key={farmId}
    >
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <Info className="w-4 h-4" />
        AI Quality Insights (Last 12 Weeks)
      </h3>

      {farmInsight && config ? (
        <div className={`rounded-xl border p-5 ${config.border} ${config.bg} relative`}>
          {!hideActivity && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setReportsOpen(true)}
              >
                <FileText className="h-3.5 w-3.5" />
                Reports
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setActivityOpen(true)}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Activity
              </Button>
            </div>
          )}
          <div className="flex items-start gap-3 pr-24">
            <div className={`mt-0.5 p-1.5 rounded-full ${config.iconBg}`}>
              <config.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-foreground text-sm uppercase tracking-wide">
                  {config.label}
                </span>
              </div>
              <p className="text-sm text-foreground/80 mb-3">{farmInsight.summary}</p>
              <ul className="space-y-1.5">
                {farmInsight.details.map((d, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`} />
                    {d}
                  </li>
                ))}
              </ul>
              {farmInsight.keyMetrics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {farmInsight.keyMetrics.map((m) => (
                    <Badge key={m} variant="outline" className={`text-xs ${config.badgeBorder}`}>
                      {m}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-muted/20 p-5 relative">
          {!hideActivity && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setReportsOpen(true)}
              >
                <FileText className="h-3.5 w-3.5" />
                Reports
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setActivityOpen(true)}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Activity
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Info className="w-4 h-4" />
            No AI quality insights available for this farm yet.
          </div>
        </div>
      )}
      <ActivityDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        farmId={farmId}
        farmName={farmName}
        activities={activities}
        users={users}
        analysis={analysis}
      />
      <FarmReportsDialog
        open={reportsOpen}
        onOpenChange={setReportsOpen}
        farmId={farmId}
        farmName={farmName}
        reports={reports}
        users={users}
      />
    </motion.div>
  );
}
