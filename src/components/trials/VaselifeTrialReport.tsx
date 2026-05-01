import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, FlaskConical, Sprout, Beaker, CheckCircle2, Star } from "lucide-react";
import {
  useVaselifeVases,
  useVaselifeMeasurements,
  type VaselifeHeader,
  type VaselifeVase,
} from "@/hooks/useVaselifeTrials";
import {
  PROPERTY_LABELS,
  getPropertyMeta,
  getCropHeadlineKpis,
  formatDeltaDays,
  scoreTone,
} from "@/lib/vaselifeProperties";
import {
  PropertyHeader,
  ScoreChip,
  ToneBadge,
  ScoreScaleLegend,
} from "./VaselifeScoreUi";

interface Props {
  trial: VaselifeHeader | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const isAverageName = (s: string | null | undefined) =>
  /^\s*(average|avg|gemiddelde|mean)\b/i.test(s || "");

/**
 * Renders a Plantscout-style Vase Life Report mirroring the layout of the
 * official PDF exports. Property columns are crop-specific — derived from
 * whatever measurement properties the trial actually has, which matches
 * Plantscout's per-crop measurement schema.
 */
export function VaselifeTrialReport({ trial, open, onOpenChange }: Props) {
  const { data: vases = [], isLoading: vasesLoading } = useVaselifeVases(trial?.id);
  const { data: measurements = [], isLoading: measLoading } = useVaselifeMeasurements(trial?.id);

  // Properties actually measured in this trial (crop-specific subset),
  // plus an observation-count map used to pick fallback headline KPIs.
  const { tripProperties, propCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of measurements) {
      if (!m.property_name) continue;
      counts.set(m.property_name, (counts.get(m.property_name) || 0) + 1);
    }
    const props = Array.from(counts.keys()).sort();
    return { tripProperties: props, propCounts: counts };
  }, [measurements]);

  // Headline KPIs ordered by per-crop importance (falls back to top-by-count)
  const headlineKpis = useMemo(
    () => getCropHeadlineKpis(trial?.crop, tripProperties, propCounts),
    [trial?.crop, tripProperties, propCounts],
  );

  // Index measurements by (cultivar|treatment_no) -> property -> score
  const measByVase = useMemo(() => {
    const map = new Map<string, Map<string, number | null>>();
    for (const m of measurements) {
      if (!m.property_name) continue;
      const key = `${(m.cultivar || "").toLowerCase()}|${m.treatment_no ?? 0}`;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key)!.set(m.property_name, m.score ?? null);
    }
    return map;
  }, [measurements]);

  // Split: per-treatment averages vs real per-cultivar vases
  const { treatmentAverages, cultivarVases } = useMemo(() => {
    const avgs: typeof vases = [];
    const culti: typeof vases = [];
    for (const v of vases) {
      if (isAverageName(v.cultivar)) avgs.push(v);
      else culti.push(v);
    }
    avgs.sort((a, b) => (a.treatment_no || 0) - (b.treatment_no || 0));
    culti.sort((a, b) => {
      const c = (a.cultivar || "").localeCompare(b.cultivar || "");
      if (c !== 0) return c;
      return (a.treatment_no || 0) - (b.treatment_no || 0);
    });
    return { treatmentAverages: avgs, cultivarVases: culti };
  }, [vases]);

  // Lookup measurements for the per-treatment-average row by treatment_no
  const avgMeasByTreatment = useMemo(() => {
    const m = new Map<number, Map<string, number | null>>();
    for (const v of treatmentAverages) {
      if (v.treatment_no == null) continue;
      const key = `${(v.cultivar || "").toLowerCase()}|${v.treatment_no}`;
      const props = measByVase.get(key);
      if (props) m.set(v.treatment_no, props);
    }
    return m;
  }, [treatmentAverages, measByVase]);

  // Control treatment = lowest treatment_no in the averages set (typically water/no-treatment).
  const controlTreatment = useMemo(() => {
    if (treatmentAverages.length === 0) return null;
    return treatmentAverages.reduce((acc, v) =>
      (v.treatment_no ?? 99) < (acc.treatment_no ?? 99) ? v : acc,
    treatmentAverages[0]);
  }, [treatmentAverages]);
  const controlVlDays = controlTreatment?.flv_days ?? null;


  if (!trial) return null;

  const reportCode =
    trial.trial_number ||
    (trial.start_vl ? trial.start_vl.replace(/-/g, "").slice(0, 8) : trial.id.slice(0, 8));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto bg-background"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Vase Life Report
            <span className="ml-2 font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
              {reportCode}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {/* General information — mirrors PDF "General information" block */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">
              General information
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <InfoRow label="Code" value={reportCode} />
              <InfoRow label="Start VL trial" value={fmtDate(trial.start_vl)} />
              <InfoRow label="Freight type" value={trial.freight_type || "—"} />
              <InfoRow
                label="Initial quality"
                value={
                  trial.initial_quality ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      {trial.initial_quality}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow label="Crop" value={trial.crop || "—"} />
              <InfoRow label="Customer" value={trial.customer || "—"} />
              <InfoRow label="Farm" value={trial.farm || "—"} />
              <InfoRow label="Harvest date" value={fmtDate(trial.harvest_date)} />
              <InfoRow label="Sea Freight" value={fmtDate(trial.start_seafreight)} />
              <InfoRow label="Transport phase" value={fmtDate(trial.start_transport)} />
              <InfoRow label="Retail/Store phase" value={fmtDate(trial.start_retail)} />
              <InfoRow
                label="Cultivars × Treatments"
                value={`${trial.cultivar_count ?? "—"} × ${trial.treatment_count ?? "—"}`}
              />
              <InfoRow label="Vases / treatment" value={trial.vases_per_treatment ?? "—"} />
              <InfoRow label="Total vases" value={trial.total_vases ?? "—"} />
              <InfoRow label="Stems / vase" value={trial.stems_per_vase ?? "—"} />
            </div>
          </section>

          {/* HEADLINE KPI CARD — vase life + per-crop priority metrics with Δ vs control */}
          {treatmentAverages.length > 0 && headlineKpis.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wide text-primary font-bold mb-2 flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 fill-primary" /> Headline results — what matters most for {trial.crop || "this crop"}
              </h3>
              <div className="border-2 border-primary/60 rounded-md overflow-x-auto bg-primary/5 ring-1 ring-primary/20">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">T#</TableHead>
                      <TableHead className="text-xs">Treatment</TableHead>
                      <TableHead className="text-right text-xs w-20">VL days</TableHead>
                      <TableHead className="text-right text-xs w-20">Δ vs ctrl</TableHead>
                      {headlineKpis.map((p) => (
                        <TableHead key={p} className="text-center text-[11px]">
                          <PropertyHeader code={p} full />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatmentAverages.map((v) => {
                      const meas =
                        v.treatment_no != null ? avgMeasByTreatment.get(v.treatment_no) : undefined;
                      const isControl = controlTreatment?.id_line === v.id_line;
                      const delta =
                        controlVlDays != null && v.flv_days != null
                          ? Number(v.flv_days) - Number(controlVlDays)
                          : null;
                      const d = formatDeltaDays(delta);
                      return (
                        <TableRow key={v.id_line} className="bg-primary/5">
                          <TableCell className="text-xs font-mono font-bold text-primary">
                            {v.treatment_no}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-start gap-1.5">
                              <span className="line-clamp-2">{v.treatment_name || "—"}</span>
                              {isControl && (
                                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">
                                  control
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-primary tabular-nums">
                            {v.flv_days != null ? Number(v.flv_days).toFixed(1) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {isControl ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <ToneBadge tone={d.tone}>{d.text}</ToneBadge>
                            )}
                          </TableCell>
                          {headlineKpis.map((p) => (
                            <TableCell key={p} className="text-center">
                              <ScoreChip code={p} score={meas?.get(p) ?? null} bold />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground">
                Δ shows extra vase-life days vs the control (lowest treatment number).
                Hover any property code for the full definition.
              </div>
            </section>
          )}

          {/* TREATMENT AVERAGES — full breakdown across every measured property */}
          {treatmentAverages.length > 0 && tripProperties.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" /> All measured properties — per treatment
              </h3>
              <div className="border border-border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">T#</TableHead>
                      <TableHead className="text-xs">Treatment</TableHead>
                      <TableHead className="text-right text-xs w-16">VL d</TableHead>
                      <TableHead className="text-right text-xs w-16">FVL %</TableHead>
                      <TableHead className="text-right text-xs w-16">Bot %</TableHead>
                      {tripProperties.map((p) => (
                        <TableHead key={p} className="text-center text-[11px]">
                          <PropertyHeader code={p} />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatmentAverages.map((v) => {
                      const meas =
                        v.treatment_no != null ? avgMeasByTreatment.get(v.treatment_no) : undefined;
                      return (
                        <TableRow key={v.id_line}>
                          <TableCell className="text-xs font-mono font-bold text-primary">
                            {v.treatment_no}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="line-clamp-2">{v.treatment_name || "—"}</div>
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold tabular-nums">
                            {v.flv_days != null ? Number(v.flv_days).toFixed(1) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {v.flo_percentage ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {v.bot_percentage ?? "—"}
                          </TableCell>
                          {tripProperties.map((p) => (
                            <TableCell key={p} className="text-center">
                              <ScoreChip code={p} score={meas?.get(p) ?? null} />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-2 px-3 py-2 text-[11px] border border-border rounded-md bg-muted/20 space-y-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                  {tripProperties.map((p) => {
                    const meta = getPropertyMeta(p);
                    return (
                      <div key={p} className="flex gap-1.5">
                        <span className="font-mono font-semibold text-foreground/80 shrink-0">{p}</span>
                        <span className="text-foreground/80 shrink-0">— {meta.label}</span>
                      </div>
                    );
                  })}
                </div>
                <ScoreScaleLegend />
              </div>
            </section>
          )}

          {/* Test setup — mirrors PDF "Test setup" table (cultivar rows only) */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
              <Sprout className="h-3.5 w-3.5" /> Test setup
            </h3>
            {vasesLoading ? (
              <Loader />
            ) : cultivarVases.length === 0 ? (
              <Empty>No vase data.</Empty>
            ) : (
              <div className="border border-border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-xs">Nr.</TableHead>
                      <TableHead className="text-xs">Variety</TableHead>
                      <TableHead className="text-xs">Greenhouse</TableHead>
                      <TableHead className="text-xs">Dipping</TableHead>
                      <TableHead className="text-xs">Post-Harvest</TableHead>
                      <TableHead className="text-xs">Store phase</TableHead>
                      <TableHead className="text-xs">Consumer phase</TableHead>
                      <TableHead className="text-right text-xs w-14">Vases</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cultivarVases.map((v, i) => (
                      <TableRow key={v.id_line}>
                        <TableCell className="text-xs font-mono">{i + 1}</TableCell>
                        <TableCell className="text-xs">{v.cultivar || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {v.id_greenhouse || extractToken(v.treatment_name, 0) || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{v.id_dipping || "—"}</TableCell>
                        <TableCell className="text-xs">{v.post_harvest || "—"}</TableCell>
                        <TableCell className="text-xs">{v.store_phase || "—"}</TableCell>
                        <TableCell className="text-xs">{v.consumer_phase || "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {v.vase_count ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* Results — Vaselife report: FVL % (per cultivar × treatment) */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" /> Results — per cultivar × treatment
            </h3>
            {cultivarVases.length === 0 ? (
              <Empty>No results.</Empty>
            ) : (
              <div className="border border-border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-xs">#</TableHead>
                      <TableHead className="text-xs">Tested variety</TableHead>
                      <TableHead className="text-xs w-12">T#</TableHead>
                      <TableHead className="text-right text-xs w-24">VL days</TableHead>
                      <TableHead className="text-right text-xs w-20">FVL %</TableHead>
                      <TableHead className="text-right text-xs w-20">Botrytis %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cultivarVases.map((v, i) => (
                      <TableRow key={v.id_line}>
                        <TableCell className="text-xs font-mono">{i + 1}</TableCell>
                        <TableCell className="text-xs">{v.cultivar || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{v.treatment_no ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {v.flv_days != null ? v.flv_days.toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">{v.flo_percentage ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{v.bot_percentage ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* Per-vase detail blocks — only real cultivar vases */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
              <Beaker className="h-3.5 w-3.5" /> Per-vase detail
              {tripProperties.length > 0 && (
                <Badge variant="outline" className="ml-1 text-[10px]">
                  {tripProperties.length} crop-specific propert
                  {tripProperties.length === 1 ? "y" : "ies"}
                </Badge>
              )}
            </h3>
            {measLoading || vasesLoading ? (
              <Loader />
            ) : cultivarVases.length === 0 ? (
              <Empty>No vase data.</Empty>
            ) : (
              <div className="space-y-4">
                {cultivarVases.map((v, i) => (
                  <VaseDetailCard
                    key={v.id_line}
                    index={i + 1}
                    vase={v}
                    trial={trial}
                    properties={tripProperties}
                    measurements={
                      measByVase.get(
                        `${(v.cultivar || "").toLowerCase()}|${v.treatment_no ?? 0}`,
                      ) || new Map()
                    }
                  />
                ))}
              </div>
            )}
            {tripProperties.length > 0 && (
              <div className="mt-3 px-3 py-2 text-[11px] border border-border rounded-md bg-muted/20 space-y-1.5">
                <div className="font-semibold uppercase tracking-wide text-muted-foreground">
                  Property legend ({trial.crop || "this crop"})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
                  {tripProperties.map((p) => {
                    const meta = getPropertyMeta(p);
                    return (
                      <div key={p} className="flex gap-1.5 text-foreground/80">
                        <span className="font-mono font-semibold shrink-0">{p}</span>
                        <span className="shrink-0">— {meta.label}:</span>
                        <span className="text-muted-foreground">{meta.description}</span>
                      </div>
                    );
                  })}
                </div>
                <ScoreScaleLegend />
              </div>
            )}
          </section>

          {/* Conclusion if available */}
          {(trial.spec_comments || trial.conclusion || trial.recommendations) && (
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Conclusion
              </h3>
              {trial.spec_comments && (
                <div>
                  <div className="text-xs font-semibold mb-0.5">Specific comments</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {trial.spec_comments}
                  </p>
                </div>
              )}
              {trial.conclusion && (
                <div>
                  <div className="text-xs font-semibold mb-0.5">Conclusion</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {trial.conclusion}
                  </p>
                </div>
              )}
              {trial.recommendations && (
                <div>
                  <div className="text-xs font-semibold mb-0.5">Recommendations</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {trial.recommendations}
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* -------- helpers -------- */

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
      {children}
    </p>
  );
}

/** Pull the n-th " | "-separated token from a treatment_name string */
function extractToken(name: string | null, idx: number): string | null {
  if (!name) return null;
  const parts = name.split("|").map((p) => p.trim()).filter(Boolean);
  return parts[idx] || null;
}

interface VaseDetailCardProps {
  index: number;
  vase: VaselifeVase;
  trial: VaselifeHeader;
  properties: string[];
  measurements: Map<string, number | null>;
}

function VaseDetailCard({
  index,
  vase,
  trial,
  properties,
  measurements,
}: VaseDetailCardProps) {
  const isAvg = isAverageName(vase.cultivar);
  return (
    <div
      className={
        isAvg
          ? "border-2 border-primary/60 rounded-lg overflow-hidden bg-primary/5 ring-1 ring-primary/20"
          : "border border-border rounded-lg overflow-hidden bg-card"
      }
    >
      {/* Vase header strip */}
      <div
        className={
          isAvg
            ? "bg-primary/15 text-primary px-4 py-2 flex items-center gap-2 flex-wrap"
            : "bg-muted/40 px-4 py-2 flex items-center gap-2 flex-wrap"
        }
      >
        <span className="text-xs font-mono">#{index}</span>
        <span className="text-sm font-semibold">
          {isAvg ? `★ ${vase.cultivar}` : vase.cultivar || "—"}
        </span>
        {vase.treatment_no != null && (
          <Badge variant="outline" className="text-[10px]">
            T{vase.treatment_no}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span>
            <span className="text-muted-foreground">VL </span>
            <span className="font-semibold">
              {vase.flv_days != null ? `${vase.flv_days.toFixed(1)}d` : "—"}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">FVL </span>
            <span className="font-semibold">{vase.flo_percentage ?? "—"}%</span>
          </span>
          <span>
            <span className="text-muted-foreground">Bot </span>
            <span className="font-semibold">{vase.bot_percentage ?? "—"}%</span>
          </span>
        </div>
      </div>

      {/* Body: General + Characteristics + Measurements */}
      <div className="p-3 space-y-3">
        {/* General — slim per-vase summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1 text-xs">
          <KV label="Treatment" value={vase.treatment_name || "—"} colSpan={3} />
          {vase.id_greenhouse && <KV label="Greenhouse" value={vase.id_greenhouse} />}
          {vase.id_dipping && <KV label="Dipping" value={vase.id_dipping} />}
          {vase.post_harvest && <KV label="Post-Harvest" value={vase.post_harvest} />}
          {vase.store_phase && <KV label="Store phase" value={vase.store_phase} />}
          {vase.consumer_phase && (
            <KV label="Consumer phase" value={vase.consumer_phase} />
          )}
          <KV label="Vases" value={vase.vase_count ?? "—"} />
        </div>

        {/* Characteristics */}
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
            Characteristics
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1 text-xs">
            <KV label="Start VL trial" value={fmtDate(trial.start_vl)} />
            <KV
              label="Flower vase life (days)"
              value={vase.flv_days != null ? vase.flv_days.toFixed(1) : "—"}
            />
            <KV label="Botrytis incidence %" value={vase.bot_percentage ?? "—"} />
          </div>
        </div>

        {/* Measurements — crop-specific properties */}
        {properties.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
              Measurements (final observation)
            </div>
            <div className="border border-border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {properties.map((p) => (
                      <TableHead
                        key={p}
                        className="text-center text-[11px]"
                        title={PROPERTY_LABELS[p] || p}
                      >
                        {p}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    {properties.map((p) => {
                      const score = measurements.get(p);
                      return (
                        <TableCell
                          key={p}
                          className={`text-center text-xs ${
                            isAvg ? "text-primary font-semibold" : ""
                          }`}
                        >
                          {score != null ? score : "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  colSpan,
}: {
  label: string;
  value: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <div
      className={
        colSpan === 3
          ? "col-span-2 md:col-span-3 flex flex-col"
          : "flex flex-col"
      }
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}
