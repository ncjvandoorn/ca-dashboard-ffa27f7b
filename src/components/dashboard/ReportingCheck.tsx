import { useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ExportPdfButton } from "@/components/dashboard/ExportPdfButton";
import { ClipboardCheck, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { QualityReport, Account, User } from "@/lib/csvParser";

interface ReportingCheckProps {
  reports: QualityReport[];
  accounts: Account[];
  users: User[];
}

interface FarmCompliance {
  farmId: string;
  farmName: string;
  managerName: string | null;
  totalReports: number;
  qualityNotesFilled: number;
  protocolNotesFilled: number;
  generalCommentFilled: number;
  qualityPct: number;
  protocolPct: number;
  commentPct: number;
  overallPct: number;
}

function isNoteFilled(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 && trimmed !== "-" && trimmed !== "n/a" && trimmed !== "na" && trimmed !== "none";
}

export function ReportingCheck({ reports, accounts, users }: ReportingCheckProps) {
  const [open, setOpen] = useState(false);
  const [expandedFarm, setExpandedFarm] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const farmCompliance = useMemo(() => {
    const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const byFarm = new Map<string, QualityReport[]>();

    for (const r of reports) {
      if (r.weekNr <= 0 || !r.submittedAt) continue;
      if (!byFarm.has(r.farmAccountId)) byFarm.set(r.farmAccountId, []);
      byFarm.get(r.farmAccountId)!.push(r);
    }

    const results: FarmCompliance[] = [];

    for (const [farmId, farmReports] of byFarm) {
      const total = farmReports.length;
      if (total === 0) continue;

      // Find manager from the latest report with fallbacks
      const sorted = [...farmReports].sort((a, b) => a.createdAt - b.createdAt);
      const lastReport = sorted[sorted.length - 1];
      const managerName = (
        (lastReport.submittedByUserId ? userMap.get(lastReport.submittedByUserId) : null) ||
        (lastReport.createdByUserId ? userMap.get(lastReport.createdByUserId) : null) ||
        (lastReport.updatedByUserId ? userMap.get(lastReport.updatedByUserId) : null) ||
        lastReport.signoffName ||
        null
      );

      const qualityNotesFilled = farmReports.filter((r) => isNoteFilled(r.qrGenQualityFlowers)).length;
      const protocolNotesFilled = farmReports.filter((r) => isNoteFilled(r.qrGenProtocolChanges)).length;
      const generalCommentFilled = farmReports.filter((r) => isNoteFilled(r.generalComment)).length;

      const qualityPct = (qualityNotesFilled / total) * 100;
      const protocolPct = (protocolNotesFilled / total) * 100;
      const commentPct = (generalCommentFilled / total) * 100;
      const overallPct = ((qualityNotesFilled + protocolNotesFilled + generalCommentFilled) / (total * 3)) * 100;

      results.push({
        farmId,
        farmName: accountMap.get(farmId) || farmId,
        managerName,
        totalReports: total,
        qualityNotesFilled,
        protocolNotesFilled,
        generalCommentFilled,
        qualityPct,
        protocolPct,
        commentPct,
        overallPct,
      });
    }

    return results.sort((a, b) => a.overallPct - b.overallPct);
  }, [reports, accounts, users]);

  const avgOverall = farmCompliance.length > 0
    ? farmCompliance.reduce((s, f) => s + f.overallPct, 0) / farmCompliance.length
    : 0;

  const poorFarms = farmCompliance.filter((f) => f.overallPct < 50).length;

  function statusColor(pct: number) {
    if (pct >= 80) return "text-accent";
    if (pct >= 50) return "text-warning";
    return "text-destructive";
  }

  function statusIcon(pct: number) {
    if (pct >= 80) return <CheckCircle2 className="w-4 h-4 text-accent" />;
    return <AlertCircle className="w-4 h-4 text-destructive" />;
  }

  function progressColor(pct: number): string {
    if (pct >= 80) return "[&>div]:bg-accent";
    if (pct >= 50) return "[&>div]:bg-warning";
    return "[&>div]:bg-destructive";
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-0 shadow-card bg-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
        >
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Reporting Check
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <div ref={contentRef} className="p-2">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Reporting Completeness Check
            </DialogTitle>
            <ExportPdfButton targetRef={contentRef} filename="reporting-check" size="sm" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            How consistently are staff filling in quality notes and protocol observations per farm.
          </p>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mt-4 mb-6">
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{avgOverall.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Avg completeness</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{farmCompliance.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Farms evaluated</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className={`text-2xl font-bold ${poorFarms > 0 ? "text-destructive" : "text-accent"}`}>
              {poorFarms}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Farms below 50%</p>
          </div>
        </div>

        {/* Farm list */}
        <div className="space-y-2">
          {farmCompliance.map((farm, idx) => {
            const expanded = expandedFarm === farm.farmId;
            return (
              <motion.div
                key={farm.farmId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                  farm.overallPct < 50
                    ? "border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
                    : farm.overallPct < 80
                    ? "border-warning/20 bg-warning/5 hover:bg-warning/10"
                    : "border-accent/20 bg-accent/5 hover:bg-accent/10"
                }`}
                onClick={() => setExpandedFarm(expanded ? null : farm.farmId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(farm.overallPct)}
                    <span className="font-medium text-sm text-foreground">{farm.farmName}</span>
                    {farm.managerName && (
                      <span className="text-xs text-muted-foreground">| {farm.managerName}</span>
                    )}
                    <span className="text-xs text-muted-foreground">({farm.totalReports} reports)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${statusColor(farm.overallPct)}`}>
                      {farm.overallPct.toFixed(0)}%
                    </span>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 space-y-3"
                  >
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Quality Flowers Notes</span>
                        <span className={statusColor(farm.qualityPct)}>
                          {farm.qualityNotesFilled}/{farm.totalReports} ({farm.qualityPct.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress value={farm.qualityPct} className={`h-2 ${progressColor(farm.qualityPct)}`} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Protocol Changes Notes</span>
                        <span className={statusColor(farm.protocolPct)}>
                          {farm.protocolNotesFilled}/{farm.totalReports} ({farm.protocolPct.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress value={farm.protocolPct} className={`h-2 ${progressColor(farm.protocolPct)}`} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">General Comments</span>
                        <span className={statusColor(farm.commentPct)}>
                          {farm.generalCommentFilled}/{farm.totalReports} ({farm.commentPct.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress value={farm.commentPct} className={`h-2 ${progressColor(farm.commentPct)}`} />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
