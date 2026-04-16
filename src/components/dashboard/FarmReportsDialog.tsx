import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportDetailDialog } from "@/components/dashboard/ReportDetailDialog";
import type { QualityReport, User } from "@/lib/csvParser";

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

function reportTimestamp(report: QualityReport): number | null {
  return report.submittedAt ?? report.createdAt;
}

function hasVisibleReportData(report: QualityReport): boolean {
  return [
    report.qrGenQualityRating,
    report.qrIntakePh,
    report.qrIntakeEc,
    report.qrIntakeHeadSize,
    report.qrIntakeHumidityColdstore,
    report.qrIntakeStemLength,
    report.qrIntakeTempColdstore,
    report.qrIntakeWaterQuality,
    report.qrExportPh,
    report.qrExportEc,
    report.qrExportHumidityColdstore,
    report.qrExportTempColdstore,
    report.qrExportWaterQuality,
    report.qrDispatchPackingQuality,
    report.qrDispatchPackrate,
    report.qrPackProcessingSpeed,
    report.qrGenQualityFlowers,
    report.qrGenDippingLocation,
    report.qrGenProtocolChanges,
    report.qrIntakeTreatment,
    report.qrIntakeDippingStand,
    report.qrIntakeUsingNets,
    report.qrExportTreatment,
    report.qrDispatchTruckType,
    report.qrDispatchUsedLiner,
    report.generalComment,
    report.signoffName,
  ].some((value) => value !== null && value !== "");
}

export function FarmReportsDialog({ open, onOpenChange, farmId, farmName, reports, users }: FarmReportsDialogProps) {
  const [selectedReport, setSelectedReport] = useState<QualityReport | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const farmReports = useMemo(() => {
    return reports
      .filter((report) => report.farmAccountId === farmId && report.weekNr > 0 && hasVisibleReportData(report))
      .sort((a, b) => (b.weekNr - a.weekNr) || ((reportTimestamp(b) ?? 0) - (reportTimestamp(a) ?? 0)));
  }, [reports, farmId]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Reports — {farmName}</DialogTitle>
            <DialogDescription>
              {farmReports.length} report{farmReports.length !== 1 ? "s" : ""} with recorded data
            </DialogDescription>
          </DialogHeader>
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
                const timestamp = reportTimestamp(report);
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
        createdByName={selectedReport ? userMap.get(selectedReport.createdByUserId || "") : undefined}
        open={!!selectedReport}
        onOpenChange={(open) => {
          if (!open) setSelectedReport(null);
        }}
      />
    </>
  );
}
