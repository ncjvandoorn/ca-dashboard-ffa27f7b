import { useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { exportElementToPdf } from "@/lib/exportPdf";
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
  const contentRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = useCallback(async () => {
    const el = contentRef.current;
    if (!el || !report) return;
    try {
      await exportElementToPdf(el, `report-${farmName.replace(/\s+/g, "-")}-wk${report.weekNr}`);
      toast({ title: "PDF exported", description: `report-${farmName.replace(/\s+/g, "-")}-wk${report.weekNr}.pdf downloaded` });
    } catch (e: any) {
      console.error("PDF export failed:", e);
      toast({ title: "Export failed", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }, [report, farmName]);

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">Quality Report</DialogTitle>
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-2">
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </DialogHeader>
        <QualityReportBody ref={contentRef} report={report} farmName={farmName} createdByName={createdByName} />
      </DialogContent>
    </Dialog>
  );
}
