import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Loader2, RefreshCw,
  ClipboardList, Phone, MapPin, AlertTriangle, Users,
  Target, CalendarCheck, UserCheck, PlusCircle, Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Activity, User, Account, QualityReport } from "@/lib/csvParser";

interface Props {
  allActivities: Activity[];
  users: User[];
  accounts: Account[];
  reports: QualityReport[];
  activeUsers: { id: string; name: string }[];
  onBack: () => void;
}

const WINDOW = 12;
const ACTIVITY_WINDOW_WEEKS = 8;

function trimNote(note?: string | null, maxLen = 120): string | undefined {
  if (!note) return undefined;
  const cleaned = note.replace(/\s+/g, " ").trim();
  return cleaned ? (cleaned.length <= maxLen ? cleaned : `${cleaned.slice(0, maxLen - 1)}…`) : undefined;
}

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

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface WeeklyPlan {
  weekLabel: string;
  executiveSummary: string;
  urgentFarmVisits: { farmId: string; farmName: string; reason: string; suggestedUser: string; qualityIssues: string[]; priority: "critical" | "high" }[];
  overdueActivities: { activitySubject: string; farmName: string; assignedUser: string; daysOverdue: number; recommendation: string }[];
  userWorkloadAssessment: { userName: string; openTasks: number; completedRecently: number; completionRate: number; assessment: string; recommendation: string }[];
  suggestedNewActivities: { type: string; subject: string; farmName: string; suggestedUser: string; reason: string; priority: "critical" | "high" | "medium" }[];
  farmsWithoutCoverage: { farmId: string; farmName: string; lastActivityDate: string; qualityStatus: string; recommendation: string }[];
  weeklyFocus: string;
}

const typeIcon: Record<string, typeof ClipboardList> = {
  Task: ClipboardList,
  Call: Phone,
  Visit: MapPin,
};

const priorityStyle: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-warning/10 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/30",
};

const assessmentStyle: Record<string, string> = {
  "On track": "text-accent",
  "Overloaded": "text-destructive",
  "Underutilized": "text-muted-foreground",
  "Falling behind": "text-warning",
};

