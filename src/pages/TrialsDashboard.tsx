import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Loader2, Search, Database } from "lucide-react";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import chrysalLogo from "@/assets/chrysal-logo.png";
import { useVaselifeHeaders, type VaselifeHeader } from "@/hooks/useVaselifeTrials";
import { VaselifeTrialDetail } from "@/components/trials/VaselifeTrialDetail";
import { useAuth } from "@/hooks/useAuth";
import { useAccounts, useCustomerFarms } from "@/hooks/useQualityData";
import { usePlannerTrials } from "@/hooks/usePlannerTrials";
import { computeTrialLink, type LinkStatus } from "@/lib/trialLinkage";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function norm(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

const ALL = "__all__";

export default function TrialsDashboard() {
  const { data: trials = [], isLoading } = useVaselifeHeaders();
  const { isCustomer, customerAccount } = useAuth();
  const { data: accounts = [] } = useAccounts();
  const { data: customerFarms = [] } = useCustomerFarms();
  const { data: planner = [] } = usePlannerTrials();

  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>(ALL);
  const [farmFilter, setFarmFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<VaselifeHeader | null>(null);

  /**
   * For customers: restrict to trials whose `customer` name matches their
   * customer-account name OR whose `farm` matches a linked farm name (with
   * consent = "1"). Trial header stores names (not IDs), so we match by name.
   */
  const customerScopedTrials = useMemo(() => {
    if (!isCustomer || !customerAccount) return trials;

    const myAccount = accounts.find((a) => a.id === customerAccount.customerAccountId);
    const myCustomerName = norm(myAccount?.name);

    const linkedFarmNames = new Set<string>();
    for (const cf of customerFarms) {
      if (cf.customerAccountId !== customerAccount.customerAccountId) continue;
      if (cf.deletedAt) continue;
      if (cf.farmAccountConsent !== "1") continue;
      const farm = accounts.find((a) => a.id === cf.farmAccountId);
      if (farm) linkedFarmNames.add(norm(farm.name));
    }

    return trials.filter(
      (t) =>
        (myCustomerName && norm(t.customer) === myCustomerName) ||
        linkedFarmNames.has(norm(t.farm)),
    );
  }, [trials, isCustomer, customerAccount, accounts, customerFarms]);

  /** Distinct customers / farms present in the (scoped) trial set */
  const customerOptions = useMemo(() => {
    const set = new Set<string>();
    customerScopedTrials.forEach((t) => t.customer && set.add(t.customer));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [customerScopedTrials]);

  const farmOptions = useMemo(() => {
    const set = new Set<string>();
    customerScopedTrials
      .filter((t) => customerFilter === ALL || t.customer === customerFilter)
      .forEach((t) => t.farm && set.add(t.farm));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [customerScopedTrials, customerFilter]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customerScopedTrials.filter((t) => {
      if (customerFilter !== ALL && t.customer !== customerFilter) return false;
      if (farmFilter !== ALL && t.farm !== farmFilter) return false;
      if (!q) return true;
      // Search across every meaningful trial field
      const haystack = [
        t.trial_number,
        t.farm,
        t.customer,
        t.crop,
        t.freight_type,
        t.initial_quality,
        t.objective,
        t.spec_comments,
        t.conclusion,
        t.recommendations,
        t.harvest_date,
        t.start_seafreight,
        t.start_transport,
        t.start_retail,
        t.start_vl,
        t.cultivar_count != null ? String(t.cultivar_count) : "",
        t.treatment_count != null ? String(t.treatment_count) : "",
        t.total_vases != null ? String(t.total_vases) : "",
        t.stems_per_vase != null ? String(t.stems_per_vase) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [customerScopedTrials, search, customerFilter, farmFilter]);

  /** Set of all account names (customers + farms) for matching */
  const accountNameSet = useMemo(() => {
    const s = new Set<string>();
    accounts.forEach((a) => a.name && s.add(a.name.trim().toLowerCase()));
    return s;
  }, [accounts]);

  /** Per-trial link info, keyed by header id */
  const linkByHeaderId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeTrialLink>>();
    for (const t of customerScopedTrials) {
      map.set(t.id, computeTrialLink(t, planner, accountNameSet));
    }
    return map;
  }, [customerScopedTrials, planner, accountNameSet]);

  const stats = useMemo(() => {
    const farms = new Set(filtered.map((t) => t.farm).filter(Boolean));
    const crops = new Set(filtered.map((t) => t.crop).filter(Boolean));
    const totalVases = filtered.reduce((s, t) => s + (t.total_vases || 0), 0);
    return { trials: filtered.length, farms: farms.size, crops: crops.size, totalVases };
  }, [filtered]);

  const resetFilters = () => {
    setSearch("");
    setCustomerFilter(ALL);
    setFarmFilter(ALL);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="chrysal-gradient h-1.5" />
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Go to dashboard"
            className="bg-card border border-border rounded-md p-1.5 flex items-center justify-center hover:bg-accent/10 transition-colors"
          >
            <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto" />
          </Link>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Trials Dashboard — Vaselife
          </h1>
        </div>
        <PageHeaderActions />
      </header>

      <main className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Trials</div>
            <div className="text-2xl font-bold">{stats.trials}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Farms</div>
            <div className="text-2xl font-bold">{stats.farms}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Crops</div>
            <div className="text-2xl font-bold">{stats.crops}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total vases</div>
            <div className="text-2xl font-bold">{stats.totalVases}</div>
          </Card>
        </div>

        {/* Source note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-2">
          <Database className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <p>
            Data sourced from the <strong>Plantscout Vaselife API</strong> (headers, vases &
            measurements). {isCustomer && "Showing only trials linked to your customer account and farms."}
          </p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search anything: trial, farm, customer, crop, comments…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {!isCustomer && (
            <Select
              value={customerFilter}
              onValueChange={(v) => {
                setCustomerFilter(v);
                setFarmFilter(ALL);
              }}
            >
              <SelectTrigger className="w-full md:w-[220px]">
                <SelectValue placeholder="All customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All customers</SelectItem>
                {customerOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={farmFilter} onValueChange={setFarmFilter}>
            <SelectTrigger className="w-full md:w-[220px]">
              <SelectValue placeholder="All farms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All farms</SelectItem>
              {farmOptions.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search || customerFilter !== ALL || farmFilter !== ALL) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline self-center"
            >
              Reset
            </button>
          )}
        </div>

        {/* Trials table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              {customerScopedTrials.length === 0 && isCustomer
                ? "No trials are linked to your account yet."
                : "No trials match the current filters."}
            </p>
          ) : (
            <TooltipProvider delayDuration={150}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trial</TableHead>
                  <TableHead className="w-16 text-center">Linked</TableHead>
                  <TableHead>Farm</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Freight</TableHead>
                  <TableHead className="text-right">Cult.</TableHead>
                  <TableHead className="text-right">Treat.</TableHead>
                  <TableHead className="text-right">Vases</TableHead>
                  <TableHead>Harvest</TableHead>
                  <TableHead>VL Start</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const link = linkByHeaderId.get(t.id);
                  const dotColor: Record<LinkStatus, string> = {
                    green: "bg-emerald-500",
                    yellow: "bg-amber-400",
                    red: "bg-rose-500",
                  };
                  return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelected(t)}
                  >
                    <TableCell className="font-medium text-sm">
                      {t.trial_number || (
                        <span className="text-muted-foreground italic">unnamed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      {link && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`inline-block h-3 w-3 rounded-full ring-2 ring-background ${dotColor[link.status]}`}
                              aria-label={`Link status: ${link.status}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-1 text-xs">
                              <div className="font-semibold mb-1">Link status</div>
                              {link.notes.map((n, i) => (
                                <div key={i}>{n}</div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{t.farm || "—"}</TableCell>
                    <TableCell className="text-sm">{t.customer || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {t.crop ? <Badge variant="secondary">{t.crop}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.freight_type || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{t.cultivar_count ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{t.treatment_count ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{t.total_vases ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(t.harvest_date)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(t.start_vl)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>

      <VaselifeTrialDetail
        trial={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
