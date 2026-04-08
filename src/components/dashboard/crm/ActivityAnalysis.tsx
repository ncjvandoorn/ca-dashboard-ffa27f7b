import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Activity, User, Account } from "@/lib/csvParser";

interface Props {
  allActivities: Activity[];
  users: User[];
  accounts: Account[];
  activeUsers: { id: string; name: string }[];
  selectedUserId: string;
  onBack: () => void;
}

/** Convert timestamp to YYWW week number (Sat–Fri, week containing Jan 1 = week 1) */
function toWeekNr(ts: number): string {
  const d = new Date(ts);
  const daysSinceSat = (d.getDay() + 1) % 7;
  const sat = new Date(d);
  sat.setDate(d.getDate() - daysSinceSat);
  sat.setHours(0, 0, 0, 0);
  const jan1 = new Date(sat.getFullYear(), 0, 1);
  const jan1Days = (jan1.getDay() + 1) % 7;
  const week1Sat = new Date(jan1);
  week1Sat.setDate(jan1.getDate() - jan1Days);
  week1Sat.setHours(0, 0, 0, 0);
  const weekNum = Math.floor((sat.getTime() - week1Sat.getTime()) / (7 * 86400000)) + 1;
  const yr = sat.getFullYear() % 100;
  return `${yr}/${String(weekNum).padStart(2, "0")}`;
}

export function ActivityAnalysis({
  allActivities, users, accounts, activeUsers, selectedUserId: initialUserId, onBack,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const filteredActivities = useMemo(() => {
    if (selectedUserId === "all") return allActivities;
    return allActivities.filter((a) => a.assignedUserId === selectedUserId);
  }, [allActivities, selectedUserId]);

  const stats = useMemo(() => {
    const byUser: Record<string, { total: number; completed: number; inProgress: number; toDo: number; noStatus: number }> = {};
    for (const a of filteredActivities) {
      const uid = a.assignedUserId || a.ownerUserId || "unassigned";
      if (!byUser[uid]) byUser[uid] = { total: 0, completed: 0, inProgress: 0, toDo: 0, noStatus: 0 };
      const u = byUser[uid];
      u.total++;
      if (a.status === "Completed") u.completed++;
      else if (a.status === "In Progress") u.inProgress++;
      else if (a.status === "To Do") u.toDo++;
      else u.noStatus++;
    }
    return Object.entries(byUser)
      .map(([uid, s]) => ({
        userId: uid,
        userName: userMap.get(uid) || (uid === "unassigned" ? "Unassigned" : uid.slice(0, 8)),
        ...s,
        completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredActivities, userMap]);

  const totalStats = useMemo(() => {
    const total = filteredActivities.length;
    const completed = filteredActivities.filter((a) => a.status === "Completed").length;
    const inProgress = filteredActivities.filter((a) => a.status === "In Progress").length;
    const toDo = filteredActivities.filter((a) => a.status === "To Do").length;
    const noStatus = total - completed - inProgress - toDo;

    // Weekly trend
    const byWeek: Record<string, number> = {};
    for (const a of filteredActivities) {
      if (a.createdAt) {
        const key = toWeekNr(a.createdAt);
        byWeek[key] = (byWeek[key] || 0) + 1;
      }
    }

    // By type
    const byType: Record<string, number> = {};
    for (const a of filteredActivities) {
      const t = a.type || "Unknown";
      byType[t] = (byType[t] || 0) + 1;
    }

    // By farm
    const byFarm: Record<string, number> = {};
    for (const a of filteredActivities) {
      if (a.accountId) {
        const name = accountMap.get(a.accountId) || a.accountId.slice(0, 8);
        byFarm[name] = (byFarm[name] || 0) + 1;
      }
    }
    const topFarms = Object.entries(byFarm).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return { total, completed, inProgress, toDo, noStatus, byWeek, byType, topFarms, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [filteredActivities, accountMap]);

  const sortedWeeks = Object.entries(totalStats.byWeek).sort((a, b) => a[0].localeCompare(b[0]));
  const maxWeekly = Math.max(...sortedWeeks.map(([, v]) => v), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to Board
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
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

      {/* Weekly creation trend */}
      {sortedWeeks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Weekly Activity Creation
          </h4>
          <div className="space-y-1.5">
            {sortedWeeks.slice(-24).map(([week, count]) => (
              <div key={week} className="flex items-center gap-2 text-sm">
                <span className="w-14 text-muted-foreground text-xs font-mono">{week}</span>
                <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded"
                    style={{ width: `${(count / maxWeekly) * 100}%` }}
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
