import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { ExportPdfButton } from "@/components/dashboard/ExportPdfButton";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { QualityReport, Account, Activity, User, Container, ServicesOrder, ShipperArrival, ShipperReport } from "@/lib/csvParser";
import type { SFTrip } from "@/pages/ActiveSF";

interface CustomerScope {
  isCustomer: boolean;
  allowedFarmIds: string[];
  allowedOrderIds: string[];
  customerAccountId?: string;
}

interface AIAgentProps {
  reports: QualityReport[];
  accounts: Account[];
  activities?: Activity[];
  users?: User[];
  exceptionAnalysis?: any;
  seasonalityAnalysis?: any;
  containers?: Container[];
  servicesOrders?: ServicesOrder[];
  shipperArrivals?: ShipperArrival[];
  shipperReports?: ShipperReport[];
  sfTrips?: SFTrip[];
  customerScope?: CustomerScope;
}

type Msg = { role: "user" | "assistant"; content: string };

const SAMPLE_QUESTIONS = [
  "Which farms show consistently high pH at intake?",
  "Which farms show consistently high temperatures at export cold storage?",
  "Please create a table showing all farms and their average stem lengths",
  "Which farms have the highest variations in quality rating?",
  "Were actions taken by the team based on the week planner of two weeks ago?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;

/** Strip null/undefined/empty values to reduce JSON size */
function compact(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== "") result[k] = v;
  }
  return result;
}

/** Pre-aggregated CRM activity counts by user × type × status, with yearly breakdown */
function buildActivitySummary(activities: Activity[], users: User[]) {
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  interface UserStats { name: string; visits: number; calls: number; tasks: number; completed: number; open: number; total: number }
  const newStats = (): UserStats => ({ name: "", visits: 0, calls: 0, tasks: 0, completed: 0, open: 0, total: 0 });

  const addActivity = (s: UserStats, a: Activity) => {
    s.total++;
    const typeLower = (a.type || "").toLowerCase();
    if (typeLower === "visit") s.visits++;
    else if (typeLower === "call") s.calls++;
    else if (typeLower === "task") s.tasks++;
    const statusLower = (a.status || "").toLowerCase();
    if (statusLower === "completed") s.completed++;
    else s.open++;
  };

  // Overall totals by user
  const byUser = new Map<string, UserStats>();
  // Per-year totals by user (key: "userId|year")
  const byUserYear = new Map<string, UserStats>();

  for (const a of activities) {
    const uid = a.assignedUserId || a.ownerUserId;
    if (!uid) continue;
    const name = userMap.get(uid) || uid.slice(0, 8);

    // Overall
    if (!byUser.has(uid)) { const s = newStats(); s.name = name; byUser.set(uid, s); }
    addActivity(byUser.get(uid)!, a);

    // By year (use startsAt or createdAt to determine year)
    const ts = a.startsAt || a.createdAt;
    if (ts) {
      const year = new Date(ts).getFullYear();
      const key = `${uid}|${year}`;
      if (!byUserYear.has(key)) { const s = newStats(); s.name = name; byUserYear.set(key, s); }
      addActivity(byUserYear.get(key)!, a);
    }
  }

  // Build yearly breakdown grouped by year
  const yearlyByUser: Record<number, UserStats[]> = {};
  for (const [key, stats] of byUserYear) {
    const year = parseInt(key.split("|")[1]);
    if (!yearlyByUser[year]) yearlyByUser[year] = [];
    yearlyByUser[year].push(stats);
  }
  for (const year of Object.keys(yearlyByUser)) {
    yearlyByUser[parseInt(year)].sort((a, b) => b.total - a.total);
  }

  return {
    totalActivities: activities.length,
    byUser: Array.from(byUser.values()).sort((a, b) => b.total - a.total),
    byYear: yearlyByUser,
  };
}

/** Pre-aggregated staff report counts for attribution questions */
function buildStaffSummary(reports: QualityReport[], users: User[]) {
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const counts = new Map<string, { name: string; created: number; submitted: number; farms: Set<string> }>();

  for (const r of reports) {
    if (r.weekNr <= 0) continue;
    const userId = r.createdByUserId || r.submittedByUserId;
    if (!userId) continue;
    if (!counts.has(userId)) {
      counts.set(userId, { name: userMap.get(userId) || userId, created: 0, submitted: 0, farms: new Set() });
    }
    const entry = counts.get(userId)!;
    if (r.createdByUserId === userId) entry.created++;
    if (r.submittedByUserId === userId) entry.submitted++;
    entry.farms.add(r.farmAccountId);
  }

  return Array.from(counts.values())
    .map((e) => ({ name: e.name, reportsCreated: e.created, reportsSubmitted: e.submitted, farmsCount: e.farms.size }))
    .sort((a, b) => b.reportsCreated - a.reportsCreated);
}

