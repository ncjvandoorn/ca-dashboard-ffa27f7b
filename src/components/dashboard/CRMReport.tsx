import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList, Phone, MapPin, Users, BarChart3, ArrowLeft,
  CheckCircle, Clock, AlertCircle, Filter,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Activity, User, Account } from "@/lib/csvParser";

interface CRMReportProps {
  activities: Activity[];
  users: User[];
  accounts: Account[];
}

const STATUS_COLUMNS = ["To Do", "In Progress", "Completed"] as const;

const typeIcon: Record<string, typeof ClipboardList> = {
  Task: ClipboardList,
  Call: Phone,
  Visit: MapPin,
};

const statusStyle: Record<string, string> = {
  "To Do": "border-warning/30 bg-warning/5",
  "In Progress": "border-primary/30 bg-primary/5",
  "Completed": "border-accent/30 bg-accent/5",
};

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function timeAgo(timestamp: number | null): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/* ─── Activity Analysis Sub-view ─── */
function ActivityAnalysis({
  activities,
  users,
  accounts,
  onBack,
}: {
  activities: Activity[];
  users: User[];
  accounts: Account[];
  onBack: () => void;
}) {
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const stats = useMemo(() => {
    const byUser: Record<string, { total: number; completed: number; inProgress: number; toDo: number; noStatus: number; byMonth: Record<string, number> }> = {};

    for (const a of activities) {
      const uid = a.assignedUserId || a.ownerUserId || "unassigned";
      if (!byUser[uid]) byUser[uid] = { total: 0, completed: 0, inProgress: 0, toDo: 0, noStatus: 0, byMonth: {} };
      const u = byUser[uid];
      u.total++;
      if (a.status === "Completed") u.completed++;
      else if (a.status === "In Progress") u.inProgress++;
      else if (a.status === "To Do") u.toDo++;
      else u.noStatus++;

      if (a.createdAt) {
        const d = new Date(a.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        u.byMonth[key] = (u.byMonth[key] || 0) + 1;
      }
    }

    return Object.entries(byUser)
      .map(([uid, s]) => ({
        userId: uid,
        userName: userMap.get(uid) || (uid === "unassigned" ? "Unassigned" : uid.slice(0, 8)),
        ...s,
        completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [activities, userMap]);

  const totalStats = useMemo(() => {
    const total = activities.length;
    const completed = activities.filter((a) => a.status === "Completed").length;
    const inProgress = activities.filter((a) => a.status === "In Progress").length;
    const toDo = activities.filter((a) => a.status === "To Do").length;
    const noStatus = total - completed - inProgress - toDo;

    // Monthly trend
    const byMonth: Record<string, number> = {};
    for (const a of activities) {
      if (a.createdAt) {
        const d = new Date(a.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth[key] = (byMonth[key] || 0) + 1;
      }
    }

    // Activities by type
    const byType: Record<string, number> = {};
    for (const a of activities) {
      const t = a.type || "Unknown";
      byType[t] = (byType[t] || 0) + 1;
    }

    // By farm
    const byFarm: Record<string, number> = {};
    for (const a of activities) {
      if (a.accountId) {
        const name = accountMap.get(a.accountId) || a.accountId.slice(0, 8);
        byFarm[name] = (byFarm[name] || 0) + 1;
      }
    }
    const topFarms = Object.entries(byFarm).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return { total, completed, inProgress, toDo, noStatus, byMonth, byType, topFarms, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [activities, accountMap]);

  const sortedMonths = Object.entries(totalStats.byMonth).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonthly = Math.max(...sortedMonths.map(([, v]) => v), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to Board
        </Button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: totalStats.total, color: "text-foreground" },
          { label: "Completed", value: totalStats.completed, color: "text-accent" },
          { label: "In Progress", value: totalStats.inProgress, color: "text-primary" },
          { label: "To Do", value: totalStats.toDo, color: "text-warning" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
        <p className="text-xs text-muted-foreground">Overall Completion Rate</p>
        <p className="text-3xl font-bold text-accent">{totalStats.completionRate}%</p>
      </div>

      {/* Monthly creation trend */}
      {sortedMonths.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Monthly Activity Creation
          </h4>
          <div className="space-y-1.5">
            {sortedMonths.slice(-12).map(([month, count]) => (
              <div key={month} className="flex items-center gap-2 text-sm">
                <span className="w-20 text-muted-foreground text-xs">{month}</span>
                <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded"
                    style={{ width: `${(count / maxMonthly) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By type */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          By Activity Type
        </h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(totalStats.byType)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <Badge key={type} variant="outline" className="text-xs gap-1">
                {type} <span className="font-bold">{count}</span>
              </Badge>
            ))}
        </div>
      </div>

      {/* Top farms */}
      {totalStats.topFarms.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Top 10 Farms by Activity Count
          </h4>
          <div className="space-y-1">
            {totalStats.topFarms.map(([name, count]) => (
              <div key={name} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                <span className="truncate mr-2">{name}</span>
                <span className="font-medium text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-user breakdown */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Performance by User
        </h4>
        <div className="space-y-3">
          {stats.filter((s) => s.userId !== "unassigned").map((s) => (
            <motion.div
              key={s.userId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{s.userName}</span>
                <Badge variant="outline" className="text-xs">
                  {s.completionRate}% completed
                </Badge>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Total: <b className="text-foreground">{s.total}</b></span>
                <span>Done: <b className="text-accent">{s.completed}</b></span>
                <span>In Progress: <b className="text-primary">{s.inProgress}</b></span>
                <span>To Do: <b className="text-warning">{s.toDo}</b></span>
                {s.noStatus > 0 && <span>No status: <b>{s.noStatus}</b></span>}
              </div>
              {/* Completion bar */}
              <div className="mt-2 h-2 bg-muted/40 rounded-full overflow-hidden flex">
                {s.completed > 0 && (
                  <div className="bg-accent h-full" style={{ width: `${(s.completed / s.total) * 100}%` }} />
                )}
                {s.inProgress > 0 && (
                  <div className="bg-primary h-full" style={{ width: `${(s.inProgress / s.total) * 100}%` }} />
                )}
                {s.toDo > 0 && (
                  <div className="bg-warning h-full" style={{ width: `${(s.toDo / s.total) * 100}%` }} />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main CRM Report Component ─── */
export function CRMReport({ activities, users, accounts }: CRMReportProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"board" | "analysis">("board");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  // Users that have activities assigned
  const activeUsers = useMemo(() => {
    const ids = new Set<string>();
    for (const a of activities) {
      if (a.assignedUserId) ids.add(a.assignedUserId);
    }
    return [...ids]
      .map((id) => ({ id, name: userMap.get(id) || id.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activities, userMap]);

  const filteredActivities = useMemo(() => {
    if (selectedUserId === "all") return activities;
    return activities.filter((a) => a.assignedUserId === selectedUserId);
  }, [activities, selectedUserId]);

  const columns = useMemo(() => {
    const cols: Record<string, Activity[]> = {
      "To Do": [],
      "In Progress": [],
      "Completed": [],
    };
    for (const a of filteredActivities) {
      const status = STATUS_COLUMNS.includes(a.status as any) ? a.status : null;
      if (status) cols[status].push(a);
    }
    // Sort each column by most recent first
    for (const key of Object.keys(cols)) {
      cols[key].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return cols;
  }, [filteredActivities]);

  const columnMeta: Record<string, { icon: typeof ClipboardList; dotColor: string }> = {
    "To Do": { icon: AlertCircle, dotColor: "bg-warning" },
    "In Progress": { icon: Clock, dotColor: "bg-primary" },
    "Completed": { icon: CheckCircle, dotColor: "bg-accent" },
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setView("board"); }} className="gap-2">
        <Users className="h-4 w-4" />
        CRM Report
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
              {view === "board" ? "CRM Activity Board" : "Activity Analysis"}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-5">
            <div className="py-4">
              {view === "board" ? (
                <>
                  {/* Toolbar */}
                  <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setView("analysis")}
                      className="gap-1.5"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Activity Analysis
                    </Button>

                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger className="w-[200px] h-8 text-sm">
                          <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          {activeUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <span className="text-xs text-muted-foreground ml-auto">
                      {filteredActivities.filter((a) => STATUS_COLUMNS.includes(a.status as any)).length} activities
                    </span>
                  </div>

                  {/* Kanban columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {STATUS_COLUMNS.map((status) => {
                      const items = columns[status];
                      const meta = columnMeta[status];
                      return (
                        <div key={status} className="flex flex-col">
                          <div className="flex items-center gap-2 mb-3">
                            <meta.icon className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold text-sm">{status}</h3>
                            <Badge variant="secondary" className="text-xs ml-auto">
                              {items.length}
                            </Badge>
                          </div>
                          <div className={`rounded-xl border p-2 min-h-[200px] space-y-2 ${statusStyle[status] || "border-border bg-muted/20"}`}>
                            {items.slice(0, 50).map((activity, i) => {
                              const Icon = typeIcon[activity.type] || ClipboardList;
                              const assignedName = activity.assignedUserId ? userMap.get(activity.assignedUserId) : null;
                              const farmName = activity.accountId ? accountMap.get(activity.accountId) : null;
                              return (
                                <motion.div
                                  key={activity.id}
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.015 }}
                                  className="rounded-lg border border-border bg-background p-3 shadow-sm"
                                >
                                  <div className="flex items-start gap-2 mb-1.5">
                                    <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <span className="text-sm font-medium leading-tight line-clamp-2">
                                      {activity.subject || "Untitled"}
                                    </span>
                                  </div>
                                  {activity.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2 ml-6">
                                      {activity.description}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between ml-6">
                                    <div className="flex flex-col gap-0.5">
                                      {farmName && (
                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {farmName}
                                        </span>
                                      )}
                                      <span className="text-[11px] text-muted-foreground/60">
                                        {timeAgo(activity.createdAt)} · {formatDate(activity.startsAt || activity.createdAt)}
                                      </span>
                                    </div>
                                    {assignedName && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                        {assignedName.split(" ").map((n) => n[0]).join("").toUpperCase()}
                                      </Badge>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                            {items.length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-8">
                                No activities
                              </p>
                            )}
                            {items.length > 50 && (
                              <p className="text-xs text-muted-foreground text-center pt-1">
                                +{items.length - 50} more
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <ActivityAnalysis
                  activities={filteredActivities}
                  users={users}
                  accounts={accounts}
                  onBack={() => setView("board")}
                />
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
