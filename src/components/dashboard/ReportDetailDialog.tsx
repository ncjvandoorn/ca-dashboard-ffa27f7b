import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExportPdfButton } from "@/components/dashboard/ExportPdfButton";
import { CalendarDays, Home, Leaf, User } from "lucide-react";
import type { QualityReport } from "@/lib/csvParser";

interface ReportDetailDialogProps {
  report: QualityReport | null;
  farmName: string;
  createdByName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ratingLabel(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v === 1) return "Good";
  if (v === 2) return "Average";
  if (v === 3) return "Bad";
  return String(v);
}

function ratingColor(v: number | null): string {
  if (v === 1) return "text-accent bg-accent/10 border-accent/30";
  if (v === 3) return "text-destructive bg-destructive/10 border-destructive/30";
  if (v === 2) return "text-warning bg-warning/10 border-warning/30";
  return "text-muted-foreground bg-muted/20 border-border";
}

function fmt(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : ""}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/50 min-h-[36px]">
        {value || "—"}
      </p>
    </div>
  );
}

function RatingField({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <span className={`inline-flex items-center text-sm font-medium px-3 py-1.5 rounded-lg border ${ratingColor(value)}`}>
        {ratingLabel(value)}
      </span>
    </div>
  );
}

function NoteField({ label, value }: { label: string; value: string | null }) {
  const text = value?.trim() || "";
  return (
    <div className="col-span-full">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="text-sm text-foreground bg-muted/30 rounded-lg px-3 py-2.5 border border-border/50 min-h-[60px] whitespace-pre-wrap">
        {text || "—"}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3" data-pdf-section>
      <h3 className="text-sm font-bold text-primary uppercase tracking-wide">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {children}
      </div>
    </div>
  );
}

export function ReportDetailDialog({ report, farmName, createdByName, open, onOpenChange }: ReportDetailDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  if (!report) return null;

  const createdDate = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const submittedDate = report.submittedAt
    ? new Date(report.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <div ref={contentRef} className="p-1 space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold">Quality Report</DialogTitle>
              <ExportPdfButton
                targetRef={contentRef}
                filename={`report-${farmName.replace(/\s+/g, "-")}-wk${report.weekNr}`}
                size="sm"
              />
            </div>
          </DialogHeader>

          {/* Header info bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Week</p>
                <p className="text-sm font-bold text-foreground">{report.weekNr}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Farm</p>
                <p className="text-sm font-bold text-foreground">{farmName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Created By</p>
                <p className="text-sm font-bold text-foreground">{createdByName || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Submitted</p>
                <p className="text-sm font-bold text-foreground">{submittedDate}</p>
              </div>
            </div>
          </div>

          {/* General */}
          <Section title="General">
            <RatingField label="Quality of Flowers Rating" value={report.qrGenQualityRating} />
            <Field label="Dipping Location" value={fmt(report.qrGenDippingLocation)} />
            <NoteField label="Quality of Flowers (notes)" value={report.qrGenQualityFlowers} />
            <NoteField label="Protocol Changes" value={report.qrGenProtocolChanges} />
          </Section>

          {/* Intake Area & Cold Store */}
          <Section title="Intake Area & Cold Store">
            <Field label="Head Size" value={fmt(report.qrIntakeHeadSize)} />
            <Field label="Stem Length" value={fmt(report.qrIntakeStemLength)} />
            <Field label="Dipping Stand" value={fmt(report.qrIntakeDippingStand)} />
            <Field label="Using Nets" value={fmt(report.qrIntakeUsingNets)} />
            <Field label="pH" value={fmt(report.qrIntakePh)} />
            <Field label="EC" value={fmt(report.qrIntakeEc)} />
            <RatingField label="Water Quality" value={report.qrIntakeWaterQuality} />
            <Field label="Post-harvest Treatment" value={fmt(report.qrIntakeTreatment)} />
            <Field label="Temperature (°C)" value={fmt(report.qrIntakeTempColdstore)} />
            <Field label="Humidity (%)" value={fmt(report.qrIntakeHumidityColdstore)} />
            <Field label="Hours in Cold Store" value={fmt(report.qrIntakeColdstoreHours)} />
          </Section>

          {/* Packhouse */}
          <Section title="Packhouse">
            <RatingField label="Speed of Processing" value={report.qrPackProcessingSpeed} />
          </Section>

          {/* Export Cold Store */}
          <Section title="Export Cold Store">
            <Field label="pH" value={fmt(report.qrExportPh)} />
            <Field label="EC" value={fmt(report.qrExportEc)} />
            <RatingField label="Water Quality" value={report.qrExportWaterQuality} />
            <Field label="Post-harvest Treatment" value={fmt(report.qrExportTreatment)} />
            <Field label="Temperature (°C)" value={fmt(report.qrExportTempColdstore)} />
            <Field label="Humidity (%)" value={fmt(report.qrExportHumidityColdstore)} />
            <Field label="Hours in Cold Store" value={fmt(report.qrExportColdstoreHours)} />
          </Section>

          {/* Dispatch */}
          <Section title="Dispatch">
            <RatingField label="Quality of Packing" value={report.qrDispatchPackingQuality} />
            <Field label="Packrate" value={fmt(report.qrDispatchPackrate)} />
            <Field label="Liner Used" value={fmt(report.qrDispatchUsedLiner)} />
            <Field label="Truck Type" value={fmt(report.qrDispatchTruckType)} />
          </Section>

          {/* General Comment */}
          <Section title="General Comment">
            <NoteField label="Comment" value={report.generalComment} />
          </Section>

          {/* Sign-off */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <span>Sign-off: <span className="font-medium text-foreground">{fmt(report.signoffName)}</span></span>
            <span>Created: {createdDate}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
