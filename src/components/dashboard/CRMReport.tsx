import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList, Phone, MapPin, Users, BarChart3,
  CheckCircle, Clock, AlertCircle, Filter, CalendarClock,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Activity, User, Account, QualityReport } from "@/lib/csvParser";
import { getCrmVisibleUserIds } from "@/lib/crmUserFilter";
import { ActivityAnalysis } from "./crm/ActivityAnalysis";
import { ComingWeekView } from "./crm/ComingWeekView";

interface CRMReportProps {
  activities: Activity[];
  users: User[];
  accounts: Account[];
  reports: QualityReport[];
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

export function CRMReport({ activities, users, accounts, reports }: CRMReportProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"board" | "analysis" | "coming-week">("board");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({ "To Do": 25, "In Progress": 25, "Completed": 25 });

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const [crmVisibleIds, setCrmVisibleIds] = useState<string[] | null>(null);
  const [crmLoaded, setCrmLoaded] = useState(false);

  useEffect(() => {
    getCrmVisibleUserIds().then((ids) => {
      setCrmVisibleIds(ids);
      setCrmLoaded(true);
    });
  }, []);
  const activeUsers = useMemo(() => {
    const ids = new Set<string>();
    for (const a of activities) {
      if (a.assignedUserId) ids.add(a.assignedUserId);
    }
    return [...ids]
      .filter((id) => !crmVisibleIds || crmVisibleIds.includes(id))
      .map((id) => ({ id, name: userMap.get(id) || id.slice(0, 8) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activities, userMap, crmVisibleIds]);

  // Pre-filter activities to only include CRM-visible users
  const crmActivities = useMemo(() => {
    if (!crmVisibleIds) return activities;
    return activities.filter((a) => !a.assignedUserId || crmVisibleIds.includes(a.assignedUserId));
  }, [activities, crmVisibleIds]);

  const filteredActivities = useMemo(() => {
    if (selectedUserId === "all") return crmActivities;
    return crmActivities.filter((a) => a.assignedUserId === selectedUserId);
  }, [crmActivities, selectedUserId]);

  const columns = useMemo(() => {
    const cols: Record<string, Activity[]> = { "To Do": [], "In Progress": [], "Completed": [] };
    for (const a of filteredActivities) {
      const status = STATUS_COLUMNS.includes(a.status as any) ? a.status : null;
      if (status) cols[status].push(a);
    }
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

  const viewTitle = view === "board" ? "CRM Activity Board" : view === "analysis" ? "Activity Analysis" : "Current Week Planner";

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
              {viewTitle}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-5">
            <div className="py-4">
              {view === "board" ? (
                <>
                  {/* Toolbar */}
                  <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setView("analysis")} className="gap-1.5">
                      <BarChart3 className="h-4 w-4" />
                      Activity Analysis
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setView("coming-week")} className="gap-1.5">
                      <CalendarClock className="h-4 w-4" />
                      Current Week
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
                            <Badge variant="secondary" className="text-xs ml-auto">{items.length}</Badge>
                          </div>
                          <div className={`rounded-xl border p-2 min-h-[200px] space-y-2 ${statusStyle[status] || "border-border bg-muted/20"}`}>
                            {items.slice(0, visibleCounts[status] || 25).map((activity, i) => {
                              const Icon = typeIcon[activity.type] || ClipboardList;
                              const assignedName = activity.assignedUserId ? userMap.get(activity.assignedUserId) : null;
                              const farmName = activity.accountId ? accountMap.get(activity.accountId) : null;
                              return (
                                <motion.div
                                  key={activity.id}
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: Math.min(i, 25) * 0.015 }}
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
                              <p className="text-xs text-muted-foreground text-center py-8">No activities</p>
                            )}
                            {items.length > (visibleCounts[status] || 25) && (
                              <button
                                onClick={() => setVisibleCounts((prev) => ({ ...prev, [status]: (prev[status] || 25) + 25 }))}
                                className="text-xs text-primary hover:underline text-center w-full pt-1 cursor-pointer"
                              >
                                +{items.length - (visibleCounts[status] || 25)} more — show 25 more
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : view === "analysis" ? (
                <ActivityAnalysis
                  allActivities={crmActivities}
                  users={users}
                  accounts={accounts}
                  activeUsers={activeUsers}
                  selectedUserId={selectedUserId}
                  onBack={() => setView("board")}
                />
              ) : (
                <ComingWeekView
                  allActivities={crmActivities}
                  users={users}
                  accounts={accounts}
                  reports={reports}
                  activeUsers={activeUsers}
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
