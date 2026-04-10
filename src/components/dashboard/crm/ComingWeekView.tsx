import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Loader2, RefreshCw,
  ClipboardList, Phone, MapPin, AlertTriangle, Users,
  Target, CalendarCheck, UserCheck, PlusCircle, Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ExportPdfButton } from "@/components/dashboard/ExportPdfButton";
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
  urgentFarmVisits: { farmId: string; farmName: string; reason: string; suggestedUser: string; suggestedDay?: string; qualityIssues: string[]; priority: "critical" | "high" }[];
  overdueActivities: { activitySubject: string; farmName: string; assignedUser: string; daysOverdue: number; recommendation: string }[];
  userWorkloadAssessment: { userName: string; openTasks: number; completedRecently: number; completionRate: number; farmsCovered?: number; assessment: string; recommendation: string; suggestedSchedule?: string[] }[];
  suggestedNewActivities: { type: string; subject: string; farmName: string; suggestedUser: string; suggestedDay?: string; reason: string; priority: "critical" | "high" | "medium" }[];
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

/** Get the Saturday that starts a given YYWW week */
function weekNrToSaturday(wn: number): Date {
  const year = 2000 + Math.floor(wn / 100);
  const week = wn % 100;
  const jan1 = new Date(year, 0, 1);
  const jan1DaysSinceSat = (jan1.getDay() + 1) % 7;
  const week1Sat = new Date(jan1);
  week1Sat.setDate(jan1.getDate() - jan1DaysSinceSat);
  week1Sat.setHours(0, 0, 0, 0);
  const targetSat = new Date(week1Sat);
  targetSat.setDate(week1Sat.getDate() + (week - 1) * 7);
  return targetSat;
}

function getPlannerWeekLabel(weekNr: number, currentWeek: number): string {
  const saturday = weekNrToSaturday(weekNr);
  const monday = new Date(saturday);
  monday.setDate(saturday.getDate() + 2);
  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const year = friday.getFullYear();
  return `Week ${weekNr}${weekNr === currentWeek ? " (current)" : ""} (${fmt(monday)} – ${fmt(friday)} ${year})`;
}

function getWeekOptions(currentWeek: number): { value: number; label: string }[] {
  const options: { value: number; label: string }[] = [];
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  for (let i = 0; i <= 12; i++) {
    let year = Math.floor(currentWeek / 100);
    let week = (currentWeek % 100) - i;
    while (week < 1) {
      year -= 1;
      week += 52;
    }
    const wn = year * 100 + week;
    const sat = weekNrToSaturday(wn);
    const fri = new Date(sat);
    fri.setDate(sat.getDate() + 6);
    const range = `${fmt(sat)} – ${fmt(fri)}`;
    const label = i === 0 ? `Week ${wn} (current) ${range}` : `Week ${wn} (${i}w ago) ${range}`;
    options.push({ value: wn, label });
  }
  return options;
}