export function ComingWeekView({ allActivities, users, accounts, reports, activeUsers, onBack }: Props) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  // Open tasks (To Do + In Progress)
  const openTasks = useMemo(() => {
    return allActivities
      .filter((a) => a.status === "To Do" || a.status === "In Progress")
      .sort((a, b) => (a.startsAt || a.createdAt || 0) - (b.startsAt || b.createdAt || 0));
  }, [allActivities]);

  // Load cached plan on mount
  const loadCached = useCallback(async () => {
    const currentWeek = getCurrentWeekNr();
    const { data } = await supabase
      .from("weekly_plan_cache")
      .select("*")
      .eq("week_nr", currentWeek)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data?.analysis) {
      setPlan(data.analysis as unknown as WeeklyPlan);
      setCachedAt(data.created_at);
    }
  }, []);

  // Load on first render
  useState(() => { loadCached(); });

  const buildPayload = useCallback(() => {
    const now = Date.now();
    const eightWeeksMs = ACTIVITY_WINDOW_WEEKS * 7 * 86400000;
    const recentActivities = allActivities.filter((a) => {
      const ts = a.createdAt || a.startsAt || 0;
      return ts > now - eightWeeksMs;
    });

    // Group activities by user
    const actByUser: Record<string, { open: any[]; completed: any[]; total: number }> = {};
    for (const a of recentActivities) {
      const uid = a.assignedUserId || a.ownerUserId || "unassigned";
      if (!actByUser[uid]) actByUser[uid] = { open: [], completed: [], total: 0 };
      actByUser[uid].total++;
      const item = {
        sub: a.subject?.slice(0, 80),
        type: a.type,
        farm: a.accountId ? accountMap.get(a.accountId) : undefined,
        farmId: a.accountId || undefined,
        startsAt: a.startsAt ? formatDate(a.startsAt) : undefined,
        createdAt: a.createdAt ? formatDate(a.createdAt) : undefined,
        daysOld: a.createdAt ? Math.floor((now - a.createdAt) / 86400000) : undefined,
      };
      if (a.status === "Completed") actByUser[uid].completed.push(item);
      else if (a.status === "To Do" || a.status === "In Progress") actByUser[uid].open.push(item);
    }

    const activitySummary = Object.entries(actByUser).map(([uid, data]) => ({
      user: userMap.get(uid) || uid.slice(0, 8),
      openTasks: data.open.length,
      completedRecently: data.completed.length,
      total: data.total,
      completionRate: data.total > 0 ? Math.round((data.completed.length / data.total) * 100) : 0,
      openItems: data.open.slice(0, 20),
    }));

    // Quality report summaries (last 12 weeks)
    const allWeeks = [...new Set(reports.map((r) => r.weekNr))].sort((a, b) => b - a);
    const recentWeeks = new Set(allWeeks.slice(0, WINDOW));
    const recentReports = reports.filter((r) => recentWeeks.has(r.weekNr));

    const byFarm: Record<string, any[]> = {};
    for (const r of recentReports) {
      const fid = r.farmAccountId;
      if (!byFarm[fid]) byFarm[fid] = [];
      byFarm[fid].push({
        w: r.weekNr,
        iPh: r.qrIntakePh, iEc: r.qrIntakeEc, iT: r.qrIntakeTempColdstore, iH: r.qrIntakeHumidityColdstore,
        ePh: r.qrExportPh, eEc: r.qrExportEc, eT: r.qrExportTempColdstore, eH: r.qrExportHumidityColdstore,
        qR: r.qrGenQualityRating, wQ: r.qrIntakeWaterQuality,
        qN: trimNote(r.qrGenQualityFlowers),
        pN: trimNote(r.qrGenProtocolChanges),
        gC: trimNote(r.generalComment),
      });
    }

    const qualitySummary = Object.entries(byFarm).map(([fid, weeks]) => ({
      farmId: fid,
      farmName: accountMap.get(fid) || fid.slice(0, 8),
      weeks: weeks.sort((a: any, b: any) => b.w - a.w).slice(0, 6),
    }));

    const userSummary = activeUsers.map((u) => ({ id: u.id, name: u.name }));

    const weekRange = {
      min: allWeeks[allWeeks.length - 1],
      max: allWeeks[0],
    };

    return { activitySummary, qualitySummary, userSummary, weekRange };
  }, [allActivities, reports, activeUsers, userMap, accountMap]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const payload = buildPayload();
      const { data, error } = await supabase.functions.invoke("analyze-weekly-plan", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const analysis = data.analysis as WeeklyPlan;
      setPlan(analysis);

      // Cache it
      const currentWeek = getCurrentWeekNr();
      await supabase.from("weekly_plan_cache").delete().eq("week_nr", currentWeek);
      await supabase.from("weekly_plan_cache").insert({ week_nr: currentWeek, analysis: analysis as any });
      setCachedAt(new Date().toISOString());
      toast({ title: "Weekly plan generated" });
    } catch (e: any) {
      console.error("Weekly plan error:", e);
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [buildPayload]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to Board
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={runAnalysis}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : plan ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Analyzing..." : plan ? "Refresh AI Plan" : "Generate AI Plan"}
        </Button>
        {cachedAt && (
          <span className="text-[11px] text-muted-foreground">
            Last generated: {new Date(cachedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Open tasks overview */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          Open Tasks ({openTasks.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
          {openTasks.slice(0, 40).map((a) => {
            const Icon = typeIcon[a.type] || ClipboardList;
            const assignedName = a.assignedUserId ? userMap.get(a.assignedUserId) : null;
            const farmName = a.accountId ? accountMap.get(a.accountId) : null;
            const daysOld = a.createdAt ? Math.floor((Date.now() - a.createdAt) / 86400000) : null;
            return (
              <div key={a.id} className="rounded-lg border border-border bg-background p-2.5 text-sm flex items-start gap-2">
                <Icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs leading-tight line-clamp-1">{a.subject || "Untitled"}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {farmName && <span className="text-[10px] text-muted-foreground">{farmName}</span>}
                    {assignedName && <Badge variant="secondary" className="text-[9px] px-1 py-0">{assignedName.split(" ")[0]}</Badge>}
                    {daysOld !== null && daysOld > 14 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 text-warning border-warning/30">
                        {daysOld}d old
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${a.status === "In Progress" ? "text-primary" : "text-warning"}`}>
                      {a.status}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
          {openTasks.length === 0 && (
            <p className="text-xs text-muted-foreground col-span-2 text-center py-6">No open tasks</p>
          )}
        </div>
      </div>

      {/* AI Plan */}
      {plan && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Executive Summary */}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
            <h3 className="text-sm font-bold text-primary mb-1 flex items-center gap-2">
              <Target className="h-4 w-4" />
              {plan.weekLabel || "Coming Week"}
            </h3>
            <p className="text-sm text-foreground leading-relaxed">{plan.executiveSummary}</p>
          </div>

          {/* Weekly Focus */}
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <h4 className="text-xs font-bold text-accent uppercase tracking-wider mb-1">🎯 Weekly Focus</h4>
            <p className="text-sm text-foreground">{plan.weeklyFocus}</p>
          </div>

          {/* Urgent Farm Visits */}
          {plan.urgentFarmVisits?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Urgent Farm Visits
              </h4>
              <div className="space-y-2">
                {plan.urgentFarmVisits.map((v, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-lg border p-3 ${priorityStyle[v.priority]}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{v.farmName}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] uppercase">{v.priority}</Badge>
                        <Badge variant="secondary" className="text-[10px]">→ {v.suggestedUser}</Badge>
                      </div>
                    </div>
                    <p className="text-xs mb-1">{v.reason}</p>
                    {v.qualityIssues?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.qualityIssues.map((issue, j) => (
                          <span key={j} className="text-[10px] bg-background/50 rounded px-1.5 py-0.5">{issue}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* User Workload Assessment */}
          {plan.userWorkloadAssessment?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Team Workload Assessment
              </h4>
              <div className="space-y-2">
                {plan.userWorkloadAssessment.map((u, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{u.userName}</span>
                      <span className={`text-xs font-semibold ${assessmentStyle[u.assessment] || "text-foreground"}`}>
                        {u.assessment}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mb-1">
                      <span>Open: <b className="text-foreground">{u.openTasks}</b></span>
                      <span>Completed: <b className="text-accent">{u.completedRecently}</b></span>
                      <span>Rate: <b className="text-foreground">{u.completionRate}%</b></span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">{u.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested New Activities */}
          {plan.suggestedNewActivities?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-primary" />
                Suggested New Activities
              </h4>
              <div className="space-y-2">
                {plan.suggestedNewActivities.map((a, i) => {
                  const Icon = typeIcon[a.type] || ClipboardList;
                  return (
                    <div key={i} className={`rounded-lg border p-3 ${priorityStyle[a.priority] || "border-border"}`}>
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm">{a.subject}</span>
                            <Badge variant="outline" className="text-[9px]">{a.priority}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {a.farmName} · Assign to <b>{a.suggestedUser}</b>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 italic">{a.reason}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overdue Activities */}
          {plan.overdueActivities?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Overdue Activities
              </h4>
              <div className="space-y-1.5">
                {plan.overdueActivities.map((a, i) => (
                  <div key={i} className="rounded-lg border border-warning/20 bg-warning/5 p-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs">{a.activitySubject}</span>
                      <Badge variant="outline" className="text-[10px] text-warning border-warning/30">{a.daysOverdue}d overdue</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.farmName} · {a.assignedUser}</p>
                    <p className="text-[11px] text-muted-foreground italic">{a.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Farms Without Coverage */}
          {plan.farmsWithoutCoverage?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Farms Without Recent Coverage
              </h4>
              <div className="space-y-1.5">
                {plan.farmsWithoutCoverage.map((f, i) => (
                  <div key={i} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{f.farmName}</span>
                      <span className="text-[10px] text-muted-foreground">Last: {f.lastActivityDate}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.qualityStatus}</p>
                    <p className="text-xs text-muted-foreground italic">{f.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {!plan && !loading && (
        <div className="text-center py-12">
          <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Click <b>Generate AI Plan</b> to create your weekly action plan based on CRM activities and quality reports.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            The plan is cached weekly and shared with all users. It refreshes on Mondays.
          </p>
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Analyzing activities and quality data...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
        </div>
      )}
    </div>
  );
}
