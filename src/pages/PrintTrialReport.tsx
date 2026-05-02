import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Loader2, FileText, Printer } from "lucide-react";
import {
  useVaselifeHeaders,
  useVaselifeVases,
  useVaselifeMeasurements,
} from "@/hooks/useVaselifeTrials";
import { VaselifeTrialReportBody } from "@/components/trials/VaselifeTrialReportBody";
import { Button } from "@/components/ui/button";
import chrysalLogo from "@/assets/chrysal-logo.png";

/**
 * Standalone, print-optimised Vase Life Report page.
 *
 * Opened in a new tab from the Trials Dashboard popup. Once the trial,
 * vases and measurements have all loaded, the browser print dialog is
 * triggered automatically.
 */
export default function PrintTrialReport() {
  const { id } = useParams<{ id: string }>();
  const { data: trials = [], isLoading: trialsLoading } = useVaselifeHeaders();
  const { data: vases = [], isLoading: vasesLoading } = useVaselifeVases(id);
  const { data: measurements = [], isLoading: measLoading } = useVaselifeMeasurements(id);

  const trial = trials.find((t) => t.id === id) || null;
  const printedRef = useRef(false);

  const ready =
    !!trial && !trialsLoading && !vasesLoading && !measLoading;

  useEffect(() => {
    if (!ready || printedRef.current) return;
    printedRef.current = true;
    // Small delay to allow layout/fonts to settle
    const t = setTimeout(() => {
      window.print();
    }, 600);
    return () => clearTimeout(t);
  }, [ready]);

  if (trialsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!trial) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Trial not found.
      </div>
    );
  }

  const reportCode =
    trial.trial_number ||
    (trial.start_vl ? trial.start_vl.replace(/-/g, "").slice(0, 8) : trial.id.slice(0, 8));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Print-only styling */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        @page { margin: 12mm; }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="no-print sticky top-0 z-10 border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto" />
          <h1 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Vase Life Report
            <span className="ml-1 font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              {reportCode}
            </span>
          </h1>
        </div>
        <Button size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-6">
        <VaselifeTrialReportBody
          trial={trial}
          vases={vases}
          measurements={measurements}
          vasesLoading={vasesLoading}
          measLoading={measLoading}
        />
      </main>
    </div>
  );
}
