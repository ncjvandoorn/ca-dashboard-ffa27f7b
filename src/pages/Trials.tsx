import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { loadTrials, buildCapacityTable, type Trial, type CapacityRow, type CapacityTrialInfo } from "@/lib/trialsParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, ArrowUpDown, Search, Settings, LogOut, Download, History, CalendarDays } from "lucide-react";
import { exportElementToPdf } from "@/lib/exportPdf";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VL_CAPACITY = 376;

function formatDate(d: string): string {
  if (!d) return "—";
  return d; // already YYYY-MM-DD
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

type SortKey = keyof Trial;
type SortDir = "asc" | "desc";

export default function Trials() {
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [cropFilter, setCropFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("vlStart");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [exporting, setExporting] = useState(false);
  const capacityRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);

  const handleExport = async (ref: React.RefObject<HTMLDivElement | null>, name: string) => {
    if (!ref.current || exporting) return;
    setExporting(true);
    try {
      await exportElementToPdf(ref.current, name);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadTrials().then((data) => {
      setTrials(data);
      setLoading(false);
    });
  }, []);

  // Filters for dropdowns
  const trialTypes = useMemo(() => [...new Set(trials.map((t) => t.trialType))].sort(), [trials]);
  const clients = useMemo(() => [...new Set(trials.map((t) => t.trialClient))].filter(Boolean).sort(), [trials]);
  const crops = useMemo(() => [...new Set(trials.map((t) => t.flowerCrop))].filter(Boolean).sort(), [trials]);

  // Filtered & sorted trials
  const filteredTrials = useMemo(() => {
    let list = trials;
    if (typeFilter !== "all") list = list.filter((t) => t.trialType === typeFilter);
    if (clientFilter !== "all") list = list.filter((t) => t.trialClient === clientFilter);
    if (cropFilter !== "all") list = list.filter((t) => t.flowerCrop === cropFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.trialNumber.toLowerCase().includes(q) ||
          t.trialReference.toLowerCase().includes(q) ||
          t.farm.toLowerCase().includes(q) ||
          t.customer.toLowerCase().includes(q) ||
          t.variety.toLowerCase().includes(q) ||
          t.flowerCrop.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [trials, typeFilter, clientFilter, cropFilter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Capacity planner
  const [capacityView, setCapacityView] = useState<"future" | "history">("future");
  const today = new Date().toISOString().slice(0, 10);

  const capacityRows = useMemo(() => {
    if (capacityView === "future") {
      return buildCapacityTable(trials, today, 90);
    } else {
      const start = new Date();
      start.setDate(start.getDate() - 90);
      return buildCapacityTable(trials, start.toISOString().slice(0, 10), 90);
    }
  }, [trials, today, capacityView]);

  // Find peak VL usage
  const peakVL = useMemo(() => Math.max(...capacityRows.map((r) => r.vlRoom), 0), [capacityRows]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="chrysal-gradient h-1.5" />
        <div className="max-w-[1400px] mx-auto px-6 pt-8 space-y-6">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="chrysal-gradient h-1.5" />
      <div className="max-w-[1600px] mx-auto px-6">
        {/* Header */}
        <header className="sticky top-0 z-10 backdrop-blur-sm py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="chrysal-gradient rounded-xl px-4 py-2">
                <span className="text-lg font-bold tracking-wide text-primary-foreground">CHRYSAL</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Trial Planning</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Capacity planner & trial overview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
              <div className="flex items-center gap-1 ml-2 border-l border-border pl-3">
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} title="Admin Settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign Out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <Tabs defaultValue="capacity" className="mb-8">
          <TabsList className="mb-6">
            <TabsTrigger value="capacity">Capacity Planner</TabsTrigger>
            <TabsTrigger value="overview">Trial Overview ({trials.length})</TabsTrigger>
          </TabsList>

          {/* ─── CAPACITY PLANNER ─── */}
          <TabsContent value="capacity">
            <div className="flex items-center gap-4 mb-6">
              <div className="chrysal-gradient-subtle rounded-xl px-5 py-3 flex items-center gap-4 flex-1">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <p className="text-sm text-foreground">
                  Showing <span className="font-semibold">90-day</span> {capacityView === "future" ? "forecast" : "history"}.
                  VL Room max capacity: <span className="font-semibold">{VL_CAPACITY} vases</span>.
                  CA rooms counted in <span className="font-semibold">boxes</span>. Transport/Retail &amp; VL Room in <span className="font-semibold">vases</span>.
                  {peakVL >= VL_CAPACITY && (
                    <span className="text-destructive font-semibold ml-2">⚠ Capacity exceeded on some days!</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant={capacityView === "history" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCapacityView("history")}
                >
                  <History className="h-3.5 w-3.5" />
                  Last 90 days
                </Button>
                <Button
                  variant={capacityView === "future" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCapacityView("future")}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Next 90 days
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 ml-2" disabled={exporting} onClick={() => handleExport(capacityRef, "Capacity-Planner")}>
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            </div>
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="min-w-[100px] sticky left-0 bg-card z-20">Date</TableHead>
                      <TableHead className="text-center min-w-[70px]">Day</TableHead>
                      <TableHead className="text-center min-w-[70px]">CA1 (boxes)</TableHead>
                      <TableHead className="text-center min-w-[70px]">CA2 (boxes)</TableHead>
                      <TableHead className="text-center min-w-[70px]">CA3 (boxes)</TableHead>
                      <TableHead className="text-center min-w-[70px]">CA4 (boxes)</TableHead>
                      <TableHead className="text-center min-w-[100px]">Transport / Retail</TableHead>
                      <TableHead className="text-center min-w-[100px]">VL Room</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capacityRows.map((row) => {
                      const dayName = new Date(row.date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
                      const weekend = isWeekend(row.date);
                      const vlOver = row.vlRoom >= VL_CAPACITY;
                      const hasTrials = row.trials.length > 0;
                      return (
                        <Popover key={row.date}>
                          <PopoverTrigger asChild>
                            <TableRow className={`${weekend ? "bg-muted/30" : ""} ${hasTrials ? "cursor-pointer hover:bg-accent/10" : ""}`}>
                              <TableCell className="font-mono text-xs sticky left-0 bg-card z-10">{row.date}</TableCell>
                              <TableCell className="text-center text-xs text-muted-foreground">{dayName}</TableCell>
                              <TableCell className="text-center tabular-nums">{row.ca1 || ""}</TableCell>
                              <TableCell className="text-center tabular-nums">{row.ca2 || ""}</TableCell>
                              <TableCell className="text-center tabular-nums">{row.ca3 || ""}</TableCell>
                              <TableCell className="text-center tabular-nums">{row.ca4 || ""}</TableCell>
                              <TableCell className="text-center tabular-nums">{row.transport || ""}</TableCell>
                              <TableCell className={`text-center tabular-nums font-semibold ${vlOver ? "text-destructive bg-destructive/10" : row.vlRoom > 0 ? "text-primary" : ""}`}>
                                {row.vlRoom || ""}
                              </TableCell>
                            </TableRow>
                          </PopoverTrigger>
                          {hasTrials && (
                            <PopoverContent className="w-[420px] max-h-[400px] overflow-auto p-0" side="bottom" align="center">
                              <div className="px-4 py-3 border-b border-border">
                                <p className="text-sm font-semibold">{row.date} — {row.trials.length} trial(s)</p>
                              </div>
                              <div className="divide-y divide-border">
                                {row.trials.map((info, idx) => (
                                  <div key={idx} className="px-4 py-3 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-mono text-muted-foreground">{info.trial.trialReference}</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        info.phase === "ca" ? "bg-secondary text-secondary-foreground" :
                                        info.phase === "transport" ? "bg-warning/15 text-warning" :
                                        "bg-primary/10 text-primary"
                                      }`}>
                                        {info.phase === "ca" ? `CA (${info.chamber})` : info.phase === "transport" ? "Transport/Retail" : "VL Room"}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                                      <span className="text-muted-foreground">Farm</span><span>{info.trial.farm}</span>
                                      <span className="text-muted-foreground">Customer</span><span>{info.trial.customer}</span>
                                      <span className="text-muted-foreground">Client</span><span>{info.trial.trialClient}</span>
                                      <span className="text-muted-foreground">Type</span><span>{info.trial.trialType}</span>
                                      <span className="text-muted-foreground">Crop</span><span>{info.trial.flowerCrop}</span>
                                      <span className="text-muted-foreground">Variety</span><span>{info.trial.variety}</span>
                                      <span className="text-muted-foreground">Vases</span><span>{info.trial.bunches}</span>
                                      {info.trial.caDuration > 0 && (<><span className="text-muted-foreground">CA Duration</span><span>{info.trial.caDuration} days</span></>)}
                                      {info.trial.vlDuration > 0 && (<><span className="text-muted-foreground">VL Duration</span><span>{info.trial.vlDuration} days</span></>)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </PopoverContent>
                          )}
                        </Popover>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* ─── TRIAL OVERVIEW ─── */}
          <TabsContent value="overview">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Button variant="outline" size="sm" className="gap-2 shrink-0" disabled={exporting} onClick={() => handleExport(overviewRef, "Trial-Overview")}>
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search trial, farm, variety…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {trialTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cropFilter} onValueChange={setCropFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Crop" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All crops</SelectItem>
                  {crops.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground tabular-nums">{filteredTrials.length} trials</span>
            </div>

            <div ref={overviewRef} className="bg-card rounded-xl shadow-card overflow-hidden">
              <div className="overflow-auto max-h-[700px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      {([
                        ["trialNumber", "Trial #"],
                        ["trialReference", "Reference"],
                        ["trialType", "Type"],
                        ["trialClient", "Client"],
                        ["customer", "Customer"],
                        ["farm", "Farm"],
                        ["flowerCrop", "Crop"],
                        ["variety", "Variety"],
                        ["harvestDate", "Harvest"],
                        ["startDate", "Start"],
                        ["vlStart", "VL Start"],
                        ["vlEnd", "VL End"],
                        ["bunches", "Vases"],
                        ["caChamber", "CA Chamber"],
                        ["caDuration", "CA Days"],
                        ["vlDuration", "VL Days"],
                      ] as [SortKey, string][]).map(([key, label]) => (
                        <TableHead key={key} className="min-w-[90px] cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(key)}>
                          <span className="inline-flex items-center gap-1">
                            {label}
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrials.map((t, i) => (
                      <TableRow key={`${t.trialNumber}-${i}`}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{t.trialNumber}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{t.trialReference}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            t.trialType === "SF"
                              ? "bg-warning/15 text-warning"
                              : "bg-primary/10 text-primary"
                          }`}>
                            {t.trialType}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{t.trialClient}</TableCell>
                        <TableCell className="text-xs">{t.customer}</TableCell>
                        <TableCell className="text-xs">{t.farm}</TableCell>
                        <TableCell className="text-xs">{t.flowerCrop}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate" title={t.variety}>{t.variety}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDate(t.harvestDate)}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDate(t.startDate)}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDate(t.vlStart)}</TableCell>
                        <TableCell className="text-xs font-mono">{formatDate(t.vlEnd)}</TableCell>
                        <TableCell className="text-center tabular-nums">{t.bunches}</TableCell>
                        <TableCell className="text-xs">{t.caChamber || "—"}</TableCell>
                        <TableCell className="text-center tabular-nums">{t.caDuration || "—"}</TableCell>
                        <TableCell className="text-center tabular-nums">{t.vlDuration}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
