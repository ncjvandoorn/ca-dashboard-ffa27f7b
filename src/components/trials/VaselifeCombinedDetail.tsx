import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Sparkles, Layers, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PROPERTY_META, scoreTone, scoreToneClasses } from "@/lib/vaselifeProperties";
import type { VaselifeHeader } from "@/hooks/useVaselifeTrials";

interface TreatmentRow {
  treatment: string;
  trial_count: number;
  crops: string[];
  vl_days: number | null;
  bot_pct: number | null;
  flo_pct: number | null;
  property_scores: Record<string, number | null>;
}
interface CropRow {
  crop: string;
  trial_count: number;
  treatment_count: number;
  vl_days: number | null;
  bot_pct: number | null;
  flo_pct: number | null;
  property_scores: Record<string, number | null>;
}

interface Props {
  trials: VaselifeHeader[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(digits);
}

export function VaselifeCombinedDetail({ trials, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [treatmentTable, setTreatmentTable] = useState<TreatmentRow[]>([]);
  const [cropTable, setCropTable] = useState<CropRow[]>([]);

  const ids = trials.map((t) => t.id).join(",");

  const run = async () => {
    if (trials.length === 0) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-trials-combo", {
        body: { headerIds: trials.map((t) => t.id) },
      });
      if (error) throw error;
      if (data?.error && !data?.treatmentTable) throw new Error(data.error);
      setAnalysis(data.analysis || null);
      setTreatmentTable(data.treatmentTable || []);
      setCropTable(data.cropTable || []);
    } catch (e: any) {
      toast({
        title: "Combined analysis failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && trials.length > 0) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ids]);

  // Heterogeneity check — warn if very mixed
  const cropSet = new Set(trials.map((t) => (t.crop || "").trim()).filter(Boolean));
  const customerSet = new Set(trials.map((t) => (t.customer || "").trim()).filter(Boolean));
  const showWarning = cropSet.size > 3 || customerSet.size > 4;

  // Collect all property codes present
  const allProps = Array.from(
    new Set([
      ...treatmentTable.flatMap((r) => Object.keys(r.property_scores)),
      ...cropTable.flatMap((r) => Object.keys(r.property_scores)),
    ]),
  ).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-primary" />
            Combined trials overview
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-1.5 items-center pt-1">
            <Badge variant="secondary">{trials.length} trials</Badge>
            <Badge variant="outline">{cropSet.size} crops</Badge>
            <Badge variant="outline">{customerSet.size} customers</Badge>
            {trials.slice(0, 6).map((t) => (
              <Badge key={t.id} variant="outline" className="text-[10px]">
                {t.trial_number || t.id.slice(0, 6)}
              </Badge>
            ))}
            {trials.length > 6 && (
              <span className="text-xs text-muted-foreground">+{trials.length - 6} more</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {showWarning && (
          <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Selection spans many crops/customers — combined averages may obscure
              crop-specific patterns. Consider narrowing the selection.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={run} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
        </div>

        <Tabs defaultValue="treatment" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="treatment">By treatment</TabsTrigger>
            <TabsTrigger value="crop">By crop</TabsTrigger>
            <TabsTrigger value="ai">AI synthesis</TabsTrigger>
          </TabsList>

          <TabsContent value="treatment" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Aggregated across all selected trials. Treatments are matched by exact name. Vaselife
              days = average of per-vase flv_days. Property scores 1-5 (5 = best).
            </p>
            {loading && treatmentTable.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : treatmentTable.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No treatment data.</p>
            ) : (
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Treatment</TableHead>
                      <TableHead className="text-right">Trials</TableHead>
                      <TableHead>Crops</TableHead>
                      <TableHead className="text-right">VL days</TableHead>
                      <TableHead className="text-right">Bot %</TableHead>
                      <TableHead className="text-right">Flo %</TableHead>
                      {allProps.map((p) => (
                        <TableHead key={p} className="text-right" title={PROPERTY_META[p]?.label || p}>
                          {p}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatmentTable.map((r) => (
                      <TableRow key={r.treatment}>
                        <TableCell className="text-xs font-medium">{r.treatment}</TableCell>
                        <TableCell className="text-right text-xs">{r.trial_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.crops.join(", ") || "—"}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmtNum(r.vl_days)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmtNum(r.bot_pct)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmtNum(r.flo_pct)}</TableCell>
                        {allProps.map((p) => {
                          const s = r.property_scores[p];
                          const tone = scoreTone(p, s);
                          return (
                            <TableCell key={p} className="text-right">
                              {s == null ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <span className={`inline-flex items-center justify-center min-w-[34px] px-1 py-0.5 rounded text-[10px] font-semibold tabular-nums ${scoreToneClasses(tone)}`}>
                                  {s.toFixed(2)}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="crop" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Aggregated by crop across all selected trials.
            </p>
            {loading && cropTable.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : cropTable.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No crop data.</p>
            ) : (
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Crop</TableHead>
                      <TableHead className="text-right">Trials</TableHead>
                      <TableHead className="text-right">Treatments</TableHead>
                      <TableHead className="text-right">VL days</TableHead>
                      <TableHead className="text-right">Bot %</TableHead>
                      <TableHead className="text-right">Flo %</TableHead>
                      {allProps.map((p) => (
                        <TableHead key={p} className="text-right" title={PROPERTY_META[p]?.label || p}>
                          {p}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cropTable.map((r) => (
                      <TableRow key={r.crop}>
                        <TableCell className="text-sm font-medium">{r.crop}</TableCell>
                        <TableCell className="text-right text-xs">{r.trial_count}</TableCell>
                        <TableCell className="text-right text-xs">{r.treatment_count}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmtNum(r.vl_days)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmtNum(r.bot_pct)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmtNum(r.flo_pct)}</TableCell>
                        {allProps.map((p) => {
                          const s = r.property_scores[p];
                          const tone = scoreTone(p, s);
                          return (
                            <TableCell key={p} className="text-right">
                              {s == null ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <span className={`inline-flex items-center justify-center min-w-[34px] px-1 py-0.5 rounded text-[10px] font-semibold tabular-nums ${scoreToneClasses(tone)}`}>
                                  {s.toFixed(2)}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ai" className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Fresh AI synthesis based on the combined dataset (not cached individual conclusions).
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : analysis ? (
              <div className="prose prose-sm dark:prose-invert max-w-none border border-border rounded-md p-4 bg-muted/20">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No AI analysis yet.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
