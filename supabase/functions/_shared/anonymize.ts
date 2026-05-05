// Shared anonymization helper for AI edge functions.
//
// Goal: never send raw identifying strings (farm names, customer names,
// user full names, emails, container/booking numbers, trial numbers,
// vessel names, addresses) to the Lovable AI Gateway. We replace them
// with stable pseudonyms per request, ship the anonymized payload,
// then re-hydrate the model's response so the human-facing output keeps
// the original names.
//
// Strategy:
//  - Walk any value (object/array/scalar). For string fields whose KEY
//    matches our sensitivity list, generate a stable token like
//    "Farm_007" or "Customer_A3" and remember the mapping.
//  - Identical values map to the same token (bijective per request).
//  - After the AI responds, run a global string-replace pass to swap
//    each token back to its original value.
//
// This is intentionally conservative: we anonymize KEYS we know carry
// PII / business-identifying values. We do NOT scan free-text bodies
// for names — that would be unreliable. Free-text fields (objective,
// conclusion, recommendations, notes, descriptions) are still sent
// because removing them would defeat the AI's usefulness; if you need
// to redact those too, set `redactFreeText: true`.

export interface AnonymizeOptions {
  /** Replace free-text content (descriptions, notes) with "[redacted]". */
  redactFreeText?: boolean;
  /** Extra key names to treat as identifying. */
  extraKeys?: string[];
}

// Keys whose string value we replace with a pseudonym.
const DEFAULT_SENSITIVE_KEYS = new Set<string>([
  // Farms / customers
  "farm", "farm_name", "farmName",
  "customer", "customer_name", "customerName", "customer_account_id",
  // People
  "user", "username", "user_name", "userName", "userFullName", "fullName",
  "createdByUserName", "ownerUserName", "assignedUserName", "signoffName",
  "approvedByUsername", "submittedByUserName", "updatedByUserName",
  "created_by_username",
  "email", "user_email", "contact_email", "contactEmail", "manager_email",
  // Logistics identifiers
  "containerNumber", "container_number", "cn",
  "bookingCode", "booking_code", "bk",
  "vessel", "vesselName", "vessel_name",
  "trailer_id", "trailerId",
  "trip_id", "tripId", "internalTripId", "internal_trip_id", "trip_guid",
  // Plantscout trials
  "trial_number", "trialNumber",
  // Locations
  "address", "last_address", "city", "destination", "origin",
  // Companies
  "company_name", "companyName",
]);

// Keys to redact entirely (replace with "[redacted]") only when
// `redactFreeText` is set. Default behaviour KEEPS these so AI output is useful.
const DEFAULT_FREE_TEXT_KEYS = new Set<string>([
  "description", "subject", "notes", "note",
  "objective", "spec_comments", "conclusion", "recommendations",
  "comments", "comment",
]);

interface Bucket {
  prefix: string;
  counter: number;
  fwd: Map<string, string>; // raw -> token
}

export class Anonymizer {
  private buckets = new Map<string, Bucket>();
  private reverse = new Map<string, string>(); // token -> raw
  private opts: AnonymizeOptions;
  private sensitive: Set<string>;

  constructor(opts: AnonymizeOptions = {}) {
    this.opts = opts;
    this.sensitive = new Set([
      ...Array.from(DEFAULT_SENSITIVE_KEYS),
      ...(opts.extraKeys || []),
    ]);
  }

  /** Token -> raw lookup, used for de-anonymizing AI responses. */
  get reverseMap(): Map<string, string> {
    return this.reverse;
  }

  private prefixForKey(key: string): string {
    const k = key.toLowerCase();
    if (k.includes("email")) return "Email";
    if (k.includes("farm")) return "Farm";
    if (k.includes("customer") || k.includes("company")) return "Customer";
    if (k.includes("user") || k.includes("owner") || k.includes("assigned") || k.includes("created_by") || k.includes("submitted") || k.includes("signoff") || k.includes("approved")) return "User";
    if (k.includes("container") || k === "cn") return "CNTR";
    if (k.includes("booking") || k === "bk") return "BK";
    if (k.includes("vessel")) return "Vessel";
    if (k.includes("trip") || k.includes("trailer")) return "Trip";
    if (k.includes("trial")) return "Trial";
    if (k.includes("address") || k.includes("city") || k.includes("destination") || k.includes("origin")) return "Loc";
    return "Val";
  }

  private tokenize(key: string, raw: string): string {
    const prefix = this.prefixForKey(key);
    let bucket = this.buckets.get(prefix);
    if (!bucket) {
      bucket = { prefix, counter: 0, fwd: new Map() };
      this.buckets.set(prefix, bucket);
    }
    const existing = bucket.fwd.get(raw);
    if (existing) return existing;
    bucket.counter += 1;
    const token = `${prefix}_${String(bucket.counter).padStart(3, "0")}`;
    bucket.fwd.set(raw, token);
    this.reverse.set(token, raw);
    return token;
  }

  /** Recursively anonymize a value. Returns a NEW deep-cloned structure. */
  anonymize<T>(value: T, parentKey?: string): T {
    if (value == null) return value;
    if (typeof value === "string") {
      if (parentKey && this.sensitive.has(parentKey)) {
        return this.tokenize(parentKey, value) as unknown as T;
      }
      if (this.opts.redactFreeText && parentKey && DEFAULT_FREE_TEXT_KEYS.has(parentKey)) {
        return "[redacted]" as unknown as T;
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.anonymize(v, parentKey)) as unknown as T;
    }
    if (typeof value === "object") {
      const out: any = {};
      for (const [k, v] of Object.entries(value as any)) {
        out[k] = this.anonymize(v, k);
      }
      return out;
    }
    return value;
  }

  /**
   * Replace tokens in a string back to their original values.
   * Use this on the AI's response text before storing/returning to the user.
   */
  deanonymize(text: string): string {
    if (!text) return text;
    let out = text;
    // Sort longest-first so "Farm_010" doesn't get partially replaced by "Farm_01".
    const tokens = Array.from(this.reverse.keys()).sort((a, b) => b.length - a.length);
    for (const tok of tokens) {
      const raw = this.reverse.get(tok)!;
      // Global, no-regex replace (token format has no regex meta-chars).
      out = out.split(tok).join(raw);
    }
    return out;
  }

  /** Useful for debugging: how many distinct values were anonymized. */
  stats(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [prefix, bucket] of this.buckets) out[prefix] = bucket.counter;
    return out;
  }
}