function buildFarmDataContext(reports: QualityReport[], accounts: Account[], users: User[]) {
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const byFarm = new Map<string, QualityReport[]>();

  for (const r of reports) {
    if (r.weekNr <= 0) continue;
    if (!byFarm.has(r.farmAccountId)) byFarm.set(r.farmAccountId, []);
    byFarm.get(r.farmAccountId)!.push(r);
  }

  const summaries: any[] = [];
  for (const [farmId, farmReports] of byFarm) {
    const sorted = [...farmReports].sort((a, b) => a.weekNr - b.weekNr);
    summaries.push({
      farmId,
      farm: accountMap.get(farmId) || farmId,
      d: sorted.map((r) => compact({
        w: r.weekNr,
        iPh: r.qrIntakePh, iEc: r.qrIntakeEc, iT: r.qrIntakeTempColdstore, iH: r.qrIntakeHumidityColdstore,
        ePh: r.qrExportPh, eEc: r.qrExportEc, eT: r.qrExportTempColdstore, eH: r.qrExportHumidityColdstore,
        qR: r.qrGenQualityRating, wQ: r.qrIntakeWaterQuality, pS: r.qrPackProcessingSpeed,
        sL: r.qrIntakeStemLength, hS: r.qrIntakeHeadSize, cH: r.qrIntakeColdstoreHours,
        qN: r.qrGenQualityFlowers, pN: r.qrGenProtocolChanges, gC: r.generalComment,
        cBy: r.createdByUserId ? userMap.get(r.createdByUserId) || null : null,
        sby: r.submittedByUserId ? userMap.get(r.submittedByUserId) || null : null,
        pQ: r.qrDispatchPackingQuality, pR: r.qrDispatchPackrate,
        eWQ: r.qrExportWaterQuality, eCH: r.qrExportColdstoreHours,
      })),
    });
  }

  return summaries;
}

