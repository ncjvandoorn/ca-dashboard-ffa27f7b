import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccounts, useQualityReports, useActivities, useUsers, useCustomerFarms, useContainers, useServicesOrders, useShipperArrivals, useShipperReports } from "@/hooks/useQualityData";
import { useAuth } from "@/hooks/useAuth";
import { ControlBar } from "@/components/dashboard/ControlBar";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { DataLedger } from "@/components/dashboard/DataLedger";
import { QualityTables } from "@/components/dashboard/QualityTables";
import { ExceptionReport } from "@/components/dashboard/ExceptionReport";
import { SeasonalityInsights } from "@/components/dashboard/SeasonalityInsights";
import { FarmAIInsights } from "@/components/dashboard/FarmAIInsights";
import { ReportingCheck } from "@/components/dashboard/ReportingCheck";
import { AIAgent } from "@/components/dashboard/AIAgent";


import { Skeleton } from "@/components/ui/skeleton";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportElementToPdf } from "@/lib/exportPdf";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useSensiwatchTrips } from "@/hooks/useSensiwatchData";
import { isVisibleFarmReport } from "@/lib/reportVisibility";
import chrysalLogo from "@/assets/chrysal-logo.png";

function computeDelta(values: (number | null)[]): { text: string; type: "positive" | "negative" | "neutral" } {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return { text: "", type: "neutral" };
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  const diff = last - prev;
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${diff.toFixed(1)} vs prev week`,
    type: diff > 0 ? "positive" : diff < 0 ? "negative" : "neutral",
  };
}

function latest(values: (number | null)[]): string {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return "—";
  return valid[valid.length - 1].toFixed(1);
}

/** Extract 2-digit year from weekNr (e.g. 2340 → 23) */
function weekYear(weekNr: number): number {
  return Math.floor(weekNr / 100);
}

const Index = () => {
  const navigate = useNavigate();
  const { isAdmin, isCustomer, customerAccount } = useAuth();
  const { can } = usePermissions();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: reports, isLoading: loadingReports } = useQualityReports();
  const { data: activities } = useActivities();
  const { data: users } = useUsers();
  const { data: customerFarms } = useCustomerFarms();
  const { data: containers } = useContainers();
  const { data: servicesOrders } = useServicesOrders();
  const { data: shipperArrivals } = useShipperArrivals();
  const { data: shipperReports } = useShipperReports();
  const { data: sfTrips } = useSensiwatchTrips();
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("26");
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [seasonalityOpen, setSeasonalityOpen] = useState(false);
  
  const [exceptionAnalysis, setExceptionAnalysis] = useState<any>(null);
  const [seasonalityAnalysis, setSeasonalityAnalysis] = useState<any>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Load cached AI analyses for AI agent context
  useEffect(() => {
    async function loadCachedAnalyses() {
      const [exc, sea] = await Promise.all([
        supabase.from("exception_report_cache").select("analysis").order("created_at", { ascending: false }).limit(1).single(),
        supabase.from("seasonality_report_cache").select("analysis").order("created_at", { ascending: false }).limit(1).single(),
      ]);
      if (exc.data?.analysis) setExceptionAnalysis(exc.data.analysis);
      if (sea.data?.analysis) setSeasonalityAnalysis(sea.data.analysis);
    }
    loadCachedAnalyses();
  }, []);


  // Compute scoped farm visibility (selected customer + role-based customer access).
  // Fail closed while customer mappings are loading.
  const visibleFarmIds = useMemo(() => {
    if (!customerFarms) {
      if (isCustomer || selectedCustomerId) return new Set<string>();
      return null;
    }

    let allowed: Set<string> | null = null;

    if (selectedCustomerId) {
      allowed = new Set(
        customerFarms
          .filter((cf) =>
            cf.customerAccountId === selectedCustomerId &&
            cf.farmAccountConsent === "1" &&
            !cf.deletedAt
          )
          .map((cf) => cf.farmAccountId)
      );
    }

    if (isCustomer) {
      if (!customerAccount) return new Set<string>();

      const customerScoped = new Set(
        customerFarms
          .filter((cf) =>
            cf.customerAccountId === customerAccount.customerAccountId &&
            cf.farmAccountConsent === "1" &&
            !cf.deletedAt
          )
          .map((cf) => cf.farmAccountId)
      );

      allowed = allowed
        ? new Set([...allowed].filter((farmId) => customerScoped.has(farmId)))
        : customerScoped;
    }

    return allowed;
  }, [isCustomer, customerAccount, customerFarms, selectedCustomerId]);

  // For customers, auto-set customer filter and lock it
  useEffect(() => {
    if (isCustomer && customerAccount) {
      setSelectedCustomerId(customerAccount.customerAccountId);
    }
  }, [isCustomer, customerAccount]);

  const scopedReports = useMemo(() => {
    if (!reports) return [];
    if (!visibleFarmIds) return reports;
    return reports.filter((r) => visibleFarmIds.has(r.farmAccountId));
  }, [reports, visibleFarmIds]);

  const scopedAccounts = useMemo(() => {
    if (!accounts) return [];
    if (!visibleFarmIds) return accounts;
    return accounts.filter((a) => visibleFarmIds.has(a.id));
  }, [accounts, visibleFarmIds]);

  const scopedActivities = useMemo(() => {
    if (!activities) return [];
    if (!visibleFarmIds) return activities;
    return activities.filter((a) => visibleFarmIds.has(a.accountId));
  }, [activities, visibleFarmIds]);

  const visibleReports = useMemo(() => {
    return scopedReports.filter(isVisibleFarmReport);
  }, [scopedReports]);

  // Extract available years from scoped data
  const availableYears = useMemo(() => {
    if (!visibleReports.length) return [];
    const years = new Set<number>();
    for (const report of visibleReports) {
      years.add(weekYear(report.weekNr));
    }
    return [...years].sort((a, b) => b - a);
  }, [visibleReports]);

  // Filter reports by selected year inside the scoped visibility window
  const yearFilteredReports = useMemo(() => {
    if (!visibleReports.length) return [];
    return selectedYear === "all"
      ? visibleReports
      : visibleReports.filter((report) => weekYear(report.weekNr) === parseInt(selectedYear));
  }, [visibleReports, selectedYear]);

  // Farms that have data in the selected year, sorted alphabetically
  const farmsWithData = useMemo(() => {
    if (!scopedAccounts.length) return [];
    const farmIds = new Set(yearFilteredReports.map((report) => report.farmAccountId));
    return scopedAccounts.filter((account) => farmIds.has(account.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [scopedAccounts, yearFilteredReports]);

  // Auto-select first farm alphabetically when no valid selection exists
  const activeFarmId = useMemo(() => {
    if (selectedFarmId && farmsWithData.some((farm) => farm.id === selectedFarmId)) return selectedFarmId;
    return farmsWithData[0]?.id || "";
  }, [selectedFarmId, farmsWithData]);

  const farmReports = useMemo(() => {
    return yearFilteredReports
      .filter((report) => report.farmAccountId === activeFarmId)
      .sort((a, b) => a.weekNr - b.weekNr);
  }, [yearFilteredReports, activeFarmId]);

  const farmName = scopedAccounts.find((a) => a.id === activeFarmId)?.name || farmsWithData.find((a) => a.id === activeFarmId)?.name || "—";

  // Find the manager name from the last quality report's submittedByUserId
  const managerName = useMemo(() => {
    if (!farmReports.length || !users?.length) return null;
    const lastReport = farmReports[farmReports.length - 1];
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    return (
      (lastReport.submittedByUserId ? userMap.get(lastReport.submittedByUserId) : null) ||
      (lastReport.createdByUserId ? userMap.get(lastReport.createdByUserId) : null) ||
      (lastReport.updatedByUserId ? userMap.get(lastReport.updatedByUserId) : null) ||
      lastReport.signoffName ||
      null
    );
  }, [farmReports, users]);

  const handleDashboardExport = useCallback(async () => {
    if (!dashboardRef.current) return;
    try {
      await exportElementToPdf(dashboardRef.current, `dashboard-${farmName}-${selectedYear}`);
      toast({ title: "PDF exported" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }, [farmName, selectedYear]);

  const intakePh = farmReports.map((r) => r.qrIntakePh);
  const intakeEc = farmReports.map((r) => r.qrIntakeEc);
  const exportTemp = farmReports.map((r) => r.qrExportTempColdstore);
  const exportHumidity = farmReports.map((r) => r.qrExportHumidityColdstore);

  const sparkOf = (arr: (number | null)[]) =>
    arr.filter((v): v is number => v !== null).map((v) => ({ v }));

  const trendIntake = farmReports.map((r) => ({
    week: r.weekNr,
    pH: r.qrIntakePh,
    EC: r.qrIntakeEc,
  }));

  const trendColdstore = farmReports.map((r) => ({
    week: r.weekNr,
    "Temp (Intake)": r.qrIntakeTempColdstore,
    "Humidity (Intake)": r.qrIntakeHumidityColdstore,
    "Temp (Export)": r.qrExportTempColdstore,
    "Humidity (Export)": r.qrExportHumidityColdstore,
  }));

  const trendExport = farmReports.map((r) => ({
    week: r.weekNr,
    "pH (Export)": r.qrExportPh,
    "EC (Export)": r.qrExportEc,
  }));

  const isLoading = loadingAccounts || loadingReports;

  const chrysalBlue = "hsl(207, 100%, 35%)";
  const chrysalGreen = "hsl(90, 67%, 41%)";
  const chrysalMidBlue = "hsl(207, 60%, 57%)";
  const chrysalWarm = "hsl(38, 92%, 50%)";

  return (
    <div className="min-h-screen bg-background">
      <div className="chrysal-gradient h-1.5" />
      
      <div className="max-w-[1400px] mx-auto px-6">
        {isLoading ? (
          <div className="pt-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="rounded-xl px-3 py-2 flex items-center bg-card border border-border/50 shadow-sm shrink-0">
                <img src={chrysalLogo} alt="Chrysal" className="h-6 w-auto max-w-none block shrink-0" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-[340px] rounded-xl" />
          </div>
        ) : (
          <div ref={dashboardRef}>
            <ControlBar
              accounts={farmsWithData}
              allAccounts={scopedAccounts}
              selectedFarmId={activeFarmId}
              onFarmChange={setSelectedFarmId}
              years={availableYears}
              selectedYear={selectedYear}
              onYearChange={(y) => {
                setSelectedYear(y);
              }}
              farmCount={farmsWithData.length}
              customerFarms={customerFarms || []}
              selectedCustomerId={selectedCustomerId}
              onCustomerChange={(id) => {
                setSelectedCustomerId(id);
                if (id) {
                  const allowedFarmIds = new Set(
                    (customerFarms || [])
                      .filter((cf) =>
                        cf.customerAccountId === id &&
                        cf.farmAccountConsent === "1" &&
                        !cf.deletedAt
                      )
                      .map((cf) => cf.farmAccountId)
                  );
                  const sorted = farmsWithData
                    .filter((f) => allowedFarmIds.has(f.id))
                    .sort((a, b) => a.name.localeCompare(b.name));
                  setSelectedFarmId(sorted[0]?.id || "");
                } else {
                  setSelectedFarmId("");
                }
              }}
              onOpenContainers={!isCustomer ? () => navigate("/containers") : undefined}
            />

            {/* Action buttons row */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <AIAgent
                reports={scopedReports}
                accounts={scopedAccounts}
                activities={isCustomer ? [] : scopedActivities}
                users={isCustomer ? [] : (users || [])}
                exceptionAnalysis={visibleFarmIds ? null : exceptionAnalysis}
                seasonalityAnalysis={visibleFarmIds ? null : seasonalityAnalysis}
                containers={isCustomer ? [] : (containers || [])}
                servicesOrders={isCustomer ? [] : (servicesOrders || [])}
                shipperArrivals={isCustomer ? [] : (shipperArrivals || [])}
                shipperReports={isCustomer ? [] : (shipperReports || [])}
                sfTrips={isCustomer ? [] : (sfTrips || [])}
              />
              {/* CRM moved to dedicated /crm page (menu: CRM Activities) */}
              <Button variant="outline" size="sm" onClick={() => navigate("/report")} className="gap-2">
                All Reports
              </Button>
              {isAdmin && (
                <ReportingCheck
                  reports={yearFilteredReports}
                  accounts={scopedAccounts}
                  users={users || []}
                />
              )}
              {!isCustomer && (
                <SeasonalityInsights
                  reports={yearFilteredReports}
                  accounts={scopedAccounts}
                  open={seasonalityOpen}
                  onOpenChange={setSeasonalityOpen}
                />
              )}
              <ExceptionReport
                reports={yearFilteredReports}
                accounts={scopedAccounts}
                onSelectFarm={(id) => { setSelectedFarmId(id); }}
                open={exceptionOpen}
                onOpenChange={setExceptionOpen}
                hideRefresh={isCustomer}
                useSharedCache={true}
              />
              <Button variant="outline" size="sm" onClick={handleDashboardExport} className="gap-2">
                <FileDown className="h-4 w-4" />
                Export PDF
              </Button>
            </div>

            {/* Farm info strip */}
            <div className="chrysal-gradient-subtle rounded-xl px-5 py-3 mb-6 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-accent shrink-0" />
              <p className="text-base text-foreground">
                Showing <span className="font-bold text-primary">{farmReports.length}</span> reports for{" "}
                <span className="font-bold text-primary">{farmName}</span>
                {managerName && (
                  <span className="text-muted-foreground font-medium"> | {managerName}</span>
                )}
                {selectedYear !== "all" && (
                  <span className="text-muted-foreground font-medium"> · 20{selectedYear}</span>
                )}
              </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                label="pH (Intake)"
                value={latest(intakePh)}
                delta={computeDelta(intakePh).text}
                deltaType={computeDelta(intakePh).type}
                sparkData={sparkOf(intakePh)}
                color={chrysalBlue}
                index={0}
              />
              <MetricCard
                label="EC (Intake)"
                value={latest(intakeEc)}
                unit="μS"
                delta={computeDelta(intakeEc).text}
                deltaType={computeDelta(intakeEc).type}
                sparkData={sparkOf(intakeEc)}
                color={chrysalMidBlue}
                index={1}
              />
              <MetricCard
                label="Temperature (Export)"
                value={latest(exportTemp)}
                unit="°C"
                delta={computeDelta(exportTemp).text}
                deltaType={computeDelta(exportTemp).type}
                sparkData={sparkOf(exportTemp)}
                color={chrysalWarm}
                index={2}
              />
              <MetricCard
                label="Humidity (Export)"
                value={latest(exportHumidity)}
                unit="%"
                delta={computeDelta(exportHumidity).text}
                deltaType={computeDelta(exportHumidity).type}
                sparkData={sparkOf(exportHumidity)}
                color={chrysalGreen}
                index={3}
              />
            </div>

            {/* AI Insights for selected farm */}
            <FarmAIInsights farmId={activeFarmId} farmName={farmName} activities={activities || []} reports={reports || []} users={users || []} hideActivity={isCustomer} />

            {/* Quality Tables */}
            <QualityTables reports={farmReports} />

            {/* Trend Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <TrendChart
                title="Intake — pH & EC over time"
                data={trendIntake}
                lines={[
                  { key: "pH", label: "pH", color: chrysalBlue, yAxisId: "left" },
                  { key: "EC", label: "EC (μS)", color: chrysalMidBlue, yAxisId: "right" },
                ]}
              />
              <TrendChart
                title="Export — pH & EC over time"
                data={trendExport}
                lines={[
                  { key: "pH (Export)", label: "pH", color: chrysalBlue, yAxisId: "left" },
                  { key: "EC (Export)", label: "EC (μS)", color: chrysalMidBlue, yAxisId: "right" },
                ]}
              />
            </div>

            <div className="mb-8">
              <TrendChart
                title="Cold Store — Temperature & Humidity"
                data={trendColdstore}
                lines={[
                  { key: "Temp (Intake)", label: "Temp (Intake)", color: chrysalWarm },
                  { key: "Humidity (Intake)", label: "Humidity (Intake)", color: chrysalGreen },
                  { key: "Temp (Export)", label: "Temp (Export)", color: "hsl(0, 72%, 51%)" },
                  { key: "Humidity (Export)", label: "Humidity (Export)", color: chrysalMidBlue },
                ]}
              />
            </div>

            <div className="mb-12">
              <DataLedger reports={farmReports} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
