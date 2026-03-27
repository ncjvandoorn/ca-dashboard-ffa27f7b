import { useCallback } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { exportElementToPdf } from "@/lib/exportPdf";
import { exportSectionsPdf } from "@/lib/exportPdfSections";

interface ExportPdfButtonProps {
  /** CSS selector or ref callback to find the export target */
  targetRef: React.RefObject<HTMLElement | null>;
  filename: string;
  size?: "sm" | "icon" | "default";
  label?: string;
  /** Use section-aware export to avoid splitting content across pages */
  useSections?: boolean;
}

export function ExportPdfButton({ targetRef, filename, size = "sm", label, useSections }: ExportPdfButtonProps) {
  const handleExport = useCallback(async () => {
    const el = targetRef.current;
    if (!el) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    try {
      if (useSections) {
        await exportSectionsPdf(el, filename);
      } else {
        await exportElementToPdf(el, filename);
      }
      toast({ title: "PDF exported", description: `${filename}.pdf downloaded` });
    } catch (e: any) {
      console.error("PDF export failed:", e);
      toast({ title: "Export failed", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }, [targetRef, filename, useSections]);

  return (
    <Button variant="outline" size={size} onClick={handleExport} className="gap-2">
      <FileDown className="h-4 w-4" />
      {label ?? "Export PDF"}
    </Button>
  );
}
