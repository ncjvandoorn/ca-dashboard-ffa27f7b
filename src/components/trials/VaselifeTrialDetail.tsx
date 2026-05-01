import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { VaselifeTrialReport } from "./VaselifeTrialReport";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Beaker, FlaskConical, Sprout, ClipboardList } from "lucide-react";
import {
  useVaselifeVases,
  useVaselifeMeasurements,
  type VaselifeHeader,
} from "@/hooks/useVaselifeTrials";
import { PROPERTY_LABELS, getPropertyMeta } from "@/lib/vaselifeProperties";
import { PropertyHeader, ScoreChip, ScoreScaleLegend } from "./VaselifeScoreUi";
import type { Trial } from "@/lib/trialsParser";
import type { TrialLinkInfo } from "@/lib/trialLinkage";

interface Props {
  trial: VaselifeHeader | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plannerMatches?: Trial[];
  linkInfo?: TrialLinkInfo;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function VaselifeTrialDetail({ trial, open, onOpenChange, plannerMatches = [], linkInfo }: Props) {
  const { data: vases = [], isLoading: vasesLoading } = useVaselifeVases(trial?.id);
  const { data: measurements = [], isLoading: measLoading } = useVaselifeMeasurements(trial?.id);
  const [reportOpen, setReportOpen] = useState(false);

  const isAverageName = (s: string) => /^\s*(average|avg|gemiddelde|mean)\b/i.test(s || "");

  // Split vases into per-cultivar groups and per-treatment averages.
  // Plantscout already provides "Average" rows per treatment_no — we surface
  // those as a dedicated treatment-comparison section instead of treating
  // "Average" as just another cultivar.
  const { cultivars, treatmentAverages } = useMemo(() => {
    const grouped = new Map<string, typeof vases>();
    const avgRows: typeof vases = [];
    for (const v of vases) {
      if (isAverageName(v.cultivar)) {
        avgRows.push(v);
        continue;
      }
      const key = v.cultivar || "Unknown";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(v);
    }
    const cultivars = Array.from(grouped.entries())
      .map(([cultivar, items]) => ({
        cultivar,
        treatments: items.sort((a, b) => (a.treatment_no || 0) - (b.treatment_no || 0)),
      }))
      .sort((a, b) => a.cultivar.localeCompare(b.cultivar));
    const treatmentAverages = avgRows.sort(
      (a, b) => (a.treatment_no || 0) - (b.treatment_no || 0),
    );
    return { cultivars, treatmentAverages };
  }, [vases]);

  // Build measurement matrix split into:
  //  - treatmentAverageRows: one row per treatment_no (from Plantscout's Average cultivar)
  //  - rows: per (cultivar, treatment) for the regular cultivars
  const measurementMatrix = useMemo(() => {
    const propsSet = new Set<string>();
    const rowMap = new Map<string, Record<string, number | null>>();
    for (const m of measurements) {
      if (!m.property_name) continue;
      propsSet.add(m.property_name);
      const key = `${m.cultivar || "?"}|${m.treatment_no || 0}`;
      if (!rowMap.has(key)) rowMap.set(key, {});
      rowMap.get(key)![m.property_name] = m.score ?? null;
    }
    const props = Array.from(propsSet).sort();
    const all = Array.from(rowMap.entries()).map(([key, scores]) => {
      const [cultivar, tn] = key.split("|");
      return {
        cultivar,
        treatmentNo: parseInt(tn),
        scores,
        isAverage: isAverageName(cultivar),
      };
    });
    const treatmentAverageRows = all
      .filter((r) => r.isAverage)
      .sort((a, b) => a.treatmentNo - b.treatmentNo);
    const rows = all
      .filter((r) => !r.isAverage)
      .sort(
        (a, b) =>
          a.cultivar.localeCompare(b.cultivar) || a.treatmentNo - b.treatmentNo,
      );
    return { props, rows, treatmentAverageRows };
  }, [measurements]);

  // Look up the treatment_name for a given treatment_no (from any cultivar row)
  const treatmentNameByNo = useMemo(() => {
    const m = new Map<number, string>();
    for (const v of vases) {
      if (v.treatment_no != null && v.treatment_name && !m.has(v.treatment_no)) {
        m.set(v.treatment_no, v.treatment_name);
      }
    }
    return m;
  }, [vases]);

  if (!trial) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-primary" />
            Trial {trial.trial_number || trial.id.slice(0, 8)}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 items-center pt-1">
            {trial.farm && <Badge variant="secondary">{trial.farm}</Badge>}
            {trial.customer && <Badge variant="outline">{trial.customer}</Badge>}
            {trial.crop && <Badge variant="outline">{trial.crop}</Badge>}
            {trial.freight_type && <Badge variant="outline">{trial.freight_type}</Badge>}
          </DialogDescription>
        </DialogHeader>

        {/* Top metadata — mirrors Plantscout report header block */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border border-border rounded-md p-3 bg-muted/30">
          <div>
            <div className="text-muted-foreground">Harvest date</div>
            <div className="font-medium">{fmtDate(trial.harvest_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Initial quality</div>
            <div className="font-medium">{trial.initial_quality || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Transport phase</div>
            <div className="font-medium">{fmtDate(trial.start_transport)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Retail/Store phase</div>
            <div className="font-medium">{fmtDate(trial.start_retail)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Start VL trial</div>
            <div className="font-medium">{fmtDate(trial.start_vl)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Cultivars × Treatments</div>
            <div className="font-medium">
              {trial.cultivar_count ?? "—"} × {trial.treatment_count ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Vases / treatment</div>
            <div className="font-medium">
              {trial.vases_per_treatment ?? "—"}
              {trial.stems_per_vase ? ` · ${trial.stems_per_vase} stems` : ""}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Total vases</div>
            <div className="font-medium">{trial.total_vases ?? "—"}</div>
          </div>
        </div>

        {trial.objective && (
          <section className="space-y-1 mt-3">
            <h3 className="text-sm font-semibold">Objective</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{trial.objective}</p>
          </section>
        )}

        <Tabs defaultValue="vases" className="mt-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TabsList>
              <TabsTrigger value="vases" className="gap-1.5">
                <Sprout className="h-3.5 w-3.5" /> Vases ({vases.length})
              </TabsTrigger>
              <TabsTrigger value="measurements" className="gap-1.5">
                <Beaker className="h-3.5 w-3.5" /> Measurements ({measurements.length})
              </TabsTrigger>
              <TabsTrigger value="conclusion">Conclusion</TabsTrigger>
              <TabsTrigger value="details" className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> Details
                {plannerMatches.length > 0 && (
                  <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded px-1">
                    {plannerMatches.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              variant="default"
              onClick={() => setReportOpen(true)}
              className="gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Report
            </Button>
          </div>


          <TabsContent value="vases">
            {vasesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : cultivars.length === 0 && treatmentAverages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No vase data.</p>
            ) : (
              <div className="space-y-5">
                {/* Treatment averages — the headline comparison */}
                {treatmentAverages.length > 0 && (
                  <div className="border-2 border-primary/60 rounded-md overflow-hidden bg-primary/5 ring-1 ring-primary/20">
                    <div className="bg-primary/15 text-primary px-3 py-2 flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary text-primary-foreground hover:bg-primary text-[10px] uppercase">
                        ★ Treatment averages
                      </Badge>
                      <span className="text-sm font-bold uppercase tracking-wide">
                        Comparison across all cultivars
                      </span>
                      <span className="text-xs font-normal text-primary/70 ml-auto">
                        {treatmentAverages.length} treatment
                        {treatmentAverages.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">T#</TableHead>
                          <TableHead>Treatment</TableHead>
                          <TableHead className="w-20 text-right">VL days</TableHead>
                          <TableHead className="w-20 text-right">Bot %</TableHead>
                          <TableHead className="w-20 text-right">Flo %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {treatmentAverages.map((t) => (
                          <TableRow key={t.id_line} className="bg-primary/5">
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              {t.treatment_no}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="line-clamp-2 font-medium">
                                {t.treatment_name || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold text-primary">
                              {t.flv_days != null ? t.flv_days.toFixed(1) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {t.bot_percentage ?? "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {t.flo_percentage ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Per-cultivar breakdown */}
                {cultivars.map(({ cultivar, treatments }) => (
                  <div key={cultivar} className="border border-border rounded-md overflow-hidden">
                    <div className="bg-muted/40 px-3 py-2 text-sm font-semibold">
                      {cultivar}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({treatments.length} treatment{treatments.length === 1 ? "" : "s"})
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Treatment</TableHead>
                          <TableHead className="w-20 text-right">Vases</TableHead>
                          <TableHead className="w-20 text-right">VL days</TableHead>
                          <TableHead className="w-20 text-right">Bot %</TableHead>
                          <TableHead className="w-20 text-right">Flo %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {treatments.map((t) => (
                          <TableRow key={t.id_line}>
                            <TableCell className="font-mono text-xs">{t.treatment_no}</TableCell>
                            <TableCell className="text-xs">
                              <div className="line-clamp-2">{t.treatment_name || "—"}</div>
                            </TableCell>
                            <TableCell className="text-right text-xs">{t.vase_count ?? "—"}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">
                              {t.flv_days != null ? t.flv_days.toFixed(1) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs">{t.bot_percentage ?? "—"}</TableCell>
                            <TableCell className="text-right text-xs">{t.flo_percentage ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="measurements">
            {measLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : measurementMatrix.rows.length === 0 && measurementMatrix.treatmentAverageRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No measurements recorded.</p>
            ) : (
              <div className="space-y-4">
                {/* Treatment averages — headline comparison */}
                {measurementMatrix.treatmentAverageRows.length > 0 && (
                  <div className="border-2 border-primary/60 rounded-md overflow-x-auto bg-primary/5 ring-1 ring-primary/20">
                    <div className="bg-primary/15 text-primary px-3 py-2 flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary text-primary-foreground hover:bg-primary text-[10px] uppercase">
                        ★ Treatment averages
                      </Badge>
                      <span className="text-sm font-bold uppercase tracking-wide">
                        Per-treatment scores (averaged across cultivars)
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">T#</TableHead>
                          <TableHead>Treatment</TableHead>
                          {measurementMatrix.props.map((p) => (
                            <TableHead key={p} className="text-center text-xs">
                              <PropertyHeader code={p} />
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {measurementMatrix.treatmentAverageRows.map((r) => (
                          <TableRow key={r.treatmentNo} className="bg-primary/5">
                            <TableCell className="text-xs font-mono font-bold text-primary">
                              {r.treatmentNo}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              <div className="line-clamp-2">
                                {treatmentNameByNo.get(r.treatmentNo) || "—"}
                              </div>
                            </TableCell>
                            {measurementMatrix.props.map((p) => (
                              <TableCell key={p} className="text-center">
                                <ScoreChip code={p} score={r.scores[p]} bold />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Per-cultivar × treatment breakdown */}
                {measurementMatrix.rows.length > 0 && (
                  <div className="border border-border rounded-md overflow-x-auto">
                    <div className="px-3 py-2 text-xs font-semibold bg-muted/40 border-b border-border">
                      Per cultivar × treatment
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cultivar</TableHead>
                          <TableHead className="w-12">T#</TableHead>
                          {measurementMatrix.props.map((p) => (
                            <TableHead key={p} className="text-center text-xs">
                              <PropertyHeader code={p} />
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {measurementMatrix.rows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium">{r.cultivar}</TableCell>
                            <TableCell className="text-xs font-mono">{r.treatmentNo}</TableCell>
                            {measurementMatrix.props.map((p) => (
                              <TableCell key={p} className="text-center">
                                <ScoreChip code={p} score={r.scores[p]} />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="px-3 py-2 text-[11px] border-t border-border bg-muted/20 space-y-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
                        {measurementMatrix.props.map((p) => {
                          const meta = getPropertyMeta(p);
                          return (
                            <div key={p} className="flex gap-1.5 text-foreground/80">
                              <span className="font-mono font-semibold shrink-0">{p}</span>
                              <span className="shrink-0">— {meta.label}</span>
                              <span className="text-muted-foreground truncate" title={meta.description}>
                                · {meta.description}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <ScoreScaleLegend />
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="conclusion" className="space-y-4">
            {trial.spec_comments && (
              <section>
                <h3 className="text-sm font-semibold mb-1">Specific Comments</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{trial.spec_comments}</p>
              </section>
            )}
            {trial.conclusion && (
              <section>
                <h3 className="text-sm font-semibold mb-1">Conclusion</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{trial.conclusion}</p>
              </section>
            )}
            {trial.recommendations && (
              <section>
                <h3 className="text-sm font-semibold mb-1">Recommendations</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{trial.recommendations}</p>
              </section>
            )}
            {!trial.spec_comments && !trial.conclusion && !trial.recommendations && (
              <p className="text-sm text-muted-foreground py-6 text-center">No conclusions yet.</p>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            {linkInfo && (
              <div className="border border-border rounded-md p-3 bg-muted/30 space-y-1">
                <h3 className="text-sm font-semibold mb-1">Link status</h3>
                {linkInfo.notes.map((n, i) => (
                  <div key={i} className="text-xs text-muted-foreground">{n}</div>
                ))}
                {linkInfo.trialNumbersInHeader.length > 0 && (
                  <div className="text-[11px] text-muted-foreground pt-1">
                    Expanded trial numbers from this header:{" "}
                    <span className="font-mono">{linkInfo.trialNumbersInHeader.join(", ")}</span>
                  </div>
                )}
              </div>
            )}

            {plannerMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No matching trials found in Trials Planning for{" "}
                <span className="font-mono">{trial.trial_number || "—"}</span>.
              </p>
            ) : (
              <div className="border border-border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trial #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Farm</TableHead>
                      <TableHead>Crop / Variety</TableHead>
                      <TableHead>Harvest</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                      <TableHead>VL Start</TableHead>
                      <TableHead>VL End</TableHead>
                      <TableHead className="text-right">Bunches</TableHead>
                      <TableHead className="text-right">Boxes</TableHead>
                      <TableHead>CA Chamber</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plannerMatches.map((p) => (
                      <TableRow key={p.trialNumber + p.trialReference}>
                        <TableCell className="font-medium text-xs">
                          {p.trialReference || p.trialNumber}
                          {p.trialReference && p.trialNumber && p.trialReference !== p.trialNumber && (
                            <div className="text-[10px] text-muted-foreground font-normal">
                              {p.trialNumber}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{p.trialType}</Badge></TableCell>
                        <TableCell className="text-xs">{p.trialClient || "—"}</TableCell>
                        <TableCell className="text-xs">{p.customer || "—"}</TableCell>
                        <TableCell className="text-xs">{p.farm || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {[p.flowerCrop, p.variety].filter(Boolean).join(" / ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{fmtDate(p.harvestDate)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(p.startDate)}</TableCell>
                        <TableCell className="text-right text-xs">{p.caDuration || "—"}</TableCell>
                        <TableCell className="text-xs">{fmtDate(p.vlStart)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(p.vlEnd)}</TableCell>
                        <TableCell className="text-right text-xs">{p.bunches || "—"}</TableCell>
                        <TableCell className="text-right text-xs">{p.boxes || "—"}</TableCell>
                        <TableCell className="text-xs">{p.caChamber || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      <VaselifeTrialReport
        trial={trial}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </Dialog>
  );
}
