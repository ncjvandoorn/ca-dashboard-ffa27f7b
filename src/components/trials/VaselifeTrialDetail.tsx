import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { VaselifeTrialReport } from "./VaselifeTrialReport";
import { SharePageButton } from "@/components/SharePageButton";
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
import { getPropertyMeta, diffTreatmentNames, scoreToneClasses, type ScoreTone } from "@/lib/vaselifeProperties";
import { PropertyHeader, ScoreChip, ScoreScaleLegend, ToneBadge } from "./VaselifeScoreUi";
import type { Trial } from "@/lib/trialsParser";
import type { TrialLinkInfo } from "@/lib/trialLinkage";
import { computeConcludedDate } from "@/lib/trialConcluded";
import { useUserCustomers, buildResponsibleResolver } from "@/lib/userCustomer";

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

/** Tone for vase-life days (more is better). */
function vlDaysTone(v: number | null | undefined): ScoreTone {
  if (v == null) return "neutral";
  if (v >= 7) return "good";
  if (v >= 5) return "warn";
  return "bad";
}
/** Tone for Botrytis % (damage — lower is better). */
function botPctTone(v: number | null | undefined): ScoreTone {
  if (v == null) return "neutral";
  if (v <= 5) return "good";
  if (v <= 20) return "warn";
  return "bad";
}
/** Tone for Flower-opening % / FVL % (quality — higher is better). */
function floPctTone(v: number | null | undefined): ScoreTone {
  if (v == null) return "neutral";
  if (v >= 75) return "good";
  if (v >= 50) return "warn";
  return "bad";
}
function MetricChip({
  tone,
  children,
}: {
  tone: ScoreTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[36px] px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums ${scoreToneClasses(
        tone,
      )}`}
    >
      {children}
    </span>
  );
}

export function VaselifeTrialDetail({ trial, open, onOpenChange, plannerMatches = [], linkInfo }: Props) {
  const { data: vases = [], isLoading: vasesLoading } = useVaselifeVases(trial?.id);
  const { data: measurements = [], isLoading: measLoading } = useVaselifeMeasurements(trial?.id);
  const [reportOpen, setReportOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiUpdatedAt, setAiUpdatedAt] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { data: userCustomers = [] } = useUserCustomers();
  const technicalConsultant = useMemo(() => {
    const resolve = buildResponsibleResolver(userCustomers);
    return resolve(trial?.farm) || resolve(trial?.customer) || "";
  }, [userCustomers, trial?.farm, trial?.customer]);

  useEffect(() => {
    setAiAnalysis(null);
    setAiUpdatedAt(null);
    if (!trial?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("vaselife_trial_ai_analysis")
        .select("analysis, updated_at")
        .eq("header_id", trial.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setAiAnalysis(data.analysis);
      setAiUpdatedAt(data.updated_at);
    })();
    return () => {
      cancelled = true;
    };
  }, [trial?.id]);

  const runAiAnalysis = async (refresh: boolean) => {
    if (!trial?.id) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-trial", {
        body: { headerId: trial.id, refresh },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiAnalysis(data.analysis);
      setAiUpdatedAt(data.updated_at || new Date().toISOString());
    } catch (e: any) {
      toast({
        title: "AI analysis failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const isAverageName = (s: string) => /^\s*(average|avg|gemiddelde|mean)\b/i.test(s || "");

  /**
   * Normalise a treatment name for duplicate detection.
   * Plantscout sometimes stores the same treatment multiple times with
   * trivial spacing differences (e.g. "AVB  @5mL/L" vs "AVB @5mL/L",
   * or "@2mL/L+" vs "@2mL/L +"). These should collapse to one treatment.
   */
  const normaliseTreatmentName = (s: string | null | undefined) =>
    (s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*\|\s*/g, "|")
      .replace(/\s*([+/@])\s*/g, "$1")
      .trim();

  // Split vases into per-cultivar groups and per-treatment averages.
  // Plantscout already provides "Average" rows per treatment_no — we surface
  // those as a dedicated treatment-comparison section instead of treating
  // "Average" as just another cultivar.
  //
  // The Plantscout `treatment_count` header value (and the per-row treatment_no
  // sequence) often double-counts treatments that differ only by trivial
  // whitespace/symbol spacing. We treat the unique normalised treatment name
  // as the source of truth and renumber sequentially (1..N). The same
  // collapsing is applied to per-cultivar rows so vase_count gets summed
  // across the duplicate treatment_no entries.
  const { cultivars, treatmentAverages, derivedVaseCount, treatmentDisplayNo } = useMemo(() => {
    const avgRows: typeof vases = [];
    const realRows: typeof vases = [];
    for (const v of vases) {
      if (isAverageName(v.cultivar)) avgRows.push(v);
      else realRows.push(v);
    }

    // Build canonical treatment list from average rows (preferred — they always
    // exist one-per-treatment_no), falling back to real rows when no averages.
    const canonicalSource = avgRows.length > 0 ? avgRows : realRows;
    const sortedCanon = [...canonicalSource].sort(
      (a, b) => (a.treatment_no || 0) - (b.treatment_no || 0),
    );
    // normalisedKey -> { display_no, original_treatment_nos[] }
    const keyToInfo = new Map<string, { displayNo: number; originals: number[] }>();
    for (const r of sortedCanon) {
      const key = normaliseTreatmentName(r.treatment_name) || `__t${r.treatment_no}`;
      const existing = keyToInfo.get(key);
      if (!existing) {
        keyToInfo.set(key, {
          displayNo: keyToInfo.size + 1,
          originals: r.treatment_no != null ? [r.treatment_no] : [],
        });
      } else if (r.treatment_no != null && !existing.originals.includes(r.treatment_no)) {
        existing.originals.push(r.treatment_no);
      }
    }
    // Map original treatment_no -> sequential display number (1..N)
    const treatmentDisplayNo = new Map<number, number>();
    for (const { displayNo, originals } of keyToInfo.values()) {
      for (const o of originals) treatmentDisplayNo.set(o, displayNo);
    }

    // Build merged averages list (one row per unique treatment).
    const sortedAvg = [...avgRows].sort(
      (a, b) => (a.treatment_no || 0) - (b.treatment_no || 0),
    );
    const mergedAvgMap = new Map<string, typeof avgRows[number] & { merged_treatment_nos: number[]; display_no: number }>();
    for (const r of sortedAvg) {
      const key = normaliseTreatmentName(r.treatment_name) || `__t${r.treatment_no}`;
      const info = keyToInfo.get(key);
      const existing = mergedAvgMap.get(key);
      if (!existing) {
        mergedAvgMap.set(key, {
          ...r,
          merged_treatment_nos: r.treatment_no != null ? [r.treatment_no] : [],
          display_no: info?.displayNo ?? mergedAvgMap.size + 1,
        });
      } else if (r.treatment_no != null) {
        existing.merged_treatment_nos.push(r.treatment_no);
      }
    }
    const treatmentAverages = Array.from(mergedAvgMap.values()).sort(
      (a, b) => a.display_no - b.display_no,
    );

    // Per-cultivar groups: collapse duplicate treatments (same normalised name)
    // into one row per unique treatment, summing vase_count and averaging metrics.
    const grouped = new Map<string, typeof realRows>();
    for (const v of realRows) {
      const cKey = v.cultivar || "Unknown";
      if (!grouped.has(cKey)) grouped.set(cKey, []);
      grouped.get(cKey)!.push(v);
    }
    const cultivars = Array.from(grouped.entries())
      .map(([cultivar, items]) => {
        // Merge duplicates inside this cultivar
        const merged = new Map<string, typeof items[number] & { merged_treatment_nos: number[]; display_no: number }>();
        for (const r of items) {
          const key = normaliseTreatmentName(r.treatment_name) || `__t${r.treatment_no}`;
          const info = keyToInfo.get(key);
          const existing = merged.get(key);
          if (!existing) {
            merged.set(key, {
              ...r,
              vase_count: r.vase_count || 0,
              merged_treatment_nos: r.treatment_no != null ? [r.treatment_no] : [],
              display_no: info?.displayNo ?? merged.size + 1,
            });
          } else {
            existing.vase_count = (existing.vase_count || 0) + (r.vase_count || 0);
            // Average numeric metrics across duplicates
            const avgNum = (a: number | null, b: number | null): number | null => {
              if (a == null && b == null) return null;
              if (a == null) return b;
              if (b == null) return a;
              return (Number(a) + Number(b)) / 2;
            };
            existing.flv_days = avgNum(existing.flv_days as any, r.flv_days as any) as any;
            existing.bot_percentage = avgNum(existing.bot_percentage as any, r.bot_percentage as any) as any;
            existing.flo_percentage = avgNum(existing.flo_percentage as any, r.flo_percentage as any) as any;
            if (r.treatment_no != null && !existing.merged_treatment_nos.includes(r.treatment_no)) {
              existing.merged_treatment_nos.push(r.treatment_no);
            }
          }
        }
        return {
          cultivar,
          treatments: Array.from(merged.values()).sort((a, b) => a.display_no - b.display_no),
        };
      })
      .sort((a, b) => a.cultivar.localeCompare(b.cultivar));

    // Real total vases = sum of (merged) vase_counts across cultivars.
    const sumVaseCount = cultivars.reduce(
      (s, c) => s + c.treatments.reduce((ss, t) => ss + (t.vase_count || 0), 0),
      0,
    );
    const derivedVaseCount = sumVaseCount > 0 ? sumVaseCount : realRows.length;

    return { cultivars, treatmentAverages, derivedVaseCount, treatmentDisplayNo };
  }, [vases]);

  // Build measurement matrix.
  // Source data only stores property scores per real cultivar+treatment, NOT
  // against a synthetic "Average" cultivar — so we compute per-treatment
  // averages ourselves by averaging every real cultivar's score.
  const measurementMatrix = useMemo(() => {
    const propsSet = new Set<string>();
    const rowMap = new Map<string, Record<string, number | null>>();
    // Per-treatment running sums for averaging
    const tSums = new Map<number, Map<string, { sum: number; n: number }>>();
    for (const m of measurements) {
      if (!m.property_name) continue;
      propsSet.add(m.property_name);
      const key = `${m.cultivar || "?"}|${m.treatment_no || 0}`;
      if (!rowMap.has(key)) rowMap.set(key, {});
      rowMap.get(key)![m.property_name] = m.score ?? null;
      // Aggregate (skip pre-aggregated Average rows if any ever appear)
      if (
        m.treatment_no != null &&
        m.score != null &&
        !isAverageName(m.cultivar || "")
      ) {
        if (!tSums.has(m.treatment_no)) tSums.set(m.treatment_no, new Map());
        const propMap = tSums.get(m.treatment_no)!;
        const cur = propMap.get(m.property_name) || { sum: 0, n: 0 };
        cur.sum += Number(m.score);
        cur.n += 1;
        propMap.set(m.property_name, cur);
      }
    }
    const props = Array.from(propsSet).sort();
    const rows = Array.from(rowMap.entries())
      .map(([key, scores]) => {
        const [cultivar, tn] = key.split("|");
        return { cultivar, treatmentNo: parseInt(tn), scores };
      })
      .filter((r) => !isAverageName(r.cultivar))
      .sort(
        (a, b) =>
          a.cultivar.localeCompare(b.cultivar) || a.treatmentNo - b.treatmentNo,
      );
    const treatmentAverageRows = Array.from(tSums.entries())
      .map(([treatmentNo, propMap]) => {
        const scores: Record<string, number | null> = {};
        for (const [p, { sum, n }] of propMap) scores[p] = n > 0 ? sum / n : null;
        return { cultivar: "Average", treatmentNo, scores, isAverage: true };
      })
      .sort((a, b) => a.treatmentNo - b.treatmentNo);
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

  // Diff treatment names: keep only the parts that vary across treatments,
  // collapse the shared phases into a single caption above the table.
  const treatmentNameDiff = useMemo(
    () => diffTreatmentNames(treatmentAverages.map((t) => t.treatment_name)),
    [treatmentAverages],
  );
  // For the measurements matrix (keyed by treatment_no), diff against the
  // ordered list of unique treatment names.
  const measTreatmentDiff = useMemo(() => {
    const ordered = measurementMatrix.treatmentAverageRows.map(
      (r) => treatmentNameByNo.get(r.treatmentNo) || "",
    );
    return diffTreatmentNames(ordered);
  }, [measurementMatrix.treatmentAverageRows, treatmentNameByNo]);

  if (!trial) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-primary" />
            <span>Trial {trial.trial_number || trial.id.slice(0, 8)}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2 items-center pt-1">
            {trial.farm && <Badge variant="secondary">{trial.farm}</Badge>}
            {trial.customer && <Badge variant="outline">{trial.customer}</Badge>}
            {trial.crop && <Badge variant="outline">{trial.crop}</Badge>}
            {trial.freight_type && <Badge variant="outline">{trial.freight_type}</Badge>}
            {(() => {
              const isRepeat = /repeat/i.test(trial.recommendations || "");
              return isRepeat ? (
                <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">Repeat</Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300">Commercial</Badge>
              );
            })()}
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
            <div className="text-muted-foreground">Technical Consultant</div>
            <div className="font-medium">{technicalConsultant || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Trial concluded</div>
            <div className="font-medium">{fmtDate(computeConcludedDate(trial, measurements))}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Start VL trial</div>
            <div className="font-medium">{fmtDate(trial.start_vl)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Cultivars × Treatments</div>
            <div className="font-medium">
              {trial.cultivar_count ?? "—"} ×{" "}
              {treatmentAverages.length > 0
                ? treatmentAverages.length
                : (trial.treatment_count ?? "—")}
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
            <div className="font-medium">
              {derivedVaseCount > 0 ? derivedVaseCount : (trial.total_vases ?? "—")}
            </div>
          </div>
        </div>

        {trial.objective && (
          <section className="space-y-1 mt-3">
            <h3 className="text-sm font-semibold">Objective</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{trial.objective}</p>
          </section>
        )}

        {trial.conclusion && (
          <section className="space-y-1 mt-3">
            <h3 className="text-sm font-semibold">Conclusion</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{trial.conclusion}</p>
          </section>
        )}

        {/* AI analysis section */}
        <section className="mt-3 border border-primary/30 rounded-md bg-primary/5">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              AI analysis
              {aiUpdatedAt && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  · updated {new Date(aiUpdatedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant={aiAnalysis ? "outline" : "default"}
              onClick={() => runAiAnalysis(!!aiAnalysis)}
              disabled={aiLoading}
              className="gap-1.5"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : aiAnalysis ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {aiLoading ? "Analysing…" : aiAnalysis ? "Refresh analysis" : "AI analysis"}
            </Button>
          </div>
          {aiAnalysis && (
            <div className="px-3 pb-3 pt-2 border-t border-primary/20 text-sm leading-relaxed text-foreground/90 [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ul]:my-2 [&_strong]:font-semibold [&_strong]:text-foreground [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:text-[0.85em]">
              <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
            </div>
          )}
          {!aiAnalysis && !aiLoading && (
            <div className="px-3 pb-3 text-xs text-muted-foreground">
              Click the button to generate an AI-powered analysis that complements the team's conclusion with property-level insights.
            </div>
          )}
        </section>

        <Tabs defaultValue="vases" className="mt-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TabsList>
              <TabsTrigger value="vases" className="gap-1.5">
                <Sprout className="h-3.5 w-3.5" /> Vases ({derivedVaseCount || vases.length})
              </TabsTrigger>
              <TabsTrigger value="measurements" className="gap-1.5">
                <Beaker className="h-3.5 w-3.5" /> Measurements ({measurements.length})
              </TabsTrigger>
              <TabsTrigger value="conclusion">Conclusion &amp; Recommendation</TabsTrigger>
              <TabsTrigger value="details" className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> Details
                {plannerMatches.length > 0 && (
                  <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded px-1">
                    {plannerMatches.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <SharePageButton
                pageType="vaselife_report"
                disabled={vasesLoading || measLoading}
                getPayload={() => ({
                  trial,
                  vases,
                  measurements,
                  aiAnalysis,
                  aiUpdatedAt,
                  technicalConsultant,
                })}
              />
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
                    {treatmentNameDiff.shared.length > 0 && (
                      <div className="px-3 py-1.5 text-[11px] border-b border-primary/20 bg-primary/[0.03] text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wide text-foreground/70 mr-1">
                          Shared:
                        </span>
                        {treatmentNameDiff.shared.join(" · ")}
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">T#</TableHead>
                          <TableHead>Treatment (differences)</TableHead>
                          <TableHead className="w-20 text-right">VL days</TableHead>
                          <TableHead className="w-20 text-right">Bot %</TableHead>
                          <TableHead className="w-20 text-right">Flo %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {treatmentAverages.map((t, idx) => {
                          const diffName =
                            treatmentNameDiff.diffs[idx] || t.treatment_name || "—";
                          return (
                            <TableRow key={t.id_line} className="bg-primary/5">
                              <TableCell className="font-mono text-xs font-semibold text-primary">
                                {(t as any).display_no ?? t.treatment_no}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div
                                  className="line-clamp-2 font-medium"
                                  title={t.treatment_name || undefined}
                                >
                                  {diffName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                <MetricChip tone={vlDaysTone(t.flv_days)}>
                                  {t.flv_days != null ? t.flv_days.toFixed(1) : "—"}
                                </MetricChip>
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                <MetricChip tone={botPctTone(t.bot_percentage)}>
                                  {t.bot_percentage ?? "—"}
                                </MetricChip>
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                <MetricChip tone={floPctTone(t.flo_percentage)}>
                                  {t.flo_percentage ?? "—"}
                                </MetricChip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
                            <TableCell className="font-mono text-xs">{(t as any).display_no ?? t.treatment_no}</TableCell>
                            <TableCell className="text-xs">
                              <div className="line-clamp-2">{t.treatment_name || "—"}</div>
                            </TableCell>
                            <TableCell className="text-right text-xs">{t.vase_count ?? "—"}</TableCell>
                            <TableCell className="text-right text-xs">
                              <MetricChip tone={vlDaysTone(t.flv_days)}>
                                {t.flv_days != null ? t.flv_days.toFixed(1) : "—"}
                              </MetricChip>
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <MetricChip tone={botPctTone(t.bot_percentage)}>
                                {t.bot_percentage ?? "—"}
                              </MetricChip>
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              <MetricChip tone={floPctTone(t.flo_percentage)}>
                                {t.flo_percentage ?? "—"}
                              </MetricChip>
                            </TableCell>
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
                        {measurementMatrix.treatmentAverageRows.map((r, idx) => {
                          const fullName = treatmentNameByNo.get(r.treatmentNo) || "";
                          const diffName = measTreatmentDiff.diffs[idx] || fullName || "—";
                          return (
                            <TableRow key={r.treatmentNo} className="bg-primary/5">
                              <TableCell className="text-xs font-mono font-bold text-primary">
                                {r.treatmentNo}
                              </TableCell>
                              <TableCell className="text-xs font-medium">
                                <div className="line-clamp-2" title={fullName || undefined}>
                                  {diffName}
                                </div>
                              </TableCell>
                              {measurementMatrix.props.map((p) => (
                                <TableCell key={p} className="text-center">
                                  <ScoreChip code={p} score={r.scores[p]} bold />
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
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