export function ComingWeekView({ allActivities, users, accounts, reports, activeUsers, onBack }: Props) {
  const currentWeek = getCurrentWeekNr();
  const [selectedWeek, setSelectedWeek] = useState<number>(() => currentWeek);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const lastCurrentWeekRef = useRef(currentWeek);

  const weekOptions = useMemo(() => getWeekOptions(currentWeek), [currentWeek]);
  const isCurrentWeek = selectedWeek === currentWeek;
  const displayWeekLabel = useMemo(() => getPlannerWeekLabel(selectedWeek, currentWeek), [selectedWeek, currentWeek]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  // Open tasks (To Do + In Progress)
  const openTasks = useMemo(() => {
    const fourWeeksAgo = Date.now() - 4 * 7 * 86400000;
    return allActivities
      .filter((a) => (a.status === "To Do" || a.status === "In Progress") && (a.createdAt || 0) >= fourWeeksAgo)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allActivities]);

  // Load cached plan for selected week
  const loadCached = useCallback(async (weekNr: number) => {
    const { data } = await supabase
      .from("weekly_plan_cache")
      .select("*")
      .eq("week_nr", weekNr)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data?.analysis) {
      const normalizedPlan = {
        ...(data.analysis as unknown as WeeklyPlan),
        weekLabel: getPlannerWeekLabel(weekNr, currentWeek),
      };
      setPlan(normalizedPlan);
      setCachedAt(data.created_at);
    } else {
      setPlan(null);
      setCachedAt(null);
    }
  }, [currentWeek]);

  useEffect(() => {
    const previousCurrentWeek = lastCurrentWeekRef.current;
    if (currentWeek !== previousCurrentWeek) {
      if (selectedWeek === previousCurrentWeek) {
        setPlan(null);
        setCachedAt(null);
        setSelectedWeek(currentWeek);
      }
      lastCurrentWeekRef.current = currentWeek;
    }
  }, [currentWeek, selectedWeek]);

  useEffect(() => {
    void loadCached(selectedWeek);
  }, [loadCached, selectedWeek]);

  // When week changes, load cached plan
  const handleWeekChange = useCallback((val: string) => {
    const wn = parseInt(val, 10);
    setSelectedWeek(wn);
    setPlan(null);
    setCachedAt(null);
  }, []);


  const buildPayload = useCallback(() => {
    const now = Date.now();

    // ALL activities — group by user, send ALL open items (compact format)
    const actByUser: Record<string, { open: any[]; recentCompleted: any[]; totalCompleted: number; totalAll: number; byStatus: Record<string, number>; byType: Record<string, number>; farmsCovered: Set<string> }> = {};
    for (const a of allActivities) {
      const uid = a.assignedUserId || a.ownerUserId || "unassigned";
      if (!actByUser[uid]) actByUser[uid] = { open: [], recentCompleted: [], totalCompleted: 0, totalAll: 0, byStatus: {}, byType: {}, farmsCovered: new Set() };
      const u = actByUser[uid];
      u.totalAll++;
      u.byStatus[a.status] = (u.byStatus[a.status] || 0) + 1;
      if (a.type) u.byType[a.type] = (u.byType[a.type] || 0) + 1;
      if (a.accountId) u.farmsCovered.add(a.accountId);

      if (a.status === "Completed") {
        u.totalCompleted++;
        const twoWeeksMs = 2 * 7 * 86400000;
        if ((a.completedAt || a.createdAt || 0) > now - twoWeeksMs) {
          u.recentCompleted.push({
            s: a.subject?.slice(0, 50),
            t: a.type?.[0], // T/V/C
            f: a.accountId ? accountMap.get(a.accountId) : undefined,
          });
        }
      } else if (a.status === "To Do" || a.status === "In Progress") {
        // ALL open items — ultra-compact format
        u.open.push({
          s: a.subject?.slice(0, 50),
          d: a.description?.slice(0, 60) || undefined,
          t: a.type?.[0], // T/V/C
          st: a.status === "In Progress" ? "IP" : "TD",
          f: a.accountId ? accountMap.get(a.accountId) : undefined,
          fid: a.accountId || undefined,
          age: a.createdAt ? Math.floor((now - a.createdAt) / 86400000) : undefined,
        });
      }
    }

    const activitySummary = Object.entries(actByUser)
      .filter(([uid]) => uid !== "unassigned")
      .map(([uid, data]) => ({
        uid,
        name: userMap.get(uid) || uid.slice(0, 8),
        open: data.open.length,
        done: data.totalCompleted,
        total: data.totalAll,
        rate: data.totalAll > 0 ? Math.round((data.totalCompleted / data.totalAll) * 100) : 0,
        farms: data.farmsCovered.size,
        items: data.open, // ALL open items, no cap
        recent: data.recentCompleted.slice(0, 5),
      }));

    // Quality reports — ALL available weeks, compact: only key metrics + notes
    const allWeeks = [...new Set(reports.map((r) => r.weekNr))].sort((a, b) => b - a);
    const recentWeeks = new Set(allWeeks.slice(0, 12)); // full 12 weeks
    const recentReports = reports.filter((r) => recentWeeks.has(r.weekNr));

    const byFarm: Record<string, any[]> = {};
    for (const r of recentReports) {
      const fid = r.farmAccountId;
      if (!byFarm[fid]) byFarm[fid] = [];
      // Only include non-null/non-zero values to save space
      const row: any = { w: r.weekNr };
      if (r.qrIntakePh) row.iPh = r.qrIntakePh;
      if (r.qrIntakeEc) row.iEc = r.qrIntakeEc;
      if (r.qrIntakeTempColdstore) row.iT = r.qrIntakeTempColdstore;
      if (r.qrIntakeHumidityColdstore) row.iH = r.qrIntakeHumidityColdstore;
      if (r.qrIntakeWaterQuality) row.iWQ = r.qrIntakeWaterQuality;
      if (r.qrExportPh) row.ePh = r.qrExportPh;
      if (r.qrExportEc) row.eEc = r.qrExportEc;
      if (r.qrExportTempColdstore) row.eT = r.qrExportTempColdstore;
      if (r.qrExportHumidityColdstore) row.eH = r.qrExportHumidityColdstore;
      if (r.qrExportWaterQuality) row.eWQ = r.qrExportWaterQuality;
      if (r.qrGenQualityRating) row.qR = r.qrGenQualityRating;
      const qn = trimNote(r.qrGenQualityFlowers, 120);
      const pn = trimNote(r.qrGenProtocolChanges, 120);
      const gc = trimNote(r.generalComment, 120);
      if (qn) row.qN = qn;
      if (pn) row.pN = pn;
      if (gc) row.gC = gc;
      byFarm[fid].push(row);
    }

    const qualitySummary = Object.entries(byFarm).map(([fid, weeks]) => ({
      fid,
      farm: accountMap.get(fid) || fid.slice(0, 8),
      n: weeks.length,
      wks: weeks.sort((a: any, b: any) => b.w - a.w),
    }));

    // Cross-reference: farms with quality reports but NO open activities
    const farmsWithReports = new Set(Object.keys(byFarm));
    const farmsWithOpenActivities = new Set<string>();
    for (const a of allActivities) {
      if ((a.status === "To Do" || a.status === "In Progress") && a.accountId) {
        farmsWithOpenActivities.add(a.accountId);
      }
    }
    const uncoveredFarms = [...farmsWithReports]
      .filter((fid) => !farmsWithOpenActivities.has(fid))
      .map((fid) => ({
        fid,
        farm: accountMap.get(fid) || fid.slice(0, 8),
      }));

    const userSummary = activeUsers.map((u) => ({
      id: u.id,
      name: u.name,
      pos: users.find((usr) => usr.id === u.id)?.position || undefined,
    }));

    const weekRange = {
      min: allWeeks.length > 0 ? allWeeks[allWeeks.length - 1] : undefined,
      max: allWeeks.length > 0 ? allWeeks[0] : undefined,
    };

    const currentWeekNr = getCurrentWeekNr();
    const sat = weekNrToSaturday(currentWeekNr);
    const monday = new Date(sat);
    monday.setDate(sat.getDate() + 2); // Saturday + 2 = Monday
    const friday = new Date(sat);
    friday.setDate(sat.getDate() + 6); // Saturday + 6 = Friday
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const today = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayDate = `${days[today.getDay()]} ${fmt(today)}`;
    const weekDates = `Monday ${fmt(monday)} – Friday ${fmt(friday)}`;

    return { activitySummary, qualitySummary, userSummary, weekRange, uncoveredFarms, todayDate, currentWeekNr, weekDates };
  }, [allActivities, reports, activeUsers, userMap, accountMap, users]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const payload = buildPayload();
      // Override the week number for the target week
      payload.currentWeekNr = selectedWeek;
      
      // For past weeks, adjust the date context
      if (!isCurrentWeek) {
        const currentWk = getCurrentWeekNr();
        const weekDiff = (Math.floor(currentWk / 100) * 52 + (currentWk % 100)) - (Math.floor(selectedWeek / 100) * 52 + (selectedWeek % 100));
        const targetMonday = new Date();
        const dayOfWeek = targetMonday.getDay();
        targetMonday.setDate(targetMonday.getDate() - ((dayOfWeek + 6) % 7) - (weekDiff * 7));
        const targetFriday = new Date(targetMonday);
        targetFriday.setDate(targetMonday.getDate() + 4);
        const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        payload.weekDates = `Monday ${fmt(targetMonday)} – Friday ${fmt(targetFriday)}`;
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        payload.todayDate = `${days[targetMonday.getDay()]} ${fmt(targetMonday)} (generated retrospectively)`;
      }

      const { data, error } = await supabase.functions.invoke("analyze-weekly-plan", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const analysis = data.analysis as WeeklyPlan;
      const normalizedPlan = {
        ...analysis,
        weekLabel: getPlannerWeekLabel(selectedWeek, currentWeek),
      };
      setPlan(normalizedPlan);

      // Cache it by selected week
      await supabase.from("weekly_plan_cache").delete().eq("week_nr", selectedWeek);
      await supabase.from("weekly_plan_cache").insert({ week_nr: selectedWeek, analysis: normalizedPlan as any });
      setCachedAt(new Date().toISOString());
      toast({ title: "Weekly plan generated", description: `Week ${selectedWeek} — ${activeUsers.length} team members` });
    } catch (e: any) {
      console.error("Weekly plan error:", e);
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [buildPayload, selectedWeek, isCurrentWeek]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to Board
        </Button>
        <Select value={String(selectedWeek)} onValueChange={handleWeekChange}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weekOptions.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Badge variant="secondary" className="text-[10px]">
          <Users className="h-3 w-3 mr-1" />
          {activeUsers.length} team members
        </Badge>
        {plan && (
          <ExportPdfButton targetRef={pdfRef} filename="weekly-plan" label="Export PDF" />
        )}
      </div>

      <div className="space-y-6">
      {/* Open tasks overview */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          Open Tasks ({openTasks.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
          {openTasks.map((a) => {
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

      {/* AI Plan — this is what gets exported to PDF */}
      {plan && (
        <div ref={pdfRef} className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Executive Summary */}
          <div data-pdf-section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
            <h3 className="text-sm font-bold text-primary mb-1 flex items-center gap-2">
              <Target className="h-4 w-4" />
              {displayWeekLabel}
            </h3>
            <p className="text-sm text-foreground leading-relaxed">{plan.executiveSummary}</p>
          </div>

          {/* Weekly Focus */}
          <div data-pdf-section className="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <h4 className="text-xs font-bold text-accent uppercase tracking-wider mb-1">🎯 Weekly Focus</h4>
            <p className="text-sm text-foreground">{plan.weeklyFocus}</p>
          </div>

          {/* Urgent Farm Visits */}
          {plan.urgentFarmVisits?.length > 0 && (
            <div data-pdf-section>
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
                        {v.suggestedDay && <Badge variant="secondary" className="text-[10px]">{v.suggestedDay}</Badge>}
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
            <div data-pdf-section>
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
                      {u.farmsCovered !== undefined && <span>Farms: <b className="text-foreground">{u.farmsCovered}</b></span>}
                    </div>
                    <p className="text-xs text-muted-foreground italic mb-1">{u.recommendation}</p>
                    {u.suggestedSchedule && u.suggestedSchedule.length > 0 && (
                      <div className="mt-2 pl-2 border-l-2 border-primary/20 space-y-0.5">
                        {u.suggestedSchedule.map((item, j) => (
                          <p key={j} className="text-[11px] text-foreground">{item}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested New Activities */}
          {plan.suggestedNewActivities?.length > 0 && (
            <div data-pdf-section>
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
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-medium text-sm">{a.subject}</span>
                            <Badge variant="outline" className="text-[9px]">{a.priority}</Badge>
                            {a.suggestedDay && <Badge variant="secondary" className="text-[9px]">{a.suggestedDay}</Badge>}
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
            <div data-pdf-section>
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
            <div data-pdf-section>
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
        </div>
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
    </div>
  );
}
