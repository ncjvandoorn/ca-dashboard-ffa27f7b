import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, LineChart, Line,
} from "recharts";
import { ArrowLeft, Loader2, Flower2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccounts, useServicesOrders, useCustomerFarms } from "@/hooks/useQualityData";
import { useOrderDay } from "@/hooks/useOrderDay";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { useAuth } from "@/hooks/useAuth";

/** YYWW (Sat-Fri week, week containing Jan 1 = week 1). Matches project memory rule. */
function weekFromMs(ms: number): { year: number; week: number } {
  const d = new Date(ms);
  const daysSinceSat = (d.getUTCDay() + 1) % 7;
  const sat = new Date(d);
  sat.setUTCDate(d.getUTCDate() - daysSinceSat);
  const year = sat.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1DaysSinceSat = (jan1.getUTCDay() + 1) % 7;
  const week1Sat = new Date(jan1);
  week1Sat.setUTCDate(jan1.getUTCDate() - jan1DaysSinceSat);
  const week = Math.floor((sat.getTime() - week1Sat.getTime()) / (7 * 86400000)) + 1;
  return { year, week };
}

function parseDateMs(raw: any): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d{10,}$/.test(raw)) return Number(raw);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.getTime();
}

const YEAR_COLORS: Record<number, string> = {
  2024: "hsl(210, 80%, 75%)",
  2025: "hsl(210, 80%, 50%)",
  2026: "hsl(150, 70%, 50%)",
  2027: "hsl(280, 70%, 55%)",
};
const PURPOSE_COLORS: Record<string, string> = {
  "Air Freight": "hsl(210, 80%, 50%)",
  "Long Storage": "hsl(20, 70%, 65%)",
  "Sea Freight": "hsl(220, 60%, 30%)",
};
const fallbackColor = "hsl(var(--muted-foreground))";

