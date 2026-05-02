import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Loader2, RefreshCw,
  ClipboardList, Phone, MapPin, AlertTriangle, Users,
  Target, CalendarCheck, UserCheck, PlusCircle, Eye,
  TrendingUp, ExternalLink, ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SharePageButton } from "@/components/SharePageButton";
import { useVaselifeHeaders, useAllVaselifeMeasurements, type VaselifeHeader } from "@/hooks/useVaselifeTrials";
import { VaselifeTrialDetail } from "@/components/trials/VaselifeTrialDetail";
import { computeConcludedDate } from "@/lib/trialConcluded";
import { ActivityDialog } from "@/components/dashboard/ActivityDialog";
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

function getWeekNrForDate(date: Date, mode: "local" | "utc" = "local"): number {
  const getDay = (value: Date) => (mode === "utc" ? value.getUTCDay() : value.getDay());
  const getDateValue = (value: Date) => (mode === "utc" ? value.getUTCDate() : value.getDate());
  const getFullYear = (value: Date) => (mode === "utc" ? value.getUTCFullYear() : value.getFullYear());
  const setDateValue = (value: Date, nextDate: number) => {
    if (mode === "utc") value.setUTCDate(nextDate);
    else value.setDate(nextDate);
  };
  const setStartOfDay = (value: Date) => {
    if (mode === "utc") value.setUTCHours(0, 0, 0, 0);
    else value.setHours(0, 0, 0, 0);
  };

  const daysSinceSat = (getDay(date) + 1) % 7;
  const currentSat = new Date(date);
  setDateValue(currentSat, getDateValue(date) - daysSinceSat);
  setStartOfDay(currentSat);

  const jan1 = mode === "utc"
    ? new Date(Date.UTC(getFullYear(currentSat), 0, 1))
    : new Date(getFullYear(currentSat), 0, 1);
  const jan1DaysSinceSat = (getDay(jan1) + 1) % 7;
  const week1Sat = new Date(jan1);
  setDateValue(week1Sat, getDateValue(jan1) - jan1DaysSinceSat);
  setStartOfDay(week1Sat);

  const weekNum = Math.floor((currentSat.getTime() - week1Sat.getTime()) / (7 * 86400000)) + 1;
  const year = getFullYear(currentSat) % 100;
  return year * 100 + weekNum;
}

function getCurrentWeekNr(): number {
  return getWeekNrForDate(new Date());
}

function parseBackendTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;

  const normalized = value.trim().replace(" ", "T");
  const dateTimeMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/,
  );

  if (dateTimeMatch) {
    const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw = "00", fractionRaw = "", tzRaw = "Z"] = dateTimeMatch;
    const milliseconds = Number(fractionRaw.padEnd(3, "0").slice(0, 3) || "0");
    let utcMs = Date.UTC(
      Number(yearRaw),
      Number(monthRaw) - 1,
      Number(dayRaw),
      Number(hourRaw),
      Number(minuteRaw),
      Number(secondRaw),
      milliseconds,
    );

    if (tzRaw !== "Z") {
      const tzMatch = tzRaw.match(/^([+-])(\d{2})(?::?(\d{2}))?$/);
      if (!tzMatch) return null;
      const [, sign, hoursRaw, minutesRaw = "00"] = tzMatch;
      const offsetMinutes = Number(hoursRaw) * 60 + Number(minutesRaw);
      utcMs += (sign === "+" ? -1 : 1) * offsetMinutes * 60000;
    }

    const result = new Date(utcMs);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, yearRaw, monthRaw, dayRaw] = dateOnlyMatch;
    const result = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw)));
    return Number.isNaN(result.getTime()) ? null : result;
  }

  return null;
}

function firstRow<T>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
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
  commercialFollowups?: {
    trialId: string;
    trialNumber: string;
    farmName: string;
    customer?: string;
    keyProduct: string;
    trialDate: string;
    reason: string;
  }[];
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

function getWeekBusinessDates(weekNr: number) {
  const saturday = weekNrToSaturday(weekNr);
  const monday = new Date(saturday);
  monday.setDate(saturday.getDate() + 2);
  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() + 6);
  return { saturday, monday, friday };
}

