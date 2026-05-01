import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  getPropertyMeta,
  scoreTone,
  scoreToneClasses,
  type ScoreTone,
} from "@/lib/vaselifeProperties";

/** Header cell for a property column with hover tooltip explainer. */
export function PropertyHeader({ code, full = false }: { code: string; full?: boolean }) {
  const meta = getPropertyMeta(code);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            <span className="font-mono text-[11px]">{code}</span>
            {full && (
              <span className="text-[11px] text-muted-foreground hidden md:inline">
                {meta.label}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <div className="font-semibold">
            {code} — {meta.label}
          </div>
          <div className="text-muted-foreground mt-0.5">{meta.description}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Color-coded score chip respecting per-property direction. */
export function ScoreChip({
  code,
  score,
  bold = false,
}: {
  code: string;
  score: number | null | undefined;
  bold?: boolean;
}) {
  if (score == null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const tone = scoreTone(code, score);
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded text-[11px] tabular-nums ${
        bold ? "font-bold" : "font-medium"
      } ${scoreToneClasses(tone)}`}
    >
      {Number(score).toFixed(score % 1 === 0 ? 0 : 1)}
    </span>
  );
}

export function ToneBadge({
  tone,
  children,
}: {
  tone: ScoreTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums ${scoreToneClasses(
        tone,
      )}`}
    >
      {children}
    </span>
  );
}

/** Compact 0–5 scale legend footer. */
export function ScoreScaleLegend() {
  return (
    <div className="text-[10px] text-muted-foreground border-t border-border pt-2 mt-2 leading-relaxed">
      <span className="font-semibold uppercase tracking-wide mr-1">Scale 0–5:</span>
      For <em>quality</em> properties (colour, leaves, stems): 5 = perfect, 1 = unacceptable.
      For <em>damage</em> properties (Botrytis, write-off, abnormality): 0 = none, 5 = severe.
      Flower Opening (FLO) is context-dependent on the retail stage.
    </div>
  );
}
