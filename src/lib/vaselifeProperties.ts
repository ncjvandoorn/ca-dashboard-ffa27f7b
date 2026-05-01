/**
 * Plantscout vase-life property metadata.
 * Score scale is 0–5 across all properties.
 *
 * `direction`:
 *  - "quality"  : higher is better (5 = perfect, 1 = unacceptable)
 *  - "damage"   : lower is better  (0 = none, 5 = severe)  — Botrytis, write-off, abnormality, damage
 *  - "neutral"  : context-dependent (FLO — opening stage)
 */
export type PropDirection = "quality" | "damage" | "neutral";

export interface PropertyMeta {
  code: string;
  label: string;
  direction: PropDirection;
  description: string;
}

export const PROPERTY_META: Record<string, PropertyMeta> = {
  FLC: {
    code: "FLC",
    label: "Flower Colour",
    direction: "quality",
    description:
      "Intensity & purity of flower colour vs. cultivar standard. 5 = full colour, 1 = bleached / discoloured.",
  },
  FLO: {
    code: "FLO",
    label: "Flower Opening",
    direction: "neutral",
    description:
      "Developmental stage of the flower. 1 = tight bud, 5 = fully open. Optimum depends on retail target.",
  },
  FLD: {
    code: "FLD",
    label: "Flower Damage",
    direction: "damage",
    description:
      "Mechanical / physiological damage to the flower (bruising, shatter, petal loss). 0 = none, 5 = severe.",
  },
  FLA: {
    code: "FLA",
    label: "Flower Abnormality",
    direction: "damage",
    description: "Malformation of the flower. 0 = normal, 5 = strongly abnormal.",
  },
  STD: {
    code: "STD",
    label: "Stem Damage",
    direction: "quality",
    description: "Condition of the stem. 5 = clean, 1 = heavily damaged.",
  },
  STB: {
    code: "STB",
    label: "Stem Bend (bent neck)",
    direction: "quality",
    description: "Stem posture. 5 = fully upright, 1 = collapsed / bent neck.",
  },
  LFQ: {
    code: "LFQ",
    label: "Leaf Quality",
    direction: "quality",
    description: "Overall foliage condition. 5 = perfect, 1 = very poor.",
  },
  LFY: {
    code: "LFY",
    label: "Leaf Yellowing",
    direction: "quality",
    description: "Chlorosis. 5 = fresh green, 1 = fully yellow.",
  },
  LFB: {
    code: "LFB",
    label: "Leaf Burn",
    direction: "quality",
    description: "Edge necrosis / scorching. 5 = none, 1 = severe.",
  },
  LFD: {
    code: "LFD",
    label: "Leaf Damage",
    direction: "quality",
    description: "Mechanical leaf damage. 5 = none, 1 = severe.",
  },
  LFT: {
    code: "LFT",
    label: "Leaf Turgor",
    direction: "quality",
    description: "Wilting status of foliage. 5 = fully turgid, 1 = wilted.",
  },
  BTR: {
    code: "BTR",
    label: "Botrytis (flower)",
    direction: "damage",
    description: "Severity of Botrytis on flowers. 0 = none, 5 = severe infection.",
  },
  BLF: {
    code: "BLF",
    label: "Botrytis (leaf)",
    direction: "damage",
    description: "Severity of Botrytis on foliage. 0 = none, 5 = severe infection.",
  },
  CVW: {
    code: "CVW",
    label: "Cultivar Write-off",
    direction: "damage",
    description:
      "Share of vases scored unacceptable for this cultivar/treatment. Higher = more write-off.",
  },
};

/** Backwards-compatible label map (code -> short label). */
export const PROPERTY_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(PROPERTY_META).map((m) => [m.code, m.label]),
);

export function getPropertyMeta(code: string): PropertyMeta {
  return (
    PROPERTY_META[code] || {
      code,
      label: code,
      direction: "neutral",
      description: "Unknown property — no description available.",
    }
  );
}

/**
 * Per-crop headline KPIs (ordered, most-important first). Used to surface
 * the metrics that actually drive the verdict for that crop type at the
 * top of the report. Falls back to the most-observed properties in the
 * trial when the crop isn't mapped.
 */
