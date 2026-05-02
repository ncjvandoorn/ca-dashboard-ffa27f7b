import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FileText } from "lucide-react";
import {
  useVaselifeVases,
  useVaselifeMeasurements,
  type VaselifeHeader,
} from "@/hooks/useVaselifeTrials";
import { VaselifeTrialReportBody } from "./VaselifeTrialReportBody";

interface Props {
  trial: VaselifeHeader | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Renders a Plantscout-style Vase Life Report mirroring the layout of the
 * official PDF exports. Property columns are crop-specific — derived from
 * whatever measurement properties the trial actually has, which matches
 * Plantscout's per-crop measurement schema.
 */
export function VaselifeTrialReport({ trial, open, onOpenChange }: Props) {
  const { data: vases = [], isLoading: vasesLoading } = useVaselifeVases(trial?.id);
  const { data: measurements = [], isLoading: measLoading } = useVaselifeMeasurements(trial?.id);

  if (!trial) return null;

  const reportCode =
    trial.trial_number ||
    (trial.start_vl ? trial.start_vl.replace(/-/g, "").slice(0, 8) : trial.id.slice(0, 8));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto bg-background"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg pr-8">
            <FileText className="h-5 w-5 text-primary" />
            Vase Life Report
            <span className="ml-2 font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
              {reportCode}
            </span>
          </SheetTitle>
        </SheetHeader>

        <VaselifeTrialReportBody
          trial={trial}
          vases={vases}
          measurements={measurements}
          vasesLoading={vasesLoading}
          measLoading={measLoading}
        />
      </SheetContent>
    </Sheet>
  );
}
