import { useState, useMemo } from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ClipboardList, Phone, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Activity, User, Account } from "@/lib/csvParser";

interface Props {
  allActivities: Activity[];
  users: User[];
  accounts: Account[];
  activeUsers: { id: string; name: string }[];
  onBack: () => void;
}

type Mode = "week" | "month" | "year";

const typeIcon: Record<string, typeof ClipboardList> = {
  Task: ClipboardList,
  Call: Phone,
  Visit: MapPin,
};

const typeColor: Record<string, string> = {
  Visit: "bg-primary/15 text-primary border-primary/30",
  Call: "bg-warning/15 text-warning border-warning/30",
  Task: "bg-accent/15 text-accent border-accent/30",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

/** Monday of the work-week containing d.
 * Project week runs Sat-Fri, so Saturday belongs to the NEXT Mon-Fri block.
 */
function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  if (day === 6) {
    // Saturday: jump forward to upcoming Monday
    x.setDate(x.getDate() + 2);
  } else {
    const diff = (day + 6) % 7; // Mon=0
    x.setDate(x.getDate() - diff);
  }
  return x;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getActivityDate(a: Activity): number | null {
  return a.startsAt || a.completedAt || a.createdAt || null;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function CalendarView({ allActivities, users, accounts, activeUsers, onBack }: Props) {
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));

  const userMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);

  const userSet = useMemo(() => new Set(activeUsers.map(u => u.id)), [activeUsers]);

  // Filter activities by selected users + having a date
  const filtered = useMemo(() => {
    return allActivities.filter(a => {
      if (!a.assignedUserId || !userSet.has(a.assignedUserId)) return false;
      return getActivityDate(a) != null;
    });
  }, [allActivities, userSet]);

  // Range for current view
  const range = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeekMonday(anchor);
      const end = addDays(start, 5); // Mon-Fri (exclusive Sat)
      return { start, end };
    }
    if (mode === "month") {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
      return { start, end };
    }
    const start = new Date(anchor.getFullYear(), 0, 1);
    const end = new Date(anchor.getFullYear() + 1, 0, 1);
    return { start, end };
  }, [mode, anchor]);

  // Activities within range
  const inRange = useMemo(() => {
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();
    return filtered.filter(a => {
      const ts = getActivityDate(a)!;
      return ts >= startMs && ts < endMs;
    });
  }, [filtered, range]);

  // Counts
  const counts = useMemo(() => {
    const c = { Visit: 0, Call: 0, Task: 0, Other: 0 };
    for (const a of inRange) {
      if (a.type === "Visit") c.Visit++;
      else if (a.type === "Call") c.Call++;
      else if (a.type === "Task") c.Task++;
      else c.Other++;
    }
    return c;
  }, [inRange]);

  const navigate = (dir: -1 | 1) => {
    if (mode === "week") setAnchor(addDays(anchor, 7 * dir));
    else if (mode === "month") setAnchor(addMonths(anchor, dir));
    else setAnchor(new Date(anchor.getFullYear() + dir, 0, 1));
  };

  const headerLabel = useMemo(() => {
    if (mode === "week") {
      const end = addDays(range.start, 4);
      return `${range.start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (mode === "month") return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return String(anchor.getFullYear());
  }, [mode, range, anchor]);


  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setAnchor(startOfDay(new Date()))}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h3 className="font-semibold text-sm min-w-[180px]">{headerLabel}</h3>

          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="h-8">
              <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
              <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Counts */}
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className={typeColor.Visit}>
              <MapPin className="h-3 w-3 mr-1" /> {counts.Visit} Visits
            </Badge>
            <Badge variant="outline" className={typeColor.Call}>
              <Phone className="h-3 w-3 mr-1" /> {counts.Call} Calls
            </Badge>
            <Badge variant="outline" className={typeColor.Task}>
              <ClipboardList className="h-3 w-3 mr-1" /> {counts.Task} Tasks
            </Badge>
          </div>
        </div>

        {/* Calendar body */}
        {mode === "week" && (
          <WeekGrid start={range.start} activities={inRange} userMap={userMap} accountMap={accountMap} />
        )}
        {mode === "month" && (
          <MonthGrid anchor={anchor} activities={inRange} userMap={userMap} accountMap={accountMap} onPickDay={(d) => { setAnchor(d); setMode("week"); }} />
        )}
        {mode === "year" && (
          <YearGrid year={anchor.getFullYear()} activities={inRange} onPickMonth={(m) => { setAnchor(new Date(anchor.getFullYear(), m, 1)); setMode("month"); }} />
        )}
      </div>
    </TooltipProvider>
  );
}

/* ---------------- Week grid ---------------- */

function WeekGrid({ start, activities, userMap, accountMap }: {
  start: Date; activities: Activity[];
  userMap: Map<string, string>; accountMap: Map<string, string>;
}) {
  const days = Array.from({ length: 5 }, (_, i) => addDays(start, i));
  const today = startOfDay(new Date());

  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const d of days) m.set(d.toDateString(), []);
    for (const a of activities) {
      const ts = getActivityDate(a)!;
      const d = startOfDay(new Date(ts));
      const key = d.toDateString();
      if (m.has(key)) m.get(key)!.push(a);
    }
    // Sort: non-Visit (Task/Call) first, then Visits — both groups sorted by time
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const aIsVisit = a.type === "Visit" ? 1 : 0;
        const bIsVisit = b.type === "Visit" ? 1 : 0;
        if (aIsVisit !== bIsVisit) return aIsVisit - bIsVisit;
        return (getActivityDate(a) || 0) - (getActivityDate(b) || 0);
      });
    }
    return m;
  }, [days, activities]);

  return (
    <div className="grid grid-cols-5 gap-2">
      {days.map((d, i) => {
        const items = byDay.get(d.toDateString()) || [];
        const isToday = sameDay(d, today);
        return (
          <div key={i} className="flex flex-col">
            <div className={`px-2 py-1.5 rounded-t-md border border-b-0 ${isToday ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border"}`}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{DAY_LABELS[i]}</div>
              <div className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>{d.getDate()} {MONTH_NAMES[d.getMonth()]}</div>
            </div>
            <div className="rounded-b-md border border-border bg-background p-1.5 min-h-[400px] space-y-1">
              {items.length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-4">—</div>
              )}
              {items.map(a => (
                <ActivityChip key={a.id} activity={a} userMap={userMap} accountMap={accountMap} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityChip({ activity, userMap, accountMap }: {
  activity: Activity; userMap: Map<string, string>; accountMap: Map<string, string>;
}) {
  const Icon = typeIcon[activity.type] || ClipboardList;
  const farm = activity.accountId ? accountMap.get(activity.accountId) : null;
  const assignee = activity.assignedUserId ? userMap.get(activity.assignedUserId) : null;
  const ts = getActivityDate(activity)!;
  const color = typeColor[activity.type] || "bg-muted text-foreground border-border";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`rounded border px-1.5 py-1 text-[11px] cursor-default ${color}`}>
          <div className="flex items-center gap-1">
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate font-medium">{activity.subject || "Untitled"}</span>
          </div>
          {farm && <div className="truncate opacity-80 ml-4">{farm}</div>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-md max-h-[70vh] overflow-y-auto">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-xs">
            <Icon className="h-3.5 w-3.5" />
            {activity.type} — {activity.subject || "Untitled"}
          </div>
          <div className="text-xs text-muted-foreground">{fmtDate(ts)} · {fmtTime(ts)}</div>
          {farm && <div className="text-xs"><span className="text-muted-foreground">Farm:</span> {farm}</div>}
          {assignee && <div className="text-xs"><span className="text-muted-foreground">Assignee:</span> {assignee}</div>}
          {activity.status && <div className="text-xs"><span className="text-muted-foreground">Status:</span> {activity.status}</div>}
          {activity.description && (
            <div className="text-xs mt-1.5 pt-1.5 border-t border-border/50 whitespace-pre-wrap break-words">{activity.description}</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/* ---------------- Month grid ---------------- */

function MonthGrid({ anchor, activities, userMap, accountMap, onPickDay }: {
  anchor: Date; activities: Activity[];
  userMap: Map<string, string>; accountMap: Map<string, string>;
  onPickDay: (d: Date) => void;
}) {
  const today = startOfDay(new Date());
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeekMonday(firstOfMonth);
  // Build 6 weeks * 5 weekdays
  const cells: Date[] = [];
  for (let w = 0; w < 6; w++) {
    for (let d = 0; d < 5; d++) cells.push(addDays(gridStart, w * 7 + d));
  }

  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of activities) {
      const ts = getActivityDate(a)!;
      const key = startOfDay(new Date(ts)).toDateString();
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const aIsVisit = a.type === "Visit" ? 1 : 0;
        const bIsVisit = b.type === "Visit" ? 1 : 0;
        if (aIsVisit !== bIsVisit) return aIsVisit - bIsVisit;
        return (getActivityDate(a) || 0) - (getActivityDate(b) || 0);
      });
    }
    return m;
  }, [activities]);

  return (
    <div>
      <div className="grid grid-cols-5 gap-1 mb-1">
        {DAY_LABELS.map(l => (
          <div key={l} className="text-[11px] uppercase tracking-wide text-muted-foreground px-2">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {cells.map((d, i) => {
          const items = byDay.get(d.toDateString()) || [];
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = sameDay(d, today);
          return (
            <button
              key={i}
              onClick={() => onPickDay(d)}
              className={`text-left rounded border p-1.5 min-h-[100px] transition-colors ${
                inMonth ? "bg-background border-border hover:border-primary/50" : "bg-muted/20 border-border/50 opacity-60"
              } ${isToday ? "ring-1 ring-primary" : ""}`}
            >
              <div className={`text-xs font-semibold mb-1 ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map(a => {
                  const Icon = typeIcon[a.type] || ClipboardList;
                  const color = typeColor[a.type] || "bg-muted";
                  return (
                    <Tooltip key={a.id}>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] ${color}`}>
                          <Icon className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{a.subject || "Untitled"}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-md max-h-[70vh] overflow-y-auto">
                        <ChipTooltipContent activity={a} userMap={userMap} accountMap={accountMap} />
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                {items.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{items.length - 3} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChipTooltipContent({ activity, userMap, accountMap }: {
  activity: Activity; userMap: Map<string, string>; accountMap: Map<string, string>;
}) {
  const Icon = typeIcon[activity.type] || ClipboardList;
  const farm = activity.accountId ? accountMap.get(activity.accountId) : null;
  const assignee = activity.assignedUserId ? userMap.get(activity.assignedUserId) : null;
  const ts = getActivityDate(activity)!;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 font-semibold text-xs">
        <Icon className="h-3.5 w-3.5" />
        {activity.type} — {activity.subject || "Untitled"}
      </div>
      <div className="text-xs text-muted-foreground">{fmtDate(ts)} · {fmtTime(ts)}</div>
      {farm && <div className="text-xs"><span className="text-muted-foreground">Farm:</span> {farm}</div>}
      {assignee && <div className="text-xs"><span className="text-muted-foreground">Assignee:</span> {assignee}</div>}
      {activity.description && (
        <div className="text-xs mt-1.5 pt-1.5 border-t border-border/50 line-clamp-6 whitespace-pre-wrap">{activity.description}</div>
      )}
    </div>
  );
}

/* ---------------- Year grid ---------------- */

function YearGrid({ year, activities, onPickMonth }: {
  year: number; activities: Activity[]; onPickMonth: (m: number) => void;
}) {
  const stats = useMemo(() => {
    const s = Array.from({ length: 12 }, () => ({ Visit: 0, Call: 0, Task: 0, total: 0 }));
    for (const a of activities) {
      const ts = getActivityDate(a)!;
      const d = new Date(ts);
      if (d.getFullYear() !== year) continue;
      const m = d.getMonth();
      s[m].total++;
      if (a.type === "Visit") s[m].Visit++;
      else if (a.type === "Call") s[m].Call++;
      else if (a.type === "Task") s[m].Task++;
    }
    return s;
  }, [activities, year]);

  const today = new Date();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {MONTH_NAMES.map((name, m) => {
        const isCurrent = today.getFullYear() === year && today.getMonth() === m;
        const s = stats[m];
        return (
          <button
            key={m}
            onClick={() => onPickMonth(m)}
            className={`rounded-lg border p-3 text-left hover:border-primary/50 transition-colors ${isCurrent ? "ring-1 ring-primary bg-primary/5" : "bg-background border-border"}`}
          >
            <div className="font-semibold text-sm mb-2">{name} {year}</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" /> Visits</span>
                <span className="font-medium">{s.Visit}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> Calls</span>
                <span className="font-medium">{s.Call}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground"><ClipboardList className="h-3 w-3" /> Tasks</span>
                <span className="font-medium">{s.Task}</span>
              </div>
              <div className="flex items-center justify-between pt-1 mt-1 border-t border-border/50">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{s.total}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
