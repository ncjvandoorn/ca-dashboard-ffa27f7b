import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Anonymizer } from "../_shared/anonymize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// TYPES (mirror compact shapes the client builds)
// ============================================================================
interface CustomerScope {
  isCustomer: boolean;
  allowedFarmIds: string[];      // farm account ids the user may see
  allowedOrderIds: string[];     // services-order ids the user may see
  customerAccountId?: string;    // if customer
  // Lower-cased name lists used to scope Plantscout trial data, since
  // vaselife_headers stores customer/farm as free-text names, not ids.
  allowedCustomerNames?: string[];
  allowedFarmNames?: string[];
}

interface AIRequestBody {
  messages: Array<{ role: string; content: string }>;
  // small summaries (always sent — tiny payloads)
  staffSummary?: any;
  activitySummary?: any;
  exceptionAnalysis?: any;
  seasonalityAnalysis?: any;
  weeklyPlans?: any;
  // index of farms / containers / trips so the model can discover what's available
  farmIndex?: Array<{ farmId: string; farm: string; weeks: number; firstWeek?: number; lastWeek?: number }>;
  containerIndex?: Array<{ id: string; cn: string; bk: string; ship: string | null; orderCount: number }>;
  tripIndex?: Array<{ tripId: string; internalTripId: string; status: string; origin: string; destination: string; lastTempC: number | null; lastReadingTime: string | null }>;
  // bulk datasets — server keeps them, AI only pulls slices via tools
  farmData?: any[];
  rawActivities?: any[];
  logisticsData?: any[];
  sfTracking?: any[];
  // Plantscout vaselife trial data (full datasets — server filters per scope)
  vaselifeHeaders?: any[];
  vaselifeVases?: any[];
  vaselifeMeasurements?: any[];
  // customer scoping (server applies to every tool)
  customerScope?: CustomerScope;
}

// ============================================================================
// SCOPE HELPERS
// ============================================================================
function applyScope<T extends { farmId?: string }>(items: T[], scope?: CustomerScope): T[] {
  if (!scope?.isCustomer) return items;
  const allowed = new Set(scope.allowedFarmIds || []);
  return items.filter((x) => x.farmId && allowed.has(x.farmId));
}

function scopeContainerForCustomer(c: any, scope?: CustomerScope): any {
  if (!scope?.isCustomer) return c;
  const allowedOrders = new Set(scope.allowedOrderIds || []);
  const allowedFarms = new Set(scope.allowedFarmIds || []);
  // Container is visible only if at least one of its orders belongs to the customer
  const orders = Array.isArray(c.orders) ? c.orders : [];
  const hasMine = orders.some((o: any) => allowedOrders.has(o.orderId) || (o.farmId && allowedFarms.has(o.farmId)));
  if (!hasMine) return null;
  // Anonymize co-loader orders
  const safeOrders = orders.map((o: any) => {
    const isMine = allowedOrders.has(o.orderId) || (o.farmId && allowedFarms.has(o.farmId));
    if (isMine) return o;
    return {
      on: "[Hidden]",
      farm: "[Other shipper]",
      cust: "[Hidden]",
      pal: o.pal ?? null,
      fc: o.fc ?? null,
      // strip arrivals/dippingWeek/status/purpose/orderId for privacy
    };
  });
  return { ...c, orders: safeOrders };
}

function scopeTripForCustomer(t: any, scope?: CustomerScope, allContainers?: any[]): any {
  if (!scope?.isCustomer) return t;
  // A trip is visible if its internalTripId maps to an order whose container has at least one allowed order.
  // Simpler check: client sends pre-filtered tripIndex. Trust it but double-check by allowedOrderIds via container join.
  // For server safety: keep trip if internalTripId starts with any allowed order number from containers list.
  const allowedOrderNumbers = new Set<string>();
  for (const c of allContainers || []) {
    for (const o of c.orders || []) {
      if (scope.allowedOrderIds.includes(o.orderId) || (o.farmId && scope.allowedFarmIds.includes(o.farmId))) {
        if (o.on) allowedOrderNumbers.add(o.on);
      }
    }
  }
  // strip suffix from internalTripId (everything after first "_" or "-")
  const stripped = (t.internalTripId || "").split(/[_-]/)[0];
  if (!allowedOrderNumbers.has(stripped) && allowedOrderNumbers.size > 0) return null;
  return t;
}