export default function RoseDip() {
  const navigate = useNavigate();
  const { isCustomer, customerAccount } = useAuth();
  const { data: accounts, isLoading: la } = useAccounts();
  const { data: servicesOrders, isLoading: lso } = useServicesOrders();
  const { data: customerFarms, isLoading: lcf } = useCustomerFarms();
  const { data: orderDay, isLoading: lod } = useOrderDay(undefined, true);

  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedFarm, setSelectedFarm] = useState<string>("all");
  const [selectedPurpose, setSelectedPurpose] = useState<string>("all");
  const [ytd, setYtd] = useState<boolean>(true);

  const currentWeek = useMemo(() => weekFromMs(Date.now()).week, []);

  // Customer scoping: restrict to farms with consent=1 linked to their customer account.
  // Fail closed while loading.
  const customerAllowedFarmIds = useMemo<Set<string> | null>(() => {
    if (!isCustomer) return null;
    if (!customerAccount || !customerFarms) return new Set();
    return new Set(
      customerFarms
        .filter(
          (cf) =>
            cf.customerAccountId === customerAccount.customerAccountId &&
            cf.farmAccountConsent === "1" &&
            !cf.deletedAt,
        )
        .map((cf) => cf.farmAccountId),
    );
  }, [isCustomer, customerAccount, customerFarms]);

  const accountById = useMemo(() => {
    const m = new Map<string, string>();
    (accounts || []).forEach((a) => m.set(a.id, a.name));
    return m;
  }, [accounts]);

  const orderById = useMemo(() => {
    const m = new Map<string, { farmAccountId: string; customerAccountId: string; purposeName: string }>();
    (servicesOrders || []).forEach((o) => {
      // Customer scope: only include orders for their customer account AND allowed farms.
      if (isCustomer) {
        if (!customerAccount) return;
        if (o.customerAccountId !== customerAccount.customerAccountId) return;
        if (customerAllowedFarmIds && !customerAllowedFarmIds.has(o.farmAccountId)) return;
      }
      m.set(o.id, {
        farmAccountId: o.farmAccountId,
        customerAccountId: o.customerAccountId,
        purposeName: o.purposeName || "Unknown",
      });
    });
    return m;
  }, [servicesOrders, isCustomer, customerAccount, customerAllowedFarmIds]);

  /** Joined + filtered rows. */
  const rows = useMemo(() => {
    if (!orderDay) return [];
    const out: {
      year: number;
      week: number;
      farmId: string;
      farmName: string;
      customerId: string;
      customerName: string;
      purpose: string;
      stems: number;
      forecast: number;
    }[] = [];
    for (const r of orderDay) {
      const ms = parseDateMs(r.date);
      if (!ms) continue;
      const so = r.servicesOrderId ? orderById.get(r.servicesOrderId) : undefined;
      if (!so) continue;
      const { year, week } = weekFromMs(ms);
      out.push({
        year,
        week,
        farmId: so.farmAccountId,
        farmName: accountById.get(so.farmAccountId) || "Unknown farm",
        customerId: so.customerAccountId,
        customerName: accountById.get(so.customerAccountId) || "Unknown customer",
        purpose: so.purposeName,
        stems: Number(r.stems) || 0,
        forecast: Number(r.forecast) || 0,
      });
    }
    return out;
  }, [orderDay, orderById, accountById]);

  const years = useMemo(
    () => Array.from(new Set(rows.map((r) => r.year))).sort(),
    [rows],
  );
  const customers = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.customerId && m.set(r.customerId, r.customerName));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const farms = useMemo(() => {
    const m = new Map<string, string>();
    rows
      .filter((r) => selectedCustomer === "all" || r.customerId === selectedCustomer)
      .forEach((r) => r.farmId && m.set(r.farmId, r.farmName));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, selectedCustomer]);
  const purposes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.purpose))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (selectedYear !== "all" && r.year !== Number(selectedYear)) return false;
      if (selectedCustomer !== "all" && r.customerId !== selectedCustomer) return false;
      if (selectedFarm !== "all" && r.farmId !== selectedFarm) return false;
      if (selectedPurpose !== "all" && r.purpose !== selectedPurpose) return false;
      if (ytd && r.week > currentWeek) return false;
      return true;
    });
  }, [rows, selectedYear, selectedCustomer, selectedFarm, selectedPurpose, ytd, currentWeek]);

  // ── Aggregations ────────────────────────────────────────────────────────

  /** Stems per dipping week, split by year. */
  const stemsPerWeekByYear = useMemo(() => {
    const map = new Map<number, Record<string, number | string>>();
    const yearSet = new Set<number>();
    for (const r of filtered) {
      yearSet.add(r.year);
      const ex = (map.get(r.week) as any) || { week: r.week };
      ex[r.year] = (ex[r.year] || 0) + r.stems;
      map.set(r.week, ex);
    }
    return {
      data: Array.from(map.values()).sort((a: any, b: any) => a.week - b.week),
      years: Array.from(yearSet).sort(),
    };
  }, [filtered]);

  /** Total stems per year, stacked by purpose. */
  const stemsByYearStacked = useMemo(() => {
    const map = new Map<number, Record<string, number | string>>();
    const purposeSet = new Set<string>();
    for (const r of filtered) {
      purposeSet.add(r.purpose);
      const ex = (map.get(r.year) as any) || { year: r.year };
      ex[r.purpose] = (ex[r.purpose] || 0) + r.stems;
      map.set(r.year, ex);
    }
    return {
      data: Array.from(map.values()).sort((a: any, b: any) => a.year - b.year),
      purposes: Array.from(purposeSet).sort(),
    };
  }, [filtered]);

  /** Stems per dipping week, stacked by purpose. */
  const stemsByWeekPurpose = useMemo(() => {
    const map = new Map<number, Record<string, number | string>>();
    const purposeSet = new Set<string>();
    for (const r of filtered) {
      purposeSet.add(r.purpose);
      const ex = (map.get(r.week) as any) || { week: r.week };
      ex[r.purpose] = (ex[r.purpose] || 0) + r.stems;
      map.set(r.week, ex);
    }
    return {
      data: Array.from(map.values()).sort((a: any, b: any) => a.week - b.week),
      purposes: Array.from(purposeSet).sort(),
    };
  }, [filtered]);

  /** Forecast vs actual by week. */
  const forecastVsActual = useMemo(() => {
    const map = new Map<number, { week: number; forecast: number; stems: number }>();
    for (const r of filtered) {
      const ex = map.get(r.week) || { week: r.week, forecast: 0, stems: 0 };
      ex.forecast += r.forecast;
      ex.stems += r.stems;
      map.set(r.week, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.week - b.week);
  }, [filtered]);

  /** Stems per farm per year (top 12 farms by total). */
  const stemsByFarmYear = useMemo(() => {
    const farmTotals = new Map<string, number>();
    const farmNameMap = new Map<string, string>();
    for (const r of filtered) {
      farmTotals.set(r.farmId, (farmTotals.get(r.farmId) || 0) + r.stems);
      farmNameMap.set(r.farmId, r.farmName);
    }
    const topFarmIds = Array.from(farmTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id]) => id);
    const topSet = new Set(topFarmIds);
    const map = new Map<string, Record<string, number | string>>();
    const yearSet = new Set<number>();
    for (const r of filtered) {
      if (!topSet.has(r.farmId)) continue;
      yearSet.add(r.year);
      const ex = (map.get(r.farmId) as any) || { farm: farmNameMap.get(r.farmId) || "Unknown" };
      ex[r.year] = (ex[r.year] || 0) + r.stems;
      map.set(r.farmId, ex);
    }
    const data = topFarmIds.map((id) => map.get(id)!).filter(Boolean);
    return { data, years: Array.from(yearSet).sort() };
  }, [filtered]);

  /** Year totals + average stem price (placeholder = 0 if no price source). */
  const yearTotals = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of filtered) map.set(r.year, (map.get(r.year) || 0) + r.stems);
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, stems]) => ({ year, stems }));
  }, [filtered]);

  const isLoading = la || lso || lod || (isCustomer && lcf);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <Flower2 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Rose Dip</h1>
            </div>
          </div>
          <PageHeaderActions />
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Year</label>
                <div className="flex gap-2">
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant={ytd ? "default" : "outline"}
                    size="sm"
                    onClick={() => setYtd((v) => !v)}
                    title={`Limit to weeks 1–${currentWeek}`}
                  >
                    YTD
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Customer</label>
                <Select value={selectedCustomer} onValueChange={(v) => { setSelectedCustomer(v); setSelectedFarm("all"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All customers</SelectItem>
                    {customers.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Farm</label>
                <Select value={selectedFarm} onValueChange={setSelectedFarm}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All farms</SelectItem>
                    {farms.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Freight Type</label>
                <Select value={selectedPurpose} onValueChange={setSelectedPurpose}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All freight types</SelectItem>
                    {purposes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading rose dip data…
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Year totals table */}
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base">Yearly Totals</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Stems Dipped</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearTotals.map((y) => (
                      <TableRow key={y.year}>
                        <TableCell className="font-mono">{y.year}</TableCell>
                        <TableCell className="text-right font-semibold">{y.stems.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Stems per week by year */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Stems Dipped per Week — by Year</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={stemsPerWeekByYear.data}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} label={{ value: "Dipping week", position: "insideBottom", offset: -4, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend />
                    {stemsPerWeekByYear.years.map((y) => (
                      <Bar key={y} dataKey={String(y)} name={String(y)} fill={YEAR_COLORS[y] || fallbackColor} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Stems per year — stacked by freight */}
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base">Stems by Year & Freight Type</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={stemsByYearStacked.data}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend />
                    {stemsByYearStacked.purposes.map((p) => (
                      <Bar key={p} dataKey={p} stackId="a" fill={PURPOSE_COLORS[p] || fallbackColor} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Stems per week — stacked by freight */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Stems per Week — by Freight Type</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={stemsByWeekPurpose.data}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} label={{ value: "Dipping week", position: "insideBottom", offset: -4, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend />
                    {stemsByWeekPurpose.purposes.map((p) => (
                      <Bar key={p} dataKey={p} stackId="a" fill={PURPOSE_COLORS[p] || fallbackColor} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Forecast vs actual */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Forecast vs Actual Stems per Week</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={forecastVsActual}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} label={{ value: "Dipping week", position: "insideBottom", offset: -4, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend />
                    <Line type="monotone" dataKey="forecast" name="Forecast" stroke="hsl(320, 80%, 55%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="stems" name="Actual" stroke="hsl(150, 70%, 45%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top farms by stems */}
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle className="text-base">Top Farms — Stems by Year</CardTitle></CardHeader>
              <CardContent style={{ height: 420 }}>
                <ResponsiveContainer>
                  <BarChart data={stemsByFarmYear.data} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                    <YAxis type="category" dataKey="farm" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend />
                    {stemsByFarmYear.years.map((y) => (
                      <Bar key={y} dataKey={String(y)} name={String(y)} fill={YEAR_COLORS[y] || fallbackColor} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