function getPlannerWeekLabel(weekNr: number, currentWeek: number): string {
  const { monday, friday } = getWeekBusinessDates(weekNr);
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
    const { saturday, friday } = getWeekBusinessDates(wn);
    const range = `${fmt(saturday)} – ${fmt(friday)}`;
    const label = i === 0 ? `Week ${wn} (current) ${range}` : `Week ${wn} (${i}w ago) ${range}`;
    options.push({ value: wn, label });
  }
  return options;
}

export function ComingWeekView({ allActivities, users, accounts, reports, activeUsers, onBack }: Props) {
  const [currentWeek, setCurrentWeek] = useState<number>(() => getCurrentWeekNr());
  const [selectedWeek, setSelectedWeek] = useState<number>(() => getCurrentWeekNr());
  const [referenceNow, setReferenceNow] = useState<Date | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const lastCurrentWeekRef = useRef(currentWeek);
  const resolvedCurrentWeek = useMemo(
    () => (referenceNow ? getWeekNrForDate(referenceNow, "utc") : currentWeek),
    [referenceNow, currentWeek],
  );

  const weekOptions = useMemo(() => getWeekOptions(resolvedCurrentWeek), [resolvedCurrentWeek]);
  const isCurrentWeek = selectedWeek === resolvedCurrentWeek;
  const displayWeekLabel = useMemo(
    () => getPlannerWeekLabel(selectedWeek, resolvedCurrentWeek),
    [selectedWeek, resolvedCurrentWeek],
  );

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const { data: trials = [] } = useVaselifeHeaders();
  const { data: allMeasurements = [] } = useAllVaselifeMeasurements();
  const concludedByTrial = useMemo(() => {
    const byHeader = new Map<string, number>();
    for (const m of allMeasurements) {
      const d = m.observation_days;
      if (typeof d !== "number" || !Number.isFinite(d)) continue;
      const cur = byHeader.get(m.id_header) ?? 0;
      if (d > cur) byHeader.set(m.id_header, d);
    }
    const out = new Map<string, string | null>();
    for (const t of trials) {
      const maxDays = byHeader.get(t.id) ?? 0;
      const ms: { observation_days: number | null }[] = maxDays > 0 ? [{ observation_days: maxDays }] : [];
      out.set(t.id, computeConcludedDate(t, ms));
    }
    return out;
  }, [trials, allMeasurements]);
  const [selectedTrial, setSelectedTrial] = useState<VaselifeHeader | null>(null);
  const [activityFarm, setActivityFarm] = useState<{ id: string; name: string } | null>(null);
  const [passedOpen, setPassedOpen] = useState(false);

  // Resolve a free-text farm name (from trials/AI) to an Account id, then open ActivityDialog.
  const openFarmActivity = useCallback((farmName: string | null | undefined, knownId?: string | null) => {
    if (!farmName && !knownId) return;
    let id = knownId || "";
    if (!id && farmName) {
      const norm = farmName.trim().toLowerCase();
      id = accounts.find((a) => a.name?.toLowerCase() === norm)?.id || "";
    }
    if (!id) {
      toast({ title: "Farm not found", description: `No matching account for "${farmName}"`, variant: "destructive" });
      return;
    }
    setActivityFarm({ id, name: farmName || accountMap.get(id) || "Farm" });
  }, [accounts, accountMap]);

  // Commercial trials that DO have post-trial CRM follow-up — for review.
  const passedFollowups = useMemo(() => {
    // Aggressive stop-list: drop generic flower/trial/farm vocabulary so we
    // only match on truly distinctive product/treatment names.
    const STOP = new Set([
      "the","and","for","with","this","that","from","have","has","was","were","will","not","but","you","our","are","any","all","into","per","its","use","one","two","they","them","very","good","more","also","than","then","over","under","like","when","what","which","while","where","there","their","these","those","been","being","both","each","other","some","such","only","just","much","many","most","same","than","upon","still","after","before","during","because",
      // domain-generic
      "trial","trials","test","tests","testing","commercial","repeat","control","treatment","treatments","recommend","recommended","recommendation","recommendations","conclusion","conclusions","observation","observations","result","results","performance","performed","performs","quality","good","better","best","superior","preferred","preferable","reliable","alternative","option","options","value","extended","shelf","life","vase","life","customer","customers","farm","farms","standard","spray","rose","roses","flower","flowers","stem","stems","variety","varieties","cultivar","cultivars","crop","crops","day","days","week","weeks","year","years","season","seasonal","botrytis","disease","control","mildew","powdery","application","applications","applied","apply","applying","follow","followup","follow-up","action","visit","visits","report","reports","note","notes","field","greenhouse","grower","growers","client","clients","sales","market","marketing","product","products","dose","dosage","rate","rates","mls","mlsl","mils","ppm","percent","percentage",
    ]);
    const extractKw = (text: string): string[] => {
      const tokens = (text.toLowerCase().match(/[a-z][a-z0-9\-+/]{3,}/g) || [])
        .filter((t) => !STOP.has(t) && !/^\d+$/.test(t) && t.length >= 4);
      return Array.from(new Set(tokens));
    };
    // Heuristic: a "distinctive product/brand" looks like a brand-ish token —
    // contains a digit, a slash, or a capital letter run, OR matches a known
    // Chrysal/competitor brand stem.
    const BRAND_RX = /^(gvb|avb|svb|cvb|chrysal|professional|clear|rva|bulb|botreat|vident|gatten|rosedip|rose-dip|rose_dip|supreme|t-bag|finalin|ethybloc|ethylene|opti|rosa|t-bag|pf|pfn|pfnl)/i;
    const isDistinctive = (kw: string): boolean => {
      if (BRAND_RX.test(kw)) return true;
      if (/\d/.test(kw)) return true; // contains a digit, e.g. "5ec", "p2", "gvb1"
      if (/[-+/]/.test(kw)) return true; // hyphen/slash typical of product names
      return false;
    };

    const out: Array<{
      trialId: string; trialNumber: string; farmName: string; customer?: string;
      trialDate: string | null; keyProduct: string;
      activities: Array<{ id: string; date: string | null; subject: string; description: string; type: string }>;
    }> = [];
    for (const t of trials) {
      const rec = (t.recommendations || "").trim();
      if (!rec) continue;
      if (/repeat/i.test(rec)) continue;
      if (!t.farm) continue;
      const trialDate = concludedByTrial.get(t.id) || t.start_vl || t.harvest_date || null;
      // For "passed follow-ups" we only count activity AFTER the trial concluded.
      // Activities during the trial setup/run are part of the trial itself, not follow-up.
      const concludedMs = trialDate ? Date.parse(trialDate) : 0;
      if (!concludedMs) continue;
      const farmNameNorm = t.farm.toLowerCase();
      const farmAccountId = accounts.find((a) => a.name?.toLowerCase() === farmNameNorm)?.id;
      // Hard requirement: the trial's farm must map to a real Account in the
      // CRM. Without that link, any "matches" against free-text subject/
      // description fields are unreliable (different farms can share tokens
      // like "Kariki" or "EMF" and produce phantom follow-ups). Skip entirely.
      if (!farmAccountId) continue;
      // Only mine the recommendation text — that's where the actionable
      // product name lives. The conclusion often repeats generic vocabulary.
      const allKw = extractKw(rec);
      const distinctiveKw = allKw.filter(isDistinctive);
      // If no distinctive product token can be found, don't try to match —
      // we'd just generate false positives.
      if (distinctiveKw.length === 0) continue;

      const farmActivities = allActivities.filter((a) => a.accountId === farmAccountId);
      const hits = farmActivities.filter((a) => {
        const aDate = a.completedAt || a.createdAt || 0;
        if (aDate <= concludedMs) return false;
        const hay = `${a.subject || ""} ${a.description || ""}`.toLowerCase();
        // Require a distinctive product token to appear — generic words don't count.
        return distinctiveKw.some((k) => hay.includes(k));
      });
      if (hits.length === 0) continue;

      // Dedupe near-identical activities by normalized subject+description.
      const seen = new Set<string>();
      const uniqueHits = hits
        .sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0))
        .filter((a) => {
          const sig = `${(a.subject || "").trim().toLowerCase()}|${(a.description || "").trim().toLowerCase().slice(0, 200)}`;
          if (seen.has(sig)) return false;
          seen.add(sig);
          return true;
        });

      const keyProduct = distinctiveKw[0] || "product";
      out.push({
        trialId: t.id,
        trialNumber: t.trial_number || t.id.slice(0, 8),
        farmName: t.farm,
        customer: t.customer || undefined,
        trialDate,
        keyProduct,
        activities: uniqueHits.slice(0, 5).map((a) => ({
          id: a.id,
          date: a.completedAt ? new Date(a.completedAt).toISOString() : (a.createdAt ? new Date(a.createdAt).toISOString() : null),
          subject: a.subject || "",
          description: a.description || "",
          type: a.type || "",
        })),
      });
    }
    return out.sort((a, b) => (b.trialDate || "").localeCompare(a.trialDate || ""));
  }, [trials, allActivities, accounts, concludedByTrial]);

  // Set of trialIds that have moved into "Passed follow-ups" (i.e., a follow-up
  // activity now exists). Used to evict them from the active commercial
  // follow-up list, even if the cached AI plan still listed them.
  const passedTrialIds = useMemo(
    () => new Set(passedFollowups.map((p) => p.trialId).filter(Boolean)),
    [passedFollowups],
  );

  useEffect(() => {
    let active = true;

    const resolveCurrentWeekFromServer = async () => {
      const [latestLoginResult, latestPlanResult] = await Promise.all([
        supabase.from("login_logs").select("logged_in_at").order("logged_in_at", { ascending: false }).limit(1),
        supabase.from("weekly_plan_cache").select("created_at").order("created_at", { ascending: false }).limit(1),
      ]);

      if (!active) return;

      const latestLogin = firstRow(latestLoginResult.data);
      const latestPlan = firstRow(latestPlanResult.data);

      const latestServerDate = [latestLogin?.logged_in_at ?? null, latestPlan?.created_at ?? null]
        .map(parseBackendTimestamp)
        .filter((value): value is Date => Boolean(value) && !Number.isNaN(value.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      if (!latestServerDate) return;

      setReferenceNow(latestServerDate);
      setCurrentWeek(getWeekNrForDate(latestServerDate, "utc"));
    };

    void resolveCurrentWeekFromServer();

    return () => {
      active = false;
    };
  }, []);

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
      let effectiveCurrentWeek = resolvedCurrentWeek;

      if (data.created_at) {
        const cachedCreatedAt = parseBackendTimestamp(data.created_at);
        if (cachedCreatedAt) {
          setReferenceNow((prev) => (!prev || cachedCreatedAt.getTime() > prev.getTime() ? cachedCreatedAt : prev));
          const inferredWeek = getWeekNrForDate(cachedCreatedAt, "utc");
          setCurrentWeek((prev) => (inferredWeek > prev ? inferredWeek : prev));
          effectiveCurrentWeek = Math.max(effectiveCurrentWeek, inferredWeek);
        }
      }

      const normalizedPlan = {
        ...(data.analysis as unknown as WeeklyPlan),
        weekLabel: getPlannerWeekLabel(weekNr, effectiveCurrentWeek),
      };
      setPlan(normalizedPlan);
      setCachedAt(data.created_at);
    } else {
      setPlan(null);
      setCachedAt(null);
    }
  }, [resolvedCurrentWeek]);

  useEffect(() => {
    const previousCurrentWeek = lastCurrentWeekRef.current;
    if (resolvedCurrentWeek !== previousCurrentWeek) {
      if (selectedWeek === previousCurrentWeek) {
        setPlan(null);
        setCachedAt(null);
        setSelectedWeek(resolvedCurrentWeek);
      }
      lastCurrentWeekRef.current = resolvedCurrentWeek;
    }
  }, [resolvedCurrentWeek, selectedWeek]);

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

    const plannerWeekNr = referenceNow ? getWeekNrForDate(referenceNow, "utc") : resolvedCurrentWeek;
    const sat = weekNrToSaturday(plannerWeekNr);
    const monday = new Date(sat);
    monday.setDate(sat.getDate() + 2); // Saturday + 2 = Monday
    const friday = new Date(sat);
    friday.setDate(sat.getDate() + 6); // Saturday + 6 = Friday
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const today = referenceNow ?? new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayDate = `${days[today.getDay()]} ${fmt(today)}`;
    const weekDates = `Monday ${fmt(monday)} – Friday ${fmt(friday)}`;

    // === Commercial trial follow-ups ===
    // For every trial whose Next Step = "Commercial" (i.e., recommendation does
    // NOT contain the word "repeat"), check whether there has been any CRM
    // activity on that farm since the trial's start_vl date that mentions a
    // distinctive product/keyword from the trial's recommendation. If not,
    // surface it so the team can plan a sales follow-up.
    //
    // This is a coarse pre-filter — the AI then makes the final call.
    const STOP_WORDS = new Set([
      "the","and","for","with","from","this","that","have","been","were","was","will","into","over","than","then","also","such","very","more","most","some","each","other","their","them","they","there","these","those","when","what","who","how","why","may","can","not","but","are","you","your","our","its","use","used","using","good","best","better",
      "trial","trials","test","tests","testing","commercial","repeat","control","treatment","treatments","recommend","recommended","recommendation","recommendations","conclusion","conclusions","observation","observations","result","results","performance","quality","superior","preferred","preferable","reliable","alternative","option","options","value","extended","shelf","life","vase","customer","customers","farm","farms","standard","spray","rose","roses","flower","flowers","stem","stems","variety","varieties","cultivar","cultivars","crop","crops","day","days","week","weeks","year","years","season","botrytis","disease","mildew","powdery","application","applications","applied","apply","follow","followup","action","visit","visits","report","reports","note","notes","field","greenhouse","grower","growers","client","clients","sales","market","product","products","dose","dosage","rate","rates","mls","percent","percentage","mar","apr","may","jun","jul","aug","sep","oct","nov","dec","jan","feb",
    ]);
    const extractKeywords = (text: string | null | undefined): string[] => {
      if (!text) return [];
      const tokens = (text.toLowerCase().match(/[a-z][a-z0-9\-+/]{3,}/g) || [])
        .filter((t) => !STOP_WORDS.has(t) && !/^\d+$/.test(t) && t.length >= 4);
      return Array.from(new Set(tokens));
    };
    const BRAND_RX = /^(gvb|avb|svb|cvb|chrysal|professional|clear|rva|bulb|botreat|vident|gatten|rosedip|rose-dip|rose_dip|supreme|finalin|ethybloc|ethylene|opti|rosa|pf|pfn|pfnl)/i;
    const isDistinctive = (kw: string): boolean =>
      BRAND_RX.test(kw) || /\d/.test(kw) || /[-+/]/.test(kw);

    const commercialTrials: any[] = [];
    for (const t of trials) {
      const rec = (t.recommendations || "").trim();
      if (!rec) continue;
      // "Repeat" trials are excluded — only Commercial ones (same logic as Trials Dashboard column)
      if (/repeat/i.test(rec)) continue;
      if (!t.farm) continue;

      const trialDate = concludedByTrial.get(t.id) || t.start_vl || t.harvest_date || null;
      const trialDateMs = trialDate ? Date.parse(trialDate) : 0;
      const concludedMs = trialDateMs;
      const farmName = t.farm;
      const farmNameNorm = farmName.toLowerCase();

      // Find activities for this farm (match by accountMap name — trial.farm
      // is a free-text name from Plantscout, so we match against account names).
      const farmAccountId = accounts.find((a) => a.name?.toLowerCase() === farmNameNorm)?.id;
      // Skip trials whose farm cannot be linked to a real CRM Account —
      // free-text substring matching produces phantom follow-ups.
      if (!farmAccountId) continue;

      // Distinctive product keywords from the recommendation only — those
      // are the actionable terms a sales follow-up would mention.
      const allKeywords = extractKeywords(rec);
      const distinctiveKeywords = allKeywords.filter(isDistinctive);
      const keywords = distinctiveKeywords;

      const farmActivities = allActivities.filter((a) => a.accountId === farmAccountId);

      // If we have no distinctive keywords, treat as 0 hits → keeps trial in
      // the "needs follow-up" list (safer than spuriously matching generic words).
      const followupHits = keywords.length === 0 ? 0 : farmActivities
        .filter((a) => {
          const aDate = a.completedAt || a.createdAt || 0;
          if (concludedMs && aDate <= concludedMs) return false;
          const hay = `${a.subject || ""} ${a.description || ""}`.toLowerCase();
          return keywords.some((k) => hay.includes(k));
        })
        .length;

      commercialTrials.push({
        id: t.id,
        no: t.trial_number || t.id.slice(0, 8),
        farm: farmName,
        cust: t.customer || undefined,
        crop: t.crop || undefined,
        date: trialDate,
        rec: rec.slice(0, 220),
        concl: (t.conclusion || "").slice(0, 220) || undefined,
        kw: keywords.slice(0, 8),
        followupHits,
      });
    }
    // Only send trials that have NO follow-up evidence — the section's purpose.
    const commercialFollowupCandidates = commercialTrials
      .filter((c) => c.followupHits === 0)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 25);

    return { activitySummary, qualitySummary, userSummary, weekRange, uncoveredFarms, todayDate, currentWeekNr: plannerWeekNr, weekDates, commercialFollowupCandidates };
  }, [allActivities, reports, activeUsers, userMap, accountMap, users, accounts, trials, referenceNow, resolvedCurrentWeek, concludedByTrial]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const payload = buildPayload();
      // Override the week number for the target week
      payload.currentWeekNr = selectedWeek;
      
      // For past weeks, adjust the date context using weekNrToSaturday
      if (!isCurrentWeek) {
        const targetSat = weekNrToSaturday(selectedWeek);
        const targetMonday = new Date(targetSat);
        targetMonday.setDate(targetSat.getDate() + 2);
        const targetFriday = new Date(targetSat);
        targetFriday.setDate(targetSat.getDate() + 6);
        const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        payload.weekDates = `Monday ${fmt(targetMonday)} – Friday ${fmt(targetFriday)}`;
        payload.todayDate = `Monday ${fmt(targetMonday)} (generated retrospectively)`;
      }

      const { data, error } = await supabase.functions.invoke("analyze-weekly-plan", { body: payload });
      if (error) {
        // FunctionsHttpError swallows the body; try to extract real reason
        let detail = error.message || "Edge function failed";
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.text === "function") {
            const body = await ctx.text();
            try {
              const j = JSON.parse(body);
              if (j?.error) detail = j.error;
            } catch {
              if (body) detail = body.slice(0, 300);
            }
          }
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      const analysis = data.analysis as WeeklyPlan;
      const normalizedPlan = {
        ...analysis,
        weekLabel: getPlannerWeekLabel(selectedWeek, resolvedCurrentWeek),
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
  }, [activeUsers.length, buildPayload, selectedWeek, isCurrentWeek, resolvedCurrentWeek]);

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
          <SharePageButton
            pageType="weekly_plan"
            getPayload={() => ({
              weekLabel: weekOptions.find((o) => String(o.value) === String(selectedWeek))?.label,
              plan,
            })}
          />
        )}
      </div>

      <div className="space-y-6">
      {/* Commercial trial follow-ups — sales opportunities with no recent CRM mention */}
      {((plan?.commercialFollowups && plan.commercialFollowups.length > 0) || passedFollowups.length > 0) && (
        <div data-pdf-section>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            Commercial Trial Follow-ups ({plan?.commercialFollowups?.length ?? 0})
            <span className="text-[10px] font-normal normal-case text-muted-foreground/80">
              · Successful trials with no sales follow-up yet
            </span>
          </h4>
          {plan?.commercialFollowups && plan.commercialFollowups.length > 0 ? (
            <div className="space-y-2">
              {plan.commercialFollowups.map((c, i) => (
                <motion.div
                  key={c.trialId || i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-lg border border-accent/30 bg-accent/5 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => openFarmActivity(c.farmName)} className="font-semibold text-sm text-primary hover:underline">{c.farmName}</button>
                      {c.customer && (
                        <Badge variant="outline" className="text-[10px]">{c.customer}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700 dark:text-emerald-300">Commercial</Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.keyProduct}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.trialDate && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.trialDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const t = trials.find((x) => x.id === c.trialId || (x.trial_number || "").toLowerCase() === (c.trialNumber || "").toLowerCase());
                          if (t) setSelectedTrial(t);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        Trial {c.trialNumber}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-foreground/90">{c.reason}</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              No new commercial trials need a sales follow-up right now.
            </p>
          )}

          {/* Passed follow-ups — collapsible review of commercial trials that DO have post-trial CRM activity */}
          {passedFollowups.length > 0 && (
            <Collapsible open={passedOpen} onOpenChange={setPassedOpen} className="mt-3">
              <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${passedOpen ? "rotate-180" : ""}`} />
                Passed follow-ups ({passedFollowups.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {passedFollowups.map((p, i) => (
                  <div
                    key={p.trialId || i}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    {(() => {
                      const headerTrial = trials.find((x) => x.id === p.trialId || (x.trial_number || "").toLowerCase() === (p.trialNumber || "").toLowerCase());
                      const isRepeat = /repeat/i.test(headerTrial?.recommendations || "");
                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button type="button" onClick={() => openFarmActivity(p.farmName)} className="font-semibold text-sm text-primary hover:underline">{p.farmName}</button>
                          {p.customer && (
                            <Badge variant="outline" className="text-[10px]">{p.customer}</Badge>
                          )}
                          {isRepeat ? (
                            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300">Repeat</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700 dark:text-emerald-300">Commercial</Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">{p.keyProduct}</Badge>
                        </div>
                      );
                    })()}
                      <div className="flex items-center gap-1.5">
                        {p.trialDate && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(p.trialDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const t = trials.find((x) => x.id === p.trialId || (x.trial_number || "").toLowerCase() === (p.trialNumber || "").toLowerCase());
                            if (t) setSelectedTrial(t);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                        >
                          Trial {p.trialNumber}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {(() => {
                        const items: Array<{ kind: "activity" | "trial"; date: number; node: JSX.Element }> = [];
                        p.activities.forEach((a, j) => {
                          const ts = a.date ? Date.parse(a.date) : 0;
                          items.push({
                            kind: "activity",
                            date: ts,
                            node: (
                              <div key={`a-${j}`} className="text-[11px] text-foreground/85 border-l-2 border-emerald-500/40 pl-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {a.date && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(a.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                    </span>
                                  )}
                                  {a.type && <Badge variant="outline" className="text-[9px] py-0">{a.type}</Badge>}
                                  {a.subject && <span className="font-medium">{a.subject}</span>}
                                </div>
                                {a.description && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                                )}
                              </div>
                            ),
                          });
                        });
                        if (p.trialDate) {
                          const ts = Date.parse(p.trialDate);
                          const trial = trials.find((x) => x.id === p.trialId);
                          items.push({
                            kind: "trial",
                            date: ts,
                            node: (
                              <button
                                key="trial-result"
                                type="button"
                                onClick={() => trial && setSelectedTrial(trial)}
                                className="w-full text-left text-[11px] border-l-2 border-primary/60 bg-primary/5 hover:bg-primary/10 transition-colors pl-2 py-1 rounded-r"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(p.trialDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] py-0 border-primary/50 text-primary">Trial result</Badge>
                                  {/repeat/i.test(trial?.recommendations || "") ? (
                                    <Badge variant="outline" className="text-[9px] py-0 border-amber-400 text-amber-700 dark:text-amber-300">Repeat</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] py-0 border-emerald-500 text-emerald-700 dark:text-emerald-300">Commercial</Badge>
                                  )}
                                  <span className="font-medium">Trial {p.trialNumber} concluded</span>
                                </div>
                                {trial?.recommendations && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{trial.recommendations}</p>
                                )}
                              </button>
                            ),
                          });
                        }
                        items.sort((a, b) => b.date - a.date);
                        return items.map((it) => it.node);
                      })()}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

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
                    {farmName && (
                      <button type="button" onClick={() => openFarmActivity(farmName, a.accountId)} className="text-[10px] text-primary hover:underline">{farmName}</button>
                    )}
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
                      <button type="button" onClick={() => openFarmActivity(v.farmName, v.farmId)} className="font-semibold text-sm text-primary hover:underline">{v.farmName}</button>
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
                            <button type="button" onClick={() => openFarmActivity(a.farmName)} className="text-primary hover:underline">{a.farmName}</button>
                            {" "}· Assign to <b>{a.suggestedUser}</b>
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <button type="button" onClick={() => openFarmActivity(a.farmName)} className="text-primary hover:underline">{a.farmName}</button>
                      {" · "}{a.assignedUser}
                    </p>
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
                      <button type="button" onClick={() => openFarmActivity(f.farmName, f.farmId)} className="font-medium text-sm text-primary hover:underline">{f.farmName}</button>
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
      <VaselifeTrialDetail
        trial={selectedTrial}
        open={!!selectedTrial}
        onOpenChange={(o) => { if (!o) setSelectedTrial(null); }}
      />
      <ActivityDialog
        open={!!activityFarm}
        onOpenChange={(o) => { if (!o) setActivityFarm(null); }}
        farmId={activityFarm?.id || ""}
        farmName={activityFarm?.name || ""}
        activities={allActivities}
        users={users}
        analysis={null}
      />
    </div>
  );
}
