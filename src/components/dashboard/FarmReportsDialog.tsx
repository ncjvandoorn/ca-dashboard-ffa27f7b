import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportDetailDialog } from "@/components/dashboard/ReportDetailDialog";
import type { QualityReport, User } from "@/lib/csvParser";
import { getReportTimestamp, isVisibleFarmReport } from "@/lib/reportVisibility";

interface FarmReportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  farmName: string;
  reports: QualityReport[];
  users: User[];
}

function ratingLabel(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v === 1) return "Good";
  if (v === 2) return "Average";
  if (v === 3) return "Bad";
  return String(v);
}

function ratingColor(v: number | null): string {
  if (v === 1) return "text-accent";
  if (v === 3) return "text-destructive";
  if (v === 2) return "text-warning";
  return "text-muted-foreground";
}

export function FarmReportsDialog({ open, onOpenChange, farmId, farmName, reports, users }: FarmReportsDialogProps) {
  const [selectedReport, setSelectedReport] = useState<QualityReport | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const farmReports = useMemo(() => {
    return reports
      .filter((report) => report.farmAccountId === farmId && isVisibleFarmReport(report))
      .sort((a, b) => (b.weekNr - a.weekNr) || ((getReportTimestamp(b) ?? 0) - (getReportTimestamp(a) ?? 0)));
  }, [reports, farmId]);

  const selectedReportAuthor = selectedReport
    ? userMap.get(selectedReport.submittedByUserId || "") ||
      userMap.get(selectedReport.createdByUserId || "") ||
      userMap.get(selectedReport.updatedByUserId || "") ||
      selectedReport.signoffName ||
      undefined
    : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto" aria-describedby="farm-reports-description">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogTitle className="text-lg font-bold">Reports — {farmName}</DialogTitle>
            <DialogDescription id="farm-reports-description">
              {farmReports.length} report{farmReports.length !== 1 ? "s" : ""} with recorded data
            </DialogDescription>
          </div>
          {farmReports.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No reports with recorded data for this farm.</p>
          ) : (
            <div className="space-y-1">
              {farmReports.map((report) => {
                const createdBy =
                  userMap.get(report.submittedByUserId || "") ||
                  userMap.get(report.createdByUserId || "") ||
                  userMap.get(report.updatedByUserId || "") ||
                  report.signoffName ||
                  "—";
                const timestamp = getReportTimestamp(report);
                const date = timestamp
                  ? new Date(timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  : "—";

                return (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-4 py-3 text-left transition-colors hover:border-border/50 hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="w-12 font-mono text-sm font-semibold tabular-nums text-foreground">{report.weekNr}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{createdBy}</p>
                        <p className="text-xs text-muted-foreground">{date}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${ratingColor(report.qrGenQualityRating)}`}>
                      {ratingLabel(report.qrGenQualityRating)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ReportDetailDialog
        report={selectedReport}
        farmName={farmName}
        createdByName={selectedReportAuthor}
        open={!!selectedReport}
        onOpenChange={(open) => {
          if (!open) setSelectedReport(null);
        }}
      />
    </>
  );
}