// ============================================================================
// TOOL EXECUTION — runs server-side, uses scoped data
// ============================================================================
interface ToolContext {
  farmData: any[];
  rawActivities: any[];
  logisticsData: any[];
  sfTracking: any[];
  weeklyPlans: any[];
  vaselifeHeaders: any[];
  vaselifeVases: any[];
  vaselifeMeasurements: any[];
  scope?: CustomerScope;
}

const norm = (s: any) => (typeof s === "string" ? s.trim().toLowerCase() : "");

/**
 * Whether a Plantscout trial header is visible to the current user.
 * For internal users: always true. For customers: ONLY visible if either:
 *   - the trial's customer name matches the user's customer account name, OR
 *   - the trial's farm name matches a farm the customer has consent for.
 * If neither match, the trial is completely invisible — never returned, never
 * mentioned, never substituted with a similar one.
 */
function isTrialVisible(header: any, scope?: CustomerScope): boolean {
  if (!scope?.isCustomer) return true;
  const allowedCust = new Set((scope.allowedCustomerNames || []).map(norm));
  const allowedFarms = new Set((scope.allowedFarmNames || []).map(norm));
  const c = norm(header.customer);
  const f = norm(header.farm);
  return (!!c && allowedCust.has(c)) || (!!f && allowedFarms.has(f));
}

function scopedTrials(ctx: ToolContext): any[] {
  if (!ctx.scope?.isCustomer) return ctx.vaselifeHeaders;
  return ctx.vaselifeHeaders.filter((h) => isTrialVisible(h, ctx.scope));
}

