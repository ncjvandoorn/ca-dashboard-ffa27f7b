import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportDetailDialog } from "@/components/dashboard/ReportDetailDialog";
import type { QualityReport, Account, User } from "@/lib/csvParser";

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
      .filter((r) => r.farmAccountId === farmId && r.submittedAt && r.weekNr > 0)
      .sort((a, b) => b.weekNr - a.weekNr);
  }, [reports, farmId]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Reports — {farmName}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {farmReports.length} submitted report{farmReports.length !== 1 ? "s" : ""}
            </p>
          </DialogHeader>
          {farmReports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No submitted reports for this farm.
            </p>
          ) : (
            <div className="space-y-1">
              {farmReports.map((r) => {
                const createdBy = userMap.get(r.createdByUserId || "") || "—";
                const date = r.submittedAt
                  ? new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  : "—";
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReport(r)}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between gap-3 border border-transparent hover:border-border/50"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground w-12">
                        {r.weekNr}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{createdBy}</p>
                        <p className="text-xs text-muted-foreground">{date}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${ratingColor(r.qrGenQualityRating)}`}>
                      {ratingLabel(r.qrGenQualityRating)}
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
        onOpenChange={(o) => { if (!o) setSelectedReport(null); }}
      />
    </>
  );
}