export function AIAgent({ reports, accounts, activities, users, exceptionAnalysis, seasonalityAnalysis, containers, servicesOrders, shipperArrivals, shipperReports, sfTrips, customerScope }: AIAgentProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);

  const farmData = useMemo(() => {
    const base = buildFarmDataContext(reports, accounts, users || []);

    // Attach ALL activities per farm (no truncation)
    if (activities?.length) {
      for (const summary of base) {
        const farmActivities = activities
          .filter((a) => a.accountId === (summary as any).farmId)
          .sort((a, b) => (b.createdAt || b.startsAt || 0) - (a.createdAt || a.startsAt || 0))
          .map((a) => compact({
            id: a.id,
            type: a.type,
            status: a.status,
            subject: a.subject,
            description: a.description,
            startDate: a.startsAt ? new Date(a.startsAt).toISOString().slice(0, 10) : null,
            completedDate: a.completedAt ? new Date(a.completedAt).toISOString().slice(0, 10) : null,
            createdDate: a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : null,
          }));

        if (farmActivities.length) {
          (summary as any).activities = farmActivities;
        }
      }
    }

    return base;
  }, [reports, accounts, activities, users]);

  // Lightweight farm index for AI discovery (NOT bulk data)
  const farmIndex = useMemo(() => farmData.map((f: any) => ({
    farmId: f.farmId,
    farm: f.farm,
    weeks: (f.d || []).length,
    firstWeek: f.d?.[0]?.w ?? null,
    lastWeek: f.d?.[f.d.length - 1]?.w ?? null,
  })), [farmData]);

  // Raw activities flat list for the search_activities tool — includes farmId for scoping
  const rawActivitiesForAI = useMemo(() => {
    if (!activities?.length) return [];
    const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
    return activities.map((a) => compact({
      id: a.id,
      farmId: a.accountId,
      farm: accountMap.get(a.accountId) || null,
      type: a.type,
      status: a.status,
      subject: a.subject,
      description: a.description,
      assignedUserId: a.assignedUserId,
      ownerUserId: a.ownerUserId,
      startDate: a.startsAt ? new Date(a.startsAt).toISOString().slice(0, 10) : null,
      completedDate: a.completedAt ? new Date(a.completedAt).toISOString().slice(0, 10) : null,
      createdDate: a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : null,
    }));
  }, [activities, accounts]);

  const staffSummary = useMemo(() => buildStaffSummary(reports, users || []), [reports, users]);
  const activitySummary = useMemo(() => buildActivitySummary(activities || [], users || []), [activities, users]);

  // Build compressed logistics dataset
  const logisticsData = useMemo(() => {
    if (!containers?.length) return [];
    const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
    const ordersByContainer = new Map<string, ServicesOrder[]>();
    for (const o of servicesOrders || []) {
      if (!o.containerId) continue;
      const arr = ordersByContainer.get(o.containerId) || [];
      arr.push(o);
      ordersByContainer.set(o.containerId, arr);
    }
    const arrivalsByOrder = new Map<string, ShipperArrival[]>();
    for (const a of shipperArrivals || []) {
      if (!a.servicesOrderId) continue;
      const arr = arrivalsByOrder.get(a.servicesOrderId) || [];
      arr.push(a);
      arrivalsByOrder.set(a.servicesOrderId, arr);
    }
    const reportsByContainer = new Map<string, ShipperReport[]>();
    for (const r of shipperReports || []) {
      if (!r.containerId) continue;
      const arr = reportsByContainer.get(r.containerId) || [];
      arr.push(r);
      reportsByContainer.set(r.containerId, arr);
    }

    const dateStr = (ts: number | null) => (ts ? new Date(ts).toISOString().slice(0, 10) : null);

    const sortedContainers = [...containers]
      .sort((a, b) => (b.shippingDate ?? 0) - (a.shippingDate ?? 0))
      .slice(0, 200);

    return sortedContainers.map((c) => {
      const orders = ordersByContainer.get(c.id) || [];
      const reports = reportsByContainer.get(c.id) || [];
      return compact({
        id: c.id,
        cn: c.containerNumber,
        bk: c.bookingCode,
        sl: c.shippingLineId,
        drop: dateStr(c.dropoffDate),
        ship: dateStr(c.shippingDate),
        orders: orders.map((o) => compact({
          orderId: o.id,            // for server scoping
          farmId: o.farmAccountId,  // for server scoping
          on: o.orderNumber,
          farm: accountMap.get(o.farmAccountId) || null,
          cust: accountMap.get(o.customerAccountId) || null,
          pal: o.pallets,
          fc: o.forecast,
          dWk: o.dippingWeek,
          status: o.statusName,
          purpose: o.purposeName,
          arrivals: (arrivalsByOrder.get(o.id) || []).map((a) => compact({
            date: dateStr(a.arrivalDate),
            t1: a.arrivalTemp1, t2: a.arrivalTemp2, t3: a.arrivalTemp3,
            vc1: a.afterVc1Temp, vc2: a.afterVc2Temp, vc3: a.afterVc3Temp,
            dwm: a.dischargeWaitingMin,
            gOff: a.gensetOffMoment,
            vcCy: a.vcCycles,
            vcDur: a.vcDurationMin,
            cmt: a.specificComments,
          })),
        })),
        reports: reports.length
          ? reports.map((r) => compact({
              wk: r.weekNr,
              stuff: dateStr(r.stuffingDate),
              loadMin: r.loadingMin,
              cmt: r.generalComments,
            }))
          : null,
      });
    });
  }, [containers, servicesOrders, shipperArrivals, shipperReports, accounts]);

  const containerIndex = useMemo(() => logisticsData.map((c: any) => ({
    id: c.id, cn: c.cn, bk: c.bk, ship: c.ship, orderCount: (c.orders || []).length,
  })), [logisticsData]);

  // Live SensiWatch tracker data — joined to containerNumber for AI lookup
  const sfTracking = useMemo(() => {
    if (!sfTrips?.length) return [];
    const orderToContainer = new Map<string, string>();
    for (const c of logisticsData as any[]) {
      for (const o of c.orders || []) {
        if (o.on && c.cn) orderToContainer.set(o.on, c.cn);
      }
    }
    return sfTrips.map((t) => {
      const stripped = (t.internalTripId || "").split(/[_-]/)[0];
      return compact({
        tripId: t.tripId,
        status: t.tripStatus,
        internalTripId: t.internalTripId,
        containerNumber: orderToContainer.get(stripped) || null,
        origin: t.originName,
        originAddr: t.originAddress,
        destination: t.destinationName,
        carrier: t.carrier,
        stops: t.stops,
        serial: t.serialNumber,
        lastTempC: t.lastTemp,
        lastHumidity: t.lastHumidity,
        lastLight: t.lastLight,
        lastReadingTime: t.lastReadingTime,
        lastLocation: t.lastLocation,
        lat: t.latitude,
        lon: t.longitude,
      });
    });
  }, [sfTrips, logisticsData]);

  const tripIndex = useMemo(() => sfTracking.map((t: any) => ({
    tripId: t.tripId,
    internalTripId: t.internalTripId,
    status: t.status,
    origin: t.origin,
    destination: t.destination,
    lastTempC: t.lastTempC,
    lastReadingTime: t.lastReadingTime,
  })), [sfTracking]);

  // Fetch recent weekly plans
  const [weeklyPlans, setWeeklyPlans] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("weekly_plan_cache")
        .select("week_nr, analysis, created_at")
        .order("week_nr", { ascending: false })
        .limit(6);
      if (data) setWeeklyPlans(data);
    })();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Msg = { role: "user", content: text.trim() };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);

      // Fire-and-forget: log the question
      try {
        const { data: { session } } = await supabase.auth.getSession();
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-question`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ question: text.trim(), email: session?.user?.email || "" }),
        }).catch(() => {});
      } catch {}

      let assistantSoFar = "";

      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            farmData,
            staffSummary,
            activitySummary,
            exceptionAnalysis: exceptionAnalysis || null,
            seasonalityAnalysis: seasonalityAnalysis || null,
            weeklyPlans: weeklyPlans.length > 0 ? weeklyPlans : null,
            logisticsData: logisticsData || null,
            sfTracking: sfTracking || null,
          }),
        });

        if (!resp.ok || !resp.body) {
          const err = await resp.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error || "Failed to get response");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantSoFar += content;
                const snapshot = assistantSoFar;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) =>
                      i === prev.length - 1 ? { ...m, content: snapshot } : m
                    );
                  }
                  return [...prev, { role: "assistant", content: snapshot }];
                });
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantSoFar += content;
                const snapshot = assistantSoFar;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) =>
                      i === prev.length - 1 ? { ...m, content: snapshot } : m
                    );
                  }
                  return [...prev, { role: "assistant", content: snapshot }];
                });
              }
            } catch {
              /* ignore */
            }
          }
        }

        // Save the completed conversation exchange to the database
        if (assistantSoFar) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            await supabase.from("ai_conversation_logs" as any).insert({
              question: text.trim(),
              answer: assistantSoFar,
              user_email: session?.user?.email || null,
              username: session?.user?.user_metadata?.username || session?.user?.email || null,
            } as any);
          } catch {}
        }
      } catch (e: any) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${e.message || "Something went wrong. Please try again."}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, farmData, staffSummary, activitySummary, exceptionAnalysis, seasonalityAnalysis, weeklyPlans, logisticsData, sfTracking]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bot className="h-4 w-4" />
          AI Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" />
              AI Quality Agent
            </DialogTitle>
            {messages.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMessages([])}
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
                <ExportPdfButton targetRef={chatContentRef} filename="ai-agent-chat" size="sm" />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Ask questions about quality and trial data. I can analyze trends, compare farms, and create tables.
          </p>
        </DialogHeader>

        {/* Chat area */}
        <ScrollArea className="flex-1 px-5" ref={scrollRef}>
          <div className="py-4 space-y-4" ref={chatContentRef}>
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Sparkles className="h-4 w-4" />
                  Try one of these questions:
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {SAMPLE_QUESTIONS.map((q, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      onClick={() => sendMessage(q)}
                      className="text-left text-sm px-4 py-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-colors text-foreground"
                    >
                      {q}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 border border-border text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0 [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:mt-5 [&_h2]:mb-2.5 [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:mb-4 [&_ol]:mb-4 [&_li]:mb-1.5 [&_hr]:my-5 [&_blockquote]:my-4 [&_table]:text-xs [&_table]:w-full [&_table]:my-4 [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5 [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border [&_th]:bg-muted/50 [&_table]:overflow-x-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border px-5 py-3 shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about quality & trial data…"
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
