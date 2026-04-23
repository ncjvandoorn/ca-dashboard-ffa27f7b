import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Loader2, Search, Database } from "lucide-react";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TrialsDashboard() {
  const { data: trials = [], isLoading } = useVaselifeHeaders();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VaselifeHeader | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return trials;
    return trials.filter(
      (t) =>
        (t.trial_number || "").toLowerCase().includes(q) ||
        (t.farm || "").toLowerCase().includes(q) ||
        (t.customer || "").toLowerCase().includes(q) ||
        (t.crop || "").toLowerCase().includes(q),
    );
  }, [trials, search]);

  const stats = useMemo(() => {
    const farms = new Set(trials.map((t) => t.farm).filter(Boolean));
    const crops = new Set(trials.map((t) => t.crop).filter(Boolean));
    const totalVases = trials.reduce((s, t) => s + (t.total_vases || 0), 0);
    return { trials: trials.length, farms: farms.size, crops: crops.size, totalVases };
  }, [trials]);

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
            Data sourced from the <strong>Plantscout Vaselife API</strong> (initial seed: headers, vases &
            measurements). Once the live API endpoint is available, this dashboard will update automatically.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trial, farm, customer, crop..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Trials table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No trials match.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trial</TableHead>
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
                {filtered.map((t) => (
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