const CROP_KPI_RULES: { match: RegExp; kpis: string[] }[] = [
  { match: /rose/i, kpis: ["FLO", "STB", "BTR", "FLC"] },
  { match: /carnation/i, kpis: ["FLO", "STB", "FLC", "FLD"] },
  { match: /chrysanthemum/i, kpis: ["LFY", "FLC", "FLD", "LFQ"] },
  { match: /gypsophila/i, kpis: ["FLC", "STD", "FLO", "BTR"] },
  { match: /eryngium|solidago|aster|achillea/i, kpis: ["LFY", "LFB", "LFQ", "FLC"] },
  { match: /astrantia|phlox|sanguisorba/i, kpis: ["LFY", "LFB", "FLC", "LFD"] },
  { match: /hypericum/i, kpis: ["LFB", "FLC", "LFQ", "BTR"] },
  { match: /hydrangea/i, kpis: ["LFY", "LFQ", "FLC", "FLD"] },
  { match: /delphinium/i, kpis: ["STB", "FLD", "LFQ", "FLC"] },
  { match: /agapanthus|ageratum|echinacea/i, kpis: ["FLC", "STD", "FLD", "FLO"] },
];

/** Return ordered headline KPIs for a crop, restricted to props present in this trial. */
export function getCropHeadlineKpis(
  crop: string | null | undefined,
  presentProps: string[],
  fallbackByCount?: Map<string, number>,
): string[] {
  const present = new Set(presentProps);
  const rule = CROP_KPI_RULES.find((r) => r.match.test(crop || ""));
  if (rule) {
    const ordered = rule.kpis.filter((p) => present.has(p));
    if (ordered.length > 0) return ordered;
  }
  // Fallback: top-4 by observation count (or alphabetical if no count map)
  if (fallbackByCount) {
    return [...presentProps]
      .sort((a, b) => (fallbackByCount.get(b) || 0) - (fallbackByCount.get(a) || 0))
      .slice(0, 4);
  }
  return presentProps.slice(0, 4);
}

/**
 * Tone for a score given a property's direction.
 *  - "good"  → green
 *  - "warn"  → amber
 *  - "bad"   → red
 *  - "neutral" → muted
 */
export type ScoreTone = "good" | "warn" | "bad" | "neutral";

export function scoreTone(code: string, score: number | null | undefined): ScoreTone {
  if (score == null || isNaN(score)) return "neutral";
  const dir = getPropertyMeta(code).direction;
  if (dir === "neutral") return "neutral";
  if (dir === "quality") {
    if (score >= 4) return "good";
    if (score >= 2.5) return "warn";
    return "bad";
  }
  // damage
  if (score <= 1) return "good";
  if (score <= 2.5) return "warn";
  return "bad";
}

/** Tailwind classes for inline score chips. */
export function scoreToneClasses(tone: ScoreTone): string {
  switch (tone) {
    case "good":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30";
    case "warn":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30";
    case "bad":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30";
    default:
      return "bg-muted text-muted-foreground ring-1 ring-border";
  }
}

/** Δ-vs-control formatter for vase life days. Positive = more days = better. */
export function formatDeltaDays(delta: number | null): {
  text: string;
  tone: ScoreTone;
} {
  if (delta == null || isNaN(delta)) return { text: "—", tone: "neutral" };
  if (Math.abs(delta) < 0.05) return { text: "±0.0 d", tone: "neutral" };
  const sign = delta > 0 ? "+" : "";
  return {
    text: `${sign}${delta.toFixed(1)} d`,
    tone: delta > 0 ? "good" : "bad",
  };
}

/**
 * Treatment names in Plantscout are pipe-separated tokens that describe each
 * trial phase (e.g. greenhouse | dipping | post-harvest | store | consumer).
 * When comparing treatments side-by-side, the phases that are identical
 * across all treatments are noise — what the reader cares about is the part
 * that actually changes between treatments.
 *
 * `diffTreatmentNames` returns, for each input name, only the tokens that
 * differ from at least one other treatment. Tokens shared by every treatment
 * are dropped. Returns the original name if the diff would be empty (e.g.
 * single treatment, or all identical).
 */
export function diffTreatmentNames(names: (string | null | undefined)[]): {
  diffs: string[];
  shared: string[];
} {
  const split = names.map((n) =>
    (n || "")
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean),
  );
  if (split.length <= 1) {
    return { diffs: names.map((n) => n || ""), shared: [] };
  }
  const maxLen = Math.max(...split.map((s) => s.length));
  const sharedIdx = new Set<number>();
  const shared: string[] = [];
  for (let i = 0; i < maxLen; i++) {
    const first = split[0][i];
    if (first == null) continue;
    if (split.every((s) => s[i] === first)) {
      sharedIdx.add(i);
      shared.push(first);
    }
  }
  const diffs = split.map((tokens, idx) => {
    const kept = tokens.filter((_, i) => !sharedIdx.has(i));
    if (kept.length === 0) return names[idx] || ""; // fully identical → fall back
    return kept.join(" | ");
  });
  return { diffs, shared };
}
