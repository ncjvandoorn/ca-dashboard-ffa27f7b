import { useState, useMemo } from "react";
import { useAccounts, useQualityReports } from "@/hooks/useQualityData";
import { ControlBar } from "@/components/dashboard/ControlBar";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { DataLedger } from "@/components/dashboard/DataLedger";
import { Skeleton } from "@/components/ui/skeleton";

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

const Index = () => {
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: reports, isLoading: loadingReports } = useQualityReports();
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");

  const farmsWithData = useMemo(() => {
    if (!accounts || !reports) return [];
    const farmIds = new Set(reports.map((r) => r.farmAccountId));
    return accounts.filter((a) => farmIds.has(a.id));
  }, [accounts, reports]);

  const activeFarmId = selectedFarmId || farmsWithData[0]?.id || "";

  const farmReports = useMemo(() => {
    if (!reports) return [];
    return reports
      .filter((r) => r.farmAccountId === activeFarmId && r.weekNr > 0)
      .sort((a, b) => a.weekNr - b.weekNr);
  }, [reports, activeFarmId]);

  const farmName = farmsWithData.find((a) => a.id === activeFarmId)?.name || "—";

  const intakePh = farmReports.map((r) => r.qrIntakePh);
  const intakeEc = farmReports.map((r) => r.qrIntakeEc);
  const intakeTemp = farmReports.map((r) => r.qrIntakeTempColdstore);
  const intakeHumidity = farmReports.map((r) => r.qrIntakeHumidityColdstore);

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

  // Chrysal brand colors
  const chrysalBlue = "hsl(207, 100%, 35%)";
  const chrysalGreen = "hsl(90, 67%, 41%)";
  const chrysalMidBlue = "hsl(207, 60%, 57%)";
  const chrysalWarm = "hsl(38, 92%, 50%)";

  return (
    <div className="min-h-screen bg-background">
      {/* Chrysal branded header bar */}
      <div className="chrysal-gradient h-1.5" />
      
      <div className="max-w-[1400px] mx-auto px-6">
        {isLoading ? (
          <div className="pt-8 space-y-6">
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-[340px] rounded-xl" />
          </div>
        ) : (
          <>
            <ControlBar
              accounts={farmsWithData}
              selectedFarmId={activeFarmId}
              onFarmChange={setSelectedFarmId}
            />

            {/* Summary strip */}
            <div className="chrysal-gradient-subtle rounded-xl px-5 py-3 mb-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <p className="text-sm text-foreground">
                Showing <span className="font-semibold">{farmReports.length}</span> reports for{" "}
                <span className="font-semibold">{farmName}</span>
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
                label="Temperature (Intake)"
                value={latest(intakeTemp)}
                unit="°C"
                delta={computeDelta(intakeTemp).text}
                deltaType={computeDelta(intakeTemp).type}
                sparkData={sparkOf(intakeTemp)}
                color={chrysalWarm}
                index={2}
              />
              <MetricCard
                label="Humidity (Intake)"
                value={latest(intakeHumidity)}
                unit="%"
                delta={computeDelta(intakeHumidity).text}
                deltaType={computeDelta(intakeHumidity).type}
                sparkData={sparkOf(intakeHumidity)}
                color={chrysalGreen}
                index={3}
              />
            </div>

            {/* Trend Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <TrendChart
                title="Intake — pH & EC over time"
                data={trendIntake}
                lines={[
                  { key: "pH", label: "pH", color: chrysalBlue },
                  { key: "EC", label: "EC", color: chrysalMidBlue },
                ]}
              />
              <TrendChart
                title="Export — pH & EC over time"
                data={trendExport}
                lines={[
                  { key: "pH (Export)", label: "pH", color: chrysalBlue },
                  { key: "EC (Export)", label: "EC", color: chrysalMidBlue },
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
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