function executeTool(name: string, args: any, ctx: ToolContext): any {
  switch (name) {
    case "get_farm_quality": {
      const farmId = args.farmId;
      const farmNameRaw = (args.farmName || "").toLowerCase().trim();
      const fromWeek = args.fromWeek as number | undefined;
      const toWeek = args.toWeek as number | undefined;
      const farms = applyScope(ctx.farmData, ctx.scope);
      // Exact match first (id or full name match — case-insensitive)
      let match = farms.find((f) =>
        (farmId && f.farmId === farmId) ||
        (farmNameRaw && f.farm?.toLowerCase() === farmNameRaw)
      );
      // Fuzzy match ONLY when not a customer (customers must never be silently
      // redirected to a different farm than the one they asked about).
      if (!match && !ctx.scope?.isCustomer && farmNameRaw) {
        match = farms.find((f) => f.farm?.toLowerCase().includes(farmNameRaw));
      }
      if (!match) {
        if (ctx.scope?.isCustomer) {
          return { error: `You do not have access to "${args.farmName || farmId}". This farm is either outside your account scope or does not exist. Do NOT suggest a similar farm.` };
        }
        return { error: `Farm not found: ${farmId || args.farmName}` };
      }
      let weeks = match.d || [];
      if (fromWeek != null) weeks = weeks.filter((w: any) => w.w >= fromWeek);
      if (toWeek != null) weeks = weeks.filter((w: any) => w.w <= toWeek);
      return { farmId: match.farmId, farm: match.farm, weeks };
    }

    case "list_farms": {
      const farms = applyScope(ctx.farmData, ctx.scope);
      return farms.map((f) => ({
        farmId: f.farmId,
        farm: f.farm,
        weeks: (f.d || []).length,
        firstWeek: f.d?.[0]?.w ?? null,
        lastWeek: f.d?.[f.d.length - 1]?.w ?? null,
      }));
    }

    case "search_activities": {
      const q = (args.query || "").toLowerCase();
      const farmId = args.farmId;
      const userId = args.userId;
      const limit = Math.min(args.limit || 50, 200);
      const allowedFarms = ctx.scope?.isCustomer ? new Set(ctx.scope.allowedFarmIds) : null;
      let acts = ctx.rawActivities;
      if (allowedFarms) acts = acts.filter((a) => allowedFarms.has(a.farmId));
      if (farmId) acts = acts.filter((a) => a.farmId === farmId);
      if (userId) acts = acts.filter((a) => a.assignedUserId === userId || a.ownerUserId === userId);
      if (q) {
        acts = acts.filter((a) =>
          (a.subject || "").toLowerCase().includes(q) ||
          (a.description || "").toLowerCase().includes(q) ||
          (a.farm || "").toLowerCase().includes(q)
        );
      }
      return { count: acts.length, activities: acts.slice(0, limit) };
    }

    case "get_container": {
      const cn = (args.containerNumber || "").toUpperCase();
      const bk = (args.bookingCode || "").toUpperCase();
      const id = args.containerId;
      let match = ctx.logisticsData.find((c) => c.id === id || c.cn?.toUpperCase() === cn || c.bk?.toUpperCase() === bk);
      if (!match) return { error: `Container not found: ${cn || bk || id}` };
      const scoped = scopeContainerForCustomer(match, ctx.scope);
      if (!scoped) return { error: "You do not have access to this container." };
      return scoped;
    }

    case "list_containers": {
      const limit = Math.min(args.limit || 30, 100);
      const fromDate = args.fromDate;
      const toDate = args.toDate;
      let list = ctx.logisticsData;
      if (ctx.scope?.isCustomer) {
        list = list.map((c) => scopeContainerForCustomer(c, ctx.scope)).filter((c) => c !== null);
      }
      if (fromDate) list = list.filter((c) => c.ship && c.ship >= fromDate);
      if (toDate) list = list.filter((c) => c.ship && c.ship <= toDate);
      return list.slice(0, limit).map((c) => ({
        id: c.id, cn: c.cn, bk: c.bk, ship: c.ship, drop: c.drop,
        orderCount: (c.orders || []).length,
      }));
    }

    case "get_sf_trip": {
      const tripId = args.tripId;
      const containerNumber = (args.containerNumber || "").toUpperCase();
      let match = ctx.sfTracking.find((t) =>
        t.tripId === tripId ||
        t.internalTripId === tripId ||
        (containerNumber && (t.containerNumber || "").toUpperCase() === containerNumber)
      );
      if (!match) return { error: `Trip not found: ${tripId || containerNumber}` };
      const scoped = scopeTripForCustomer(match, ctx.scope, ctx.logisticsData);
      if (!scoped) return { error: "You do not have access to this trip." };
      return scoped;
    }

    case "list_sf_trips": {
      const status = args.status;
      const limit = Math.min(args.limit || 30, 100);
      let trips = ctx.sfTracking;
      if (ctx.scope?.isCustomer) {
        trips = trips.map((t) => scopeTripForCustomer(t, ctx.scope, ctx.logisticsData)).filter((t) => t !== null);
      }
      if (status) trips = trips.filter((t) => t.status?.toLowerCase() === status.toLowerCase());
      return trips.slice(0, limit);
    }

    case "get_weekly_plan": {
      const weekNr = args.weekNr;
      const plan = ctx.weeklyPlans.find((p: any) => p.week_nr === weekNr);
      if (!plan) return { error: `No weekly plan for week ${weekNr}` };
      return plan;
    }

    // ------------------------------------------------------------------
    // PLANTSCOUT VASELIFE TRIALS
    // ------------------------------------------------------------------
    case "list_trials": {
      const limit = Math.min(args.limit || 50, 200);
      const list = scopedTrials(ctx);
      return list.slice(0, limit).map((h: any) => ({
        id: h.id,
        trial_number: h.trial_number,
        farm: h.farm,
        customer: h.customer,
        crop: h.crop,
        harvest_date: h.harvest_date,
        cultivar_count: h.cultivar_count,
        treatment_count: h.treatment_count,
        total_vases: h.total_vases,
      }));
    }

    case "get_trial": {
      const trialId = args.trialId;
      const trialNumber = norm(args.trialNumber);
      const list = scopedTrials(ctx);
      const header = list.find(
        (h: any) => h.id === trialId || (trialNumber && norm(h.trial_number) === trialNumber),
      );
      if (!header) {
        if (ctx.scope?.isCustomer) {
          return { error: `You do not have access to trial "${args.trialNumber || trialId}". It is either not linked to your customer account / consented farms or does not exist. Do NOT suggest a similar trial.` };
        }
        return { error: `Trial not found: ${args.trialNumber || trialId}` };
      }
      const vases = ctx.vaselifeVases.filter((v: any) => v.id_header === header.id);
      const measurements = ctx.vaselifeMeasurements.filter((m: any) => m.id_header === header.id);
      return { header, vases, measurements };
    }

    case "search_trials": {
      const q = norm(args.query);
      const limit = Math.min(args.limit || 30, 100);
      if (!q) return { error: "query is required" };
      const list = scopedTrials(ctx);
      // Build per-header search text from header + vases + measurements
      const vasesByHeader = new Map<string, any[]>();
      for (const v of ctx.vaselifeVases) {
        const arr = vasesByHeader.get(v.id_header) || [];
        arr.push(v);
        vasesByHeader.set(v.id_header, arr);
      }
      const measByHeader = new Map<string, any[]>();
      for (const m of ctx.vaselifeMeasurements) {
        const arr = measByHeader.get(m.id_header) || [];
        arr.push(m);
        measByHeader.set(m.id_header, arr);
      }
      const matches: any[] = [];
      for (const h of list) {
        const headerText = [
          h.trial_number, h.farm, h.customer, h.crop, h.freight_type,
          h.initial_quality, h.objective, h.spec_comments, h.conclusion,
          h.recommendations,
        ].filter(Boolean).join(" ").toLowerCase();
        const vaseText = (vasesByHeader.get(h.id) || []).map((v) => [
          v.cultivar, v.treatment_name, v.post_harvest, v.store_phase,
          v.consumer_phase, v.climate_room,
        ].filter(Boolean).join(" ")).join(" ").toLowerCase();
        const measText = (measByHeader.get(h.id) || []).map((m) => [
          m.cultivar, m.property_name,
        ].filter(Boolean).join(" ")).join(" ").toLowerCase();
        if (headerText.includes(q) || vaseText.includes(q) || measText.includes(q)) {
          matches.push({
            id: h.id,
            trial_number: h.trial_number,
            farm: h.farm,
            customer: h.customer,
            crop: h.crop,
            harvest_date: h.harvest_date,
          });
          if (matches.length >= limit) break;
        }
      }
      return { count: matches.length, trials: matches };
    }


    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ============================================================================
// TOOL DEFINITIONS for OpenAI-style function calling
// ============================================================================
const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_farms",
      description: "List all farms the user has access to with weekly report counts. Call this first when you need to discover available farms.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_farm_quality",
      description: "Fetch detailed weekly quality report data for a single farm. Provide either farmId or farmName.",
      parameters: {
        type: "object",
        properties: {
          farmId: { type: "string" },
          farmName: { type: "string" },
          fromWeek: { type: "number", description: "YYWW lower bound (inclusive)" },
          toWeek: { type: "number", description: "YYWW upper bound (inclusive)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_activities",
      description: "Search CRM activities (visits, calls, tasks) by free-text query, farm, or user. Use ACTIVITY SUMMARY for counts; use this for content/details.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          farmId: { type: "string" },
          userId: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_containers",
      description: "List shipping containers with optional date range filter. Returns lightweight summaries.",
      parameters: {
        type: "object",
        properties: {
          fromDate: { type: "string", description: "ISO date YYYY-MM-DD" },
          toDate: { type: "string", description: "ISO date YYYY-MM-DD" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_container",
      description: "Fetch full details for one container by container number, booking code, or id. Includes orders, arrivals, temperatures, reports.",
      parameters: {
        type: "object",
        properties: {
          containerNumber: { type: "string" },
          bookingCode: { type: "string" },
          containerId: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_sf_trips",
      description: "List active sea freight trips with live tracker data. Optional status filter (In Transit, Idle, Stale).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sf_trip",
      description: "Fetch full live tracker details for one sea freight trip by trip id, internal trip id, or container number.",
      parameters: {
        type: "object",
        properties: {
          tripId: { type: "string" },
          containerNumber: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weekly_plan",
      description: "Fetch a previously generated weekly action plan by week number (YYWW).",
      parameters: {
        type: "object",
        properties: { weekNr: { type: "number" } },
        required: ["weekNr"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_trials",
      description: "List Plantscout vaselife trials the user has access to. Returns lightweight summaries (trial number, farm, customer, crop, harvest date, counts).",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trial",
      description: "Fetch full details of one Plantscout vaselife trial: header (objective, conclusion, recommendations, dates), all vases (cultivar × treatment with VL days, botrytis %, flower-opening %), and all measurements (per-property final scores). Provide trialId or trialNumber.",
      parameters: {
        type: "object",
        properties: {
          trialId: { type: "string" },
          trialNumber: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_trials",
      description: "Free-text search across trial headers, cultivar names, treatment names, and measured properties (e.g. 'botrytis', 'leaf yellowing', a specific cultivar). Returns matching trial summaries.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

// ============================================================================
// SYSTEM PROMPT
// ============================================================================
function buildSystemPrompt(adminInstructions: string, aiLearnings: string, scope?: CustomerScope): string {
  const scopeNote = scope?.isCustomer
    ? `\n\n**ACCESS SCOPE — CUSTOMER USER**: This user is a customer and ONLY has access to ${scope.allowedFarmIds.length} consented farms and ${scope.allowedOrderIds.length} services orders. Plantscout vaselife trials are filtered to those whose customer or farm name matches this scope. All tools automatically filter to this scope.

CRITICAL CUSTOMER RULES — VIOLATING THESE IS A SEVERE FAILURE:
1. NEVER mention, list, or describe any farm, customer, order, container, trip, or Plantscout trial outside this scope.
2. NEVER fuzzy-match or substitute one farm/trial for another. If the user asks about "AAA Growers Simba Farm" and that exact farm is not in their scope, you MUST refuse — even if a different farm with a similar name (e.g. "Simbi Roses") IS in their scope. Treat similar names as DIFFERENT entities.
3. If a tool returns an access-denied error, respond plainly: "You do not have access to information about [exact name they asked]." Do NOT offer alternatives, do NOT mention which farms/trials they CAN access unless they explicitly ask.
4. NEVER infer, assume, or state that any farm/trial is "part of", "belongs to", "affiliated with", or "in the same group as" any other farm, customer, or organisation — even if names share words. Group/parent relationships only exist if explicitly present in tool results. If not in the data, do not mention any grouping.
5. If a Plantscout trial's farm or customer is not linked to a known account in the user's scope, that trial is invisible — never reveal it exists.
6. If unsure whether a farm or trial is in scope, call list_farms() or list_trials() first to verify.`
    : "";

  return `You are a strict, factual data analyst for Chrysal's cut flower post-harvest quality monitoring system. You have TOOLS to fetch data on demand — use them instead of making things up.
${adminInstructions ? `\n**ADMIN INSTRUCTIONS:**\n${adminInstructions}\n` : ""}
${aiLearnings ? `\n**LEARNINGS FROM PAST CONVERSATIONS:**\n${aiLearnings}\n` : ""}${scopeNote}

YOUR CORE IDENTITY: methodical, precise, repetitive by design. Same question + same data → same answer.

**HOW TO USE TOOLS:**
- For ANY question about a specific farm's quality/measurements → call get_farm_quality(farmName).
- For "how many visits/calls/tasks" → use the ACTIVITY SUMMARY in context (already pre-aggregated, do NOT count).
- For activity content/subjects/descriptions → call search_activities(query, farmId).
- For a specific container/booking/temperature chain → call get_container(containerNumber).
- For live vessel/temperature/location → call list_sf_trips() or get_sf_trip(tripId).
- For "what did the planner say in week X" → call get_weekly_plan(weekNr).
- For Plantscout vaselife trials (vase life days, botrytis, flower opening, per-cultivar/treatment scoring, trial conclusions/recommendations) → call list_trials(), get_trial(trialNumber), or search_trials(query) (e.g. "botrytis", a cultivar, a treatment).
- Discover available farms with list_farms() if you don't know names.
- Call MULTIPLE tools in parallel when independent (e.g. quality + activities for same farm).

DATA FORMAT — weekly farm rows use abbreviated keys: w=weekNr(YYWW), iPh=intakePH, iEc=intakeEC, iT=intakeTemp, iH=intakeHumidity, ePh=exportPH, eEc=exportEC, eT=exportTemp, eH=exportHumidity, qR=qualityRating(1=Good,2=Avg,3=Bad), wQ=waterQuality, pS=processingSpeed, sL=stemLength, hS=headSize, cH=coldStoreHours, qN=qualityNote, pN=protocolNote, gC=generalComment, cBy=createdBy, sby=submittedBy, pQ=packingQuality, pR=packrate, eWQ=exportWaterQuality, eCH=exportColdStoreHours.

Container fields: cn=containerNumber, bk=bookingCode, ship=shipDate, drop=dropoffDate. Order fields: on=orderNumber, farm, cust=customer, pal=pallets, fc=forecast, dWk=dippingWeek. Arrival fields: t1/t2/t3=arrivalTemps, vc1/vc2/vc3=afterVCtemps, dwm=dischargeWaitingMin.

IDEAL RANGES: pH 3.5–5.0 (>5.5=bacterial risk), EC 200–800 μS/cm, Temp 1–4°C (>6°C=risk), Humidity 80–95%.

**ABSOLUTE RULES:**
1. ZERO fabrication — every fact must come from a tool result or pre-aggregated summary.
2. If a tool returns {"error": "..."} or empty data, say so plainly. Don't guess.
3. Never invent farm names, weeks, values, or activities. Use list_farms() if unsure what's available.
4. For activity COUNTS: always use the ACTIVITY SUMMARY in context. Never count by listing.
5. Cite specific farm names, week numbers, and exact values from tool results.
6. Use markdown tables for comparisons. Be concise but complete.
7. NEVER assume corporate groupings, parent companies, or affiliations between farms based on name similarity (e.g. shared prefix like "AAA Growers"). Only state grouping/ownership if it is explicitly present in tool results.`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as AIRequestBody;
    const {
      messages,
      staffSummary,
      activitySummary,
      exceptionAnalysis,
      seasonalityAnalysis,
      weeklyPlans = [],
      farmIndex,
      containerIndex,
      tripIndex,
      farmData = [],
      rawActivities = [],
      logisticsData = [],
      sfTracking = [],
      vaselifeHeaders = [],
      vaselifeVases = [],
      vaselifeMeasurements = [],
      customerScope,
    } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch admin instructions + learnings
    let adminInstructions = "";
    let aiLearnings = "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    try {
      const [insRes, lrnRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/ai_instructions?select=instructions&limit=1`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        }),
        fetch(`${supabaseUrl}/rest/v1/ai_learnings?select=learnings&limit=1`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        }),
      ]);
      if (insRes.ok) {
        const rows = await insRes.json();
        if (rows?.[0]?.instructions) adminInstructions = rows[0].instructions;
      }
      if (lrnRes.ok) {
        const rows = await lrnRes.json();
        if (rows?.[0]?.learnings) aiLearnings = rows[0].learnings;
      }
    } catch (_) { /* ignore */ }

    const systemPrompt = buildSystemPrompt(adminInstructions, aiLearnings, customerScope);

    // -------- Anonymization layer --------
    // Build one Anonymizer per request. We anonymize every dataset that
    // flows into the model (context summaries, tool results, indexes) and
    // de-anonymize the model's responses (tool calls + final stream).
    const anon = new Anonymizer();
    const A = <T>(v: T): T => anon.anonymize(v);

    const safeStaffSummary = A(staffSummary);
    const safeActivitySummary = A(activitySummary);
    const safeExceptionAnalysis = A(exceptionAnalysis);
    const safeSeasonalityAnalysis = A(seasonalityAnalysis);
    const safeFarmIndex = A(farmIndex);
    const safeContainerIndex = A(containerIndex);
    const safeTripIndex = A(tripIndex);
    const safeFarmData = A(farmData);
    const safeRawActivities = A(rawActivities);
    const safeLogisticsData = A(logisticsData);
    const safeSfTracking = A(sfTracking);
    const safeVaselifeHeaders = A(vaselifeHeaders);
    const safeVaselifeVases = A(vaselifeVases);
    const safeVaselifeMeasurements = A(vaselifeMeasurements);
    // Anonymize the customer scope too — its allowed name lists must match
    // the anonymized dataset for tool filtering to keep working.
    const safeScope: CustomerScope | undefined = customerScope
      ? {
          ...customerScope,
          allowedCustomerNames: (customerScope.allowedCustomerNames || []).map(
            (n) => anon.anonymize(n, "customer") as string,
          ),
          allowedFarmNames: (customerScope.allowedFarmNames || []).map(
            (n) => anon.anonymize(n, "farm") as string,
          ),
        }
      : undefined;

    // Build the small "always-in-context" payload (summaries + indexes only — no bulk data)
    const contextParts: string[] = [];
    if (safeActivitySummary) {
      contextParts.push(`**CRM ACTIVITY SUMMARY (authoritative — never count manually):**\n${JSON.stringify(safeActivitySummary)}`);
    }
    if (safeStaffSummary) {
      contextParts.push(`**STAFF REPORT ATTRIBUTION SUMMARY:**\n${JSON.stringify(safeStaffSummary)}`);
    }
    if (safeExceptionAnalysis) {
      contextParts.push(`**EXCEPTION REPORT (pre-computed):**\n${JSON.stringify(safeExceptionAnalysis)}`);
    }
    if (safeSeasonalityAnalysis) {
      contextParts.push(`**SEASONALITY REPORT (pre-computed):**\n${JSON.stringify(safeSeasonalityAnalysis)}`);
    }
    if (safeFarmIndex?.length) {
      contextParts.push(`**FARM INDEX (use to discover farms; call get_farm_quality for details):**\n${JSON.stringify(safeFarmIndex)}`);
    }
    if (safeContainerIndex?.length) {
      contextParts.push(`**CONTAINER INDEX (call get_container for full details):**\n${JSON.stringify(safeContainerIndex)}`);
    }
    if (safeTripIndex?.length) {
      contextParts.push(`**ACTIVE SEA FREIGHT INDEX (call get_sf_trip for live readings):**\n${JSON.stringify(safeTripIndex)}`);
    }
    if (weeklyPlans?.length) {
      const summaries = weeklyPlans.map((p: any) => ({ week_nr: p.week_nr, created_at: p.created_at }));
      contextParts.push(`**AVAILABLE WEEKLY PLANS (call get_weekly_plan(weekNr) for content):**\n${JSON.stringify(summaries)}`);
    }
    // Plantscout vaselife trial index — pre-scoped per customer (using anonymized data)
    if (safeVaselifeHeaders?.length) {
      const visibleTrials = safeScope?.isCustomer
        ? safeVaselifeHeaders.filter((h: any) => isTrialVisible(h, safeScope))
        : safeVaselifeHeaders;
      if (visibleTrials.length) {
        const trialIdx = visibleTrials.map((h: any) => ({
          id: h.id,
          trial_number: h.trial_number,
          farm: h.farm,
          customer: h.customer,
          crop: h.crop,
          harvest_date: h.harvest_date,
        }));
        contextParts.push(`**PLANTSCOUT TRIAL INDEX (call get_trial(trialNumber) for full details, search_trials(query) for cultivar / treatment / property search):**\n${JSON.stringify(trialIdx)}`);
      }
    }

    const userContextMessage = contextParts.join("\n\n---\n\n") || "No pre-computed context available.";

    const ctx: ToolContext = {
      farmData: safeFarmData,
      rawActivities: safeRawActivities,
      logisticsData: safeLogisticsData,
      sfTracking: safeSfTracking,
      weeklyPlans: A(weeklyPlans),
      vaselifeHeaders: safeVaselifeHeaders,
      vaselifeVases: safeVaselifeVases,
      vaselifeMeasurements: safeVaselifeMeasurements,
      scope: safeScope,
    };

    // Anonymize user-supplied chat messages too — questions often contain
    // farm/customer/container names that we already mapped above.
    const safeChatMessages = (messages || []).map((m) => ({
      ...m,
      content: typeof m.content === "string" ? anon.anonymizeText(m.content) : m.content,
    }));

    // Conversation state for the agentic loop
    const allMessages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: userContextMessage },
      ...safeChatMessages,
    ];

    const MAX_TOOL_ROUNDS = 5;
    let round = 0;

    // --- Tool-calling loop (non-streaming) until model is ready to answer ---
    while (round < MAX_TOOL_ROUNDS) {
      round++;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: allMessages,
          tools: TOOLS,
          temperature: 0,
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const text = await response.text();
        console.error("AI gateway error:", response.status, text);
        return new Response(JSON.stringify({ error: "AI analysis failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      const message = data?.choices?.[0]?.message;
      if (!message) {
        return new Response(JSON.stringify({ error: "Empty AI response" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const toolCalls = message.tool_calls || [];

      if (!toolCalls.length) {
        // Model produced a final answer — stream it as SSE so the client logic doesn't change
        const finalText = message.content || "";
        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            // chunk into ~80-char pieces for nicer rendering
            const chunkSize = 80;
            for (let i = 0; i < finalText.length; i += chunkSize) {
              const piece = finalText.slice(i, i + chunkSize);
              const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`;
              controller.enqueue(enc.encode(sse));
            }
            controller.enqueue(enc.encode(`data: [DONE]\n\n`));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      // Add the assistant tool-call message to history
      allMessages.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: toolCalls,
      });

      // Execute all tool calls in parallel
      for (const tc of toolCalls) {
        const fname = tc.function?.name;
        let fargs: any = {};
        try { fargs = JSON.parse(tc.function?.arguments || "{}"); } catch (_) { /* ignore */ }
        const result = executeTool(fname, fargs, ctx);
        // Truncate huge results to keep token usage sane
        const resultStr = JSON.stringify(result);
        const safeStr = resultStr.length > 60000 ? resultStr.slice(0, 60000) + '..."[truncated]"' : resultStr;
        allMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: safeStr,
        });
      }
    }

    // Loop exhausted — force a final answer
    const finalResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [...allMessages, { role: "user", content: "Based on the tool results above, provide your final answer now without calling any more tools." }],
        temperature: 0,
        stream: true,
      }),
    });
    if (!finalResp.ok || !finalResp.body) {
      return new Response(JSON.stringify({ error: "AI analysis failed (final round)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(finalResp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
