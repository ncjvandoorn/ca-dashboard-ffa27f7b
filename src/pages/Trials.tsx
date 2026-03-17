import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { loadTrials, buildCapacityTable, type Trial, type CapacityRow } from "@/lib/trialsParser";
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
import { ArrowLeft, ArrowUpDown, Search, Settings, LogOut } from "lucide-react";
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

  // Capacity planner: today + 90 days
  const today = new Date().toISOString().slice(0, 10);
  const capacityRows = useMemo(() => buildCapacityTable(trials, today, 90), [trials, today]);

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
            <div className="chrysal-gradient-subtle rounded-xl px-5 py-3 mb-6 flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <p className="text-sm text-foreground">
                Showing <span className="font-semibold">90-day</span> capacity forecast from today.
                VL Room max capacity: <span className="font-semibold">{VL_CAPACITY} vases</span>.
                {peakVL >= VL_CAPACITY && (
                  <span className="text-destructive font-semibold ml-2">⚠ Capacity exceeded on some days!</span>
                )}
              </p>
            </div>

            <div className="bg-card rounded-xl shadow-card overflow-hidden">
              <div className="overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="min-w-[100px] sticky left-0 bg-card z-20">Date</TableHead>
                      <TableHead className="text-center min-w-[70px]">Day</TableHead>
                      <TableHead className="text-center min-w-[70px]">CA1</TableHead>
                      <TableHead className="text-center min-w-[70px]">CA2</TableHead>
                      <TableHead className="text-center min-w-[70px]">CA3</TableHead>
                      <TableHead className="text-center min-w-[70px]">CA4</TableHead>
                      <TableHead className="text-center min-w-[100px]">Transport / Retail</TableHead>
                      <TableHead className="text-center min-w-[100px]">VL Room</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capacityRows.map((row) => {
                      const dayName = new Date(row.date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
                      const weekend = isWeekend(row.date);
                      const vlOver = row.vlRoom >= VL_CAPACITY;
                      return (
                        <TableRow key={row.date} className={weekend ? "bg-muted/30" : ""}>
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

            <div className="bg-card rounded-xl shadow-card overflow-hidden">
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
