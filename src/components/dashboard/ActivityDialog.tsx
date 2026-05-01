import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Phone, MapPin, CheckCircle, Clock, AlertCircle, Lightbulb, Loader2, FlaskConical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Activity, User } from "@/lib/csvParser";
import { useVaselifeHeaders, useAllVaselifeMeasurements, type VaselifeHeader } from "@/hooks/useVaselifeTrials";
import { computeConcludedDate } from "@/lib/trialConcluded";
import { VaselifeTrialDetail } from "@/components/trials/VaselifeTrialDetail";

interface FarmInsight {
  farmId: string;
  farmName: string;
  status: "critical" | "warning" | "stable" | "good" | "excellent";
  summary: string;
  details: string[];
  keyMetrics: string[];
}

interface AIAnalysis {
  allFarmInsights?: FarmInsight[];
  industryInsight?: string;
}

interface ActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  farmName: string;
  activities: Activity[];
  users?: User[];
  analysis: AIAnalysis | null;
}

const typeIcon: Record<string, typeof ClipboardList> = {
  Task: ClipboardList,
  Call: Phone,
  Visit: MapPin,
};

const statusColor: Record<string, string> = {
  "Completed": "bg-accent/15 text-accent border-accent/30",
  "In Progress": "bg-primary/15 text-primary border-primary/30",
  "To Do": "bg-muted text-muted-foreground border-border",
};

function generateSuggestedActions(analysis: AIAnalysis | null, farmId: string): string[] {
  if (!analysis?.allFarmInsights) return [];
  const insight = analysis.allFarmInsights.find((f) => f.farmId === farmId);
  if (!insight) return [];

  const actions: string[] = [];
  const detailsStr = [...insight.details, insight.summary, ...insight.keyMetrics].join(" ").toLowerCase();

  // Water quality / pH / EC issues → product recommendations
  if (detailsStr.includes("ph") || detailsStr.includes("water quality") || detailsStr.includes("ec")) {
    if (detailsStr.includes("high ph") || detailsStr.includes("ph above") || detailsStr.includes("ph risk")) {
      actions.push("Schedule visit to review water treatment: consider Chrysal Professional 2 or RVB Clear to lower pH and improve uptake");
    }
    if (detailsStr.includes("ec") || detailsStr.includes("conductivity")) {
      actions.push("Review EC levels and recommend post-harvest solution adjustment — check if current dosage matches flower volume");
    }
    if (actions.length === 0 && (detailsStr.includes("ph") || detailsStr.includes("water"))) {
      actions.push("Plan water quality assessment — check source water pH and recommend appropriate Chrysal conditioning products");
    }
  }

  // Temperature / humidity / cold store issues → protocol improvements
  if (detailsStr.includes("temp") || detailsStr.includes("temperature") || detailsStr.includes("cold")) {
    actions.push("Review cold chain protocol: verify cold store is maintained at 1–4°C and check for door-open time issues");
  }
  if (detailsStr.includes("humid") || detailsStr.includes("dehydr") || detailsStr.includes("botrytis")) {
    actions.push("Assess humidity management: target 80–95% RH — consider adding humidity monitoring alerts if not in place");
  }

  // Quality rating / handling issues
  if (detailsStr.includes("handling") || detailsStr.includes("quality rating") || detailsStr.includes("poor") || detailsStr.includes("bad")) {
    actions.push("Schedule a training session on post-harvest handling best practices with packhouse staff");
  }

  // Processing speed
  if (detailsStr.includes("processing") || detailsStr.includes("speed") || detailsStr.includes("slow")) {
    actions.push("Review packhouse processing workflow — identify bottlenecks to reduce time from harvest to cold store");
  }

  // Cold store hours
  if (detailsStr.includes("hours") || detailsStr.includes("storage time")) {
    actions.push("Optimize logistics to reduce cold store dwell time — coordinate dispatch schedules with transport availability");
  }

  // General improvement if status is not good
  if (actions.length === 0 && (insight.status === "critical" || insight.status === "warning")) {
    actions.push("Schedule comprehensive farm visit to review current post-harvest protocols and identify improvement areas");
  }

  return actions.slice(0, 5);
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ActivityDialog({ open, onOpenChange, farmId, farmName, activities, users, analysis }: ActivityDialogProps) {
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.id, u.name])), [users]);
  const farmActivities = useMemo(() => {
    return activities
      .filter((a) => a.accountId === farmId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [activities, farmId]);

  const suggestedActions = useMemo(
    () => generateSuggestedActions(analysis, farmId),
    [analysis, farmId]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Activity — {farmName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-5">
          <div className="py-4 space-y-6">
            {/* AI Suggested Actions */}
            {suggestedActions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-warning" />
                  Suggested Actions (AI)
                </h4>
                <div className="space-y-2">
                  {suggestedActions.map((action, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/5 px-3.5 py-2.5"
                    >
                      <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground/90">{action}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Activity Timeline ({farmActivities.length})
              </h4>

              {farmActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No activities recorded for this farm.
                </p>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-0">
                    {farmActivities.slice(0, 50).map((activity, i) => {
                      const Icon = typeIcon[activity.type] || ClipboardList;
                      const colorClass = statusColor[activity.status] || statusColor["To Do"];

                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="relative flex items-start gap-3 py-2.5 pl-0"
                        >
                          {/* Dot on timeline */}
                          <div className="z-10 mt-1 w-[31px] flex justify-center shrink-0">
                            <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                              activity.status === "Completed" ? "bg-accent border-accent" :
                              activity.status === "In Progress" ? "bg-primary border-primary" :
                              "bg-muted-foreground/30 border-muted-foreground/40"
                            }`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium text-foreground truncate">
                                {activity.subject || "Untitled"}
                              </span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colorClass}`}>
                                {activity.status}
                              </Badge>
                            </div>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 ml-[22px]">
                                {activity.description}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground/60 ml-[22px] mt-0.5">
                              {formatDate(activity.startsAt || activity.createdAt)}
                              {activity.type && ` · ${activity.type}`}
                              {activity.assignedUserId && userMap.get(activity.assignedUserId) && ` · ${userMap.get(activity.assignedUserId)}`}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {farmActivities.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      Showing 50 of {farmActivities.length} activities
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
