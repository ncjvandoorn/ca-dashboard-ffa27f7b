import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SharePageButton } from "@/components/SharePageButton";
import type { QualityReport } from "@/lib/csvParser";
import { QualityReportBody } from "./QualityReportBody";

interface ReportDetailDialogProps {
  report: QualityReport | null;
  farmName: string;
  createdByName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDetailDialog({ report, farmName, createdByName, open, onOpenChange }: ReportDetailDialogProps) {
  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">Quality Report</DialogTitle>
            <SharePageButton
              pageType="quality_report"
              getPayload={() => ({ report, farmName, createdByName })}
            />
          </div>
        </DialogHeader>
        <QualityReportBody report={report} farmName={farmName} createdByName={createdByName} />
      </DialogContent>
    </Dialog>
  );
}
