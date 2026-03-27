import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAccounts, useQualityReports, useUsers, useCustomerFarms } from "@/hooks/useQualityData";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileDown, Search } from "lucide-react";
import { exportElementToPdf } from "@/lib/exportPdf";
import { toast } from "@/hooks/use-toast";
import { ReportDetailDialog } from "@/components/dashboard/ReportDetailDialog";
import type { QualityReport } from "@/lib/csvParser";

function weekYear(weekNr: number): number {
  return Math.floor(weekNr / 100);
}

function ratingLabel(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v === 1) return "Good";
  if (v === 2) return "Average";
  if (v === 3) return "Bad";
  return String(v);
}

function fmt(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

const AllReports = () => {
  const navigate = useNavigate();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: reports, isLoading: loadingReports } = useQualityReports();
  const { data: users } = useUsers();
  const { data: customerFarms } = useCustomerFarms();
  const { isCustomer, customerAccount } = useAuth();
  const tableRef = useRef<HTMLDivElement>(null);

  // Customer farm filter
  const customerAllowedFarmIds = useMemo(() => {
    if (!isCustomer || !customerAccount || !customerFarms) return null;
    return new Set(
      customerFarms
        .filter((cf) =>
          cf.customerAccountId === customerAccount.customerAccountId &&
          cf.farmAccountConsent === "1" &&
          !cf.deletedAt
        )
        .map((cf) => cf.farmAccountId)
    );
  }, [isCustomer, customerAccount, customerFarms]);

  const [selectedYear, setSelectedYear] = useState<string>("26");
  const [selectedFarm, setSelectedFarm] = useState<string>("all");
  const [selectedRating, setSelectedRating] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<QualityReport | null>(null);

  const accountMap = useMemo(() => {
    if (!accounts) return new Map<string, string>();
    return new Map(accounts.map((a) => [a.id, a.name]));
  }, [accounts]);

  const userMap = useMemo(() => {
    if (!users) return new Map<string, string>();
    return new Map(users.map((u) => [u.id, u.name]));
  }, [users]);

  const availableYears = useMemo(() => {
    if (!reports) return [];
    const years = new Set<number>();
    for (const r of reports) if (r.weekNr > 0) years.add(weekYear(r.weekNr));
    return [...years].sort((a, b) => b - a);
  }, [reports]);

  const filtered = useMemo(() => {
    if (!reports) return [];
    let data = [...reports].filter((r) => r.weekNr > 0 && r.submittedAt);
    if (customerAllowedFarmIds) {
      data = data.filter((r) => customerAllowedFarmIds.has(r.farmAccountId));
    }

    if (selectedYear !== "all") {
      const y = parseInt(selectedYear);
      data = data.filter((r) => weekYear(r.weekNr) === y);
    }
    if (selectedFarm !== "all") {
      data = data.filter((r) => r.farmAccountId === selectedFarm);
    }
    if (selectedRating !== "all") {
      const rating = parseInt(selectedRating);
      data = data.filter((r) => r.qrGenQualityRating === rating);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((r) => {
        const farmName = accountMap.get(r.farmAccountId) || "";
        const createdBy = userMap.get(r.createdByUserId || "") || "";
        return (
          farmName.toLowerCase().includes(q) ||
          createdBy.toLowerCase().includes(q) ||
          String(r.weekNr).includes(q) ||
          (r.qrGenQualityFlowers || "").toLowerCase().includes(q) ||
          (r.qrGenProtocolChanges || "").toLowerCase().includes(q) ||
          (r.generalComment || "").toLowerCase().includes(q)
        );
      });
    }

    data.sort((a, b) => {
      const yearDiff = weekYear(b.weekNr) - weekYear(a.weekNr);
      if (yearDiff !== 0) return yearDiff;
      const weekDiff = b.weekNr - a.weekNr;
      if (weekDiff !== 0) return weekDiff;
      const nameA = accountMap.get(a.farmAccountId) || "";
      const nameB = accountMap.get(b.farmAccountId) || "";
      return nameA.localeCompare(nameB);
    });

    return data;
  }, [reports, selectedYear, selectedFarm, selectedRating, search, accountMap, userMap]);

  const farmsInData = useMemo(() => {
    if (!reports || !accounts) return [];
    const ids = new Set(reports.map((r) => r.farmAccountId));
    return accounts.filter((a) => ids.has(a.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [reports, accounts]);

  const handleExport = useCallback(async () => {
    if (!tableRef.current) return;
    try {
      const el = tableRef.current;
      const prev = el.style.maxHeight;
      const prevOverflow = el.style.overflow;
      el.style.maxHeight = "none";
      el.style.overflow = "visible";

      // Hide columns beyond General Comment (keep first 8 columns: index 0-7)
      const VISIBLE_COLS = 8;
      const table = el.querySelector("table");
      const allRows = table ? table.querySelectorAll("tr") : [];
      const hiddenCells: HTMLElement[] = [];

      allRows.forEach((row, rowIdx) => {
        const cells = row.children;
        let colIdx = 0;
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i] as HTMLElement;
          const span = parseInt(cell.getAttribute("colspan") || "1", 10);
          if (colIdx + span > VISIBLE_COLS) {
            cell.style.display = "none";
            hiddenCells.push(cell);
          }
          colIdx += span;
        }
      });

      await exportElementToPdf(el, `all-reports${selectedYear !== "all" ? `-${selectedYear}` : ""}${selectedFarm !== "all" ? `-${accountMap.get(selectedFarm) || "farm"}` : ""}`, { orientation: "l", scale: 2, quality: 0.85 });

      // Restore hidden cells
      hiddenCells.forEach((cell) => { cell.style.display = ""; });
      el.style.maxHeight = prev;
      el.style.overflow = prevOverflow;
      toast({ title: "PDF exported" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }, [selectedYear, selectedFarm, accountMap]);

  const isLoading = loadingAccounts || loadingReports;

  return (
    <div className="min-h-screen bg-background">
      <div className="chrysal-gradient h-1.5" />
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">All Quality Reports</h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} report{filtered.length !== 1 ? "s" : ""} found
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6 bg-card rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search farm, week, or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 h-9"
            />
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>20{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedFarm} onValueChange={setSelectedFarm}>
            <SelectTrigger className="w-56 h-9">
              <SelectValue placeholder="Farm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Farms</SelectItem>
              {farmsInData.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRating} onValueChange={setSelectedRating}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="1">Good (1)</SelectItem>
              <SelectItem value="2">Average (2)</SelectItem>
              <SelectItem value="3">Bad (3)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <Skeleton className="h-[500px] rounded-xl" />
        ) : (
          <div ref={tableRef} className="bg-card rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {/* Identity */}
                    <th className="sticky left-0 bg-muted/30 z-10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Week</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Farm</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Created By</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Created</th>
                    {/* General */}
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-primary whitespace-nowrap border-l border-border">Quality Rating</th>
                    
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-primary whitespace-nowrap">Quality of Flowers</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-primary whitespace-nowrap">Protocol Changes</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-primary whitespace-nowrap">General Comment</th>
                    {/* Intake */}
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap border-l border-border">Head Size</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">Stem Length</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">Dipping Stand</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">Using Nets</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">pH (Intake)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">EC (Intake)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">Water Quality (Intake)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">Treatment (Intake)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">Temp °C (Intake)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">Humidity % (Intake)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-accent-foreground whitespace-nowrap">Hours (Intake)</th>
                    {/* Export */}
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap border-l border-border">pH (Export)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">EC (Export)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Water Quality (Export)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Treatment (Export)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Temp °C (Export)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Humidity % (Export)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Hours (Export)</th>
                    {/* Packhouse */}
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap border-l border-border">Processing Speed</th>
                    {/* Dispatch */}
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap border-l border-border">Packing Quality</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Pack Rate</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Liner Used</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Truck Type</th>
                    {/* Sign-off */}
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap border-l border-border">Sign-off</th>
                  </tr>
                  {/* Section header row */}
                  <tr className="border-b border-border bg-muted/10">
                    <th colSpan={4} className="sticky left-0 bg-muted/10 z-10 px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground"></th>
                    <th colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase text-primary border-l border-border">General</th>
                    <th colSpan={11} className="px-3 py-1 text-[10px] font-bold uppercase text-accent-foreground border-l border-border">Intake Area & Cold Store</th>
                    <th colSpan={7} className="px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground border-l border-border">Export Cold Store</th>
                    <th colSpan={1} className="px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground border-l border-border">Packhouse</th>
                    <th colSpan={4} className="px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground border-l border-border">Dispatch</th>
                    <th colSpan={1} className="px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground border-l border-border"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => setSelectedReport(r)}>
                      <td className="sticky left-0 bg-card z-10 px-3 py-2.5 font-medium tabular-nums whitespace-nowrap">{r.weekNr}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium">{accountMap.get(r.farmAccountId) || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{userMap.get(r.createdByUserId || "") || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-muted-foreground text-xs">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                      {/* General */}
                      <td className="px-3 py-2.5 whitespace-nowrap border-l border-border/30">{ratingLabel(r.qrGenQualityRating)}</td>
                      
                      <td className="px-3 py-2.5 max-w-[200px] truncate" title={r.qrGenQualityFlowers || ""}>{fmt(r.qrGenQualityFlowers)}</td>
                      <td className="px-3 py-2.5 max-w-[200px] truncate" title={r.qrGenProtocolChanges || ""}>{fmt(r.qrGenProtocolChanges)}</td>
                      <td className="px-3 py-2.5 max-w-[200px] truncate" title={r.generalComment || ""}>{fmt(r.generalComment)}</td>
                      {/* Intake */}
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap border-l border-border/30">{fmt(r.qrIntakeHeadSize)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrIntakeStemLength)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{fmt(r.qrIntakeDippingStand)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{fmt(r.qrIntakeUsingNets)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrIntakePh)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrIntakeEc)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{ratingLabel(r.qrIntakeWaterQuality)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{fmt(r.qrIntakeTreatment)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrIntakeTempColdstore)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrIntakeHumidityColdstore)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrIntakeColdstoreHours)}</td>
                      {/* Export */}
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap border-l border-border/30">{fmt(r.qrExportPh)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrExportEc)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{ratingLabel(r.qrExportWaterQuality)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{fmt(r.qrExportTreatment)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrExportTempColdstore)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrExportHumidityColdstore)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrExportColdstoreHours)}</td>
                      {/* Packhouse */}
                      <td className="px-3 py-2.5 whitespace-nowrap border-l border-border/30">{ratingLabel(r.qrPackProcessingSpeed)}</td>
                      {/* Dispatch */}
                      <td className="px-3 py-2.5 whitespace-nowrap border-l border-border/30">{ratingLabel(r.qrDispatchPackingQuality)}</td>
                      <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">{fmt(r.qrDispatchPackrate)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{fmt(r.qrDispatchUsedLiner)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{fmt(r.qrDispatchTruckType)}</td>
                      {/* Sign-off */}
                      <td className="px-3 py-2.5 whitespace-nowrap border-l border-border/30">{fmt(r.signoffName)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={30} className="px-4 py-12 text-center text-muted-foreground">
                        No reports match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <ReportDetailDialog
          report={selectedReport}
          farmName={selectedReport ? (accountMap.get(selectedReport.farmAccountId) || "Unknown") : ""}
          createdByName={selectedReport ? (userMap.get(selectedReport.createdByUserId || "") || "—") : "—"}
          open={!!selectedReport}
          onOpenChange={(open) => { if (!open) setSelectedReport(null); }}
        />
      </div>
    </div>
  );
};

export default AllReports;
