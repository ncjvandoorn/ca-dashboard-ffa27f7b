import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, AlertCircle, ArrowLeft, Bot, ClipboardCheck, FileText, Container as ContainerIcon, GitCompare, CalendarDays, ChevronDown, ChevronRight, Thermometer, Sun, Droplets, MapPin, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import chrysalLogo from "@/assets/chrysal-logo.png";
import { fetchSharedPage, type SharedPageRow } from "@/lib/sharePages";
import { ExceptionReportBody, type ExceptionAnalysis } from "@/components/dashboard/ExceptionReportBody";
import { SeasonalityInsightsBody, type SeasonalityAnalysis } from "@/components/dashboard/SeasonalityInsightsBody";
import { QualityReportBody } from "@/components/dashboard/QualityReportBody";
import { SharedTripMap } from "@/components/dashboard/SharedTripMap";
import { VaselifeTrialReportBody } from "@/components/trials/VaselifeTrialReportBody";
import { Button } from "@/components/ui/button";

export default function SharedPage() {
  const { token } = useParams<{ token: string }>();
  const [row, setRow] = useState<SharedPageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchSharedPage(token);
        if (cancelled) return;
        if (!r) {
          setError("This share link does not exist or has expired.");
        } else if (new Date(r.expires_at).getTime() < Date.now()) {
          setError("This share link has expired.");
        } else {
          setRow(r);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load shared page");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={chrysalLogo} alt="Chrysal" className="h-9 w-auto" />
          </Link>
          <span className="text-xs text-muted-foreground">
            Shared snapshot {row?.created_by_username ? `· by ${row.created_by_username}` : ""}
            {row?.expires_at && ` · expires ${new Date(row.expires_at).toLocaleDateString()}`}
          </span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading shared page…</span>
          </div>
        )}
        {error && (
          <div className="max-w-md mx-auto mt-12 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-foreground">{error}</p>
            <Link to="/" className="inline-flex items-center gap-2 text-xs text-primary mt-4">
              <ArrowLeft className="h-3 w-3" /> Back to app
            </Link>
          </div>
        )}
        {row && !loading && !error && <SharedRenderer row={row} />}
      </main>
    </div>
  );
}

function SharedRenderer({ row }: { row: SharedPageRow }) {
  const payload = row.payload as any;

  if (row.page_type === "exception_report") {
    const analysis = payload?.analysis as ExceptionAnalysis | undefined;
    const wr = payload?.weekRange;
    if (!analysis) return <Unsupported />;
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-1">AI Exception Report</h1>
        {wr && <p className="text-sm text-muted-foreground mb-6">Weeks {wr.min}–{wr.max} · post-harvest quality analysis</p>}
        <ExceptionReportBody analysis={analysis} />
      </div>
    );
  }

  if (row.page_type === "seasonality") {
    const analysis = payload?.analysis as SeasonalityAnalysis | undefined;
    const wr = payload?.weekRange;
    if (!analysis) return <Unsupported />;
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-1">Seasonality Insights</h1>
        {wr && <p className="text-sm text-muted-foreground mb-6">Weeks {wr.min}–{wr.max} · weather & pest patterns</p>}
        <SeasonalityInsightsBody analysis={analysis} />
      </div>
    );
  }

  if (row.page_type === "data_loggers") {
    return <SharedDataLoggers payload={payload} />;
  }

  if (row.page_type === "quality_report") {
    const r = payload?.report;
    if (!r) return <Unsupported />;
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">Quality Report</h1>
        </div>
        <QualityReportBody report={r} farmName={payload.farmName || "—"} createdByName={payload.createdByName} />
      </div>
    );
  }

  if (row.page_type === "reporting_check") {
    return <SharedReportingCheck payload={payload} />;
  }

  if (row.page_type === "ai_agent") {
    return <SharedAIAgent payload={payload} />;
  }

  if (row.page_type === "weekly_plan") {
    return <SharedWeeklyPlan payload={payload} />;
  }

  if (row.page_type === "trip_detail") {
    return <SharedTripDetail payload={payload} />;
  }

  if (row.page_type === "container_detail") {
    return <SharedContainerDetail payload={payload} />;
  }

  if (row.page_type === "compare_trips") {
    return <SharedCompareTrips payload={payload} />;
  }

  if (row.page_type === "vaselife_report") {
    return <SharedVaselifeReport payload={payload} />;
  }

  if (row.page_type === "crm_meeting_snapshot") {
    return <SharedCrmMeeting payload={payload} />;
  }

  return <Unsupported />;
}

function Unsupported() {
  return (
    <div className="max-w-md mx-auto mt-12 text-center">
      <p className="text-sm text-muted-foreground">
        This page type is not yet supported in shared view. The owner may need to share again from a newer version.
      </p>
    </div>
  );
}

/* ───────────────────────── Data Loggers ───────────────────────── */

function SharedDataLoggers({ payload }: { payload: any }) {
  const flagged: any[] = payload?.flaggedSeries || [];
  const ruleCounts: Record<string, number> = payload?.ruleCounts || {};
  const generatedAt = payload?.generatedAt;
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Loggers — Exception Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Snapshot of {flagged.length} flagged logger{flagged.length !== 1 ? "s" : ""}
          {generatedAt && ` · captured ${new Date(generatedAt).toLocaleString()}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(ruleCounts).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {k} <span className="font-semibold text-foreground">{v}</span>
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Week</th>
              <th className="text-left px-4 py-2">Order #</th>
              <th className="text-left px-4 py-2">Logger</th>
              <th className="text-left px-4 py-2">Container · Booking</th>
              <th className="text-left px-4 py-2">Customer · Farm</th>
              <th className="text-left px-4 py-2">Exceptions</th>
              <th className="text-left px-4 py-2">Last reading</th>
            </tr>
          </thead>
          <tbody>
            {flagged.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{r.week || "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.orderNumber || "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.serial}</td>
                <td className="px-4 py-2 text-xs">
                  <div className="font-mono">{r.containerNumber || "—"}</div>
                  {r.bookingCode && <div className="text-[10px] text-muted-foreground">{r.bookingCode}</div>}
                </td>
                <td className="px-4 py-2 text-xs">
                  <div>{r.customer || "—"}</div>
                  {r.farm && <div className="text-[10px] text-muted-foreground">{r.farm}</div>}
                </td>
                <td className="px-4 py-2 text-xs">
                  {(r.flags || []).map((f: any) => (
                    <span key={f.rule} className="inline-block rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-medium mr-1 mb-1">
                      {f.rule} · {f.duration}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-2 text-xs whitespace-nowrap text-muted-foreground">
                  {r.lastTime ? new Date(r.lastTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────────────────── Reporting Check ───────────────────────── */

function SharedReportingCheck({ payload }: { payload: any }) {
  const farms: any[] = payload?.farmCompliance || [];
  const avgOverall = payload?.avgOverall ?? 0;
  const poorFarms = payload?.poorFarms ?? 0;
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Reporting Completeness Check</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Avg completeness" value={`${Math.round(avgOverall)}%`} />
        <Stat label="Farms evaluated" value={String(farms.length)} />
        <Stat label="Farms below 50%" value={String(poorFarms)} tone={poorFarms > 0 ? "destructive" : "accent"} />
      </div>
      <div className="space-y-2">
        {farms.map((f) => (
          <div key={f.farmId} className={`rounded-lg border p-4 ${f.overallPct < 50 ? "border-destructive/20 bg-destructive/5" : f.overallPct < 80 ? "border-warning/20 bg-warning/5" : "border-accent/20 bg-accent/5"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{f.farmName}</p>
                {f.managerName && <p className="text-xs text-muted-foreground">{f.managerName} · {f.totalReports} reports</p>}
              </div>
              <span className={`text-sm font-semibold ${f.overallPct >= 80 ? "text-accent" : f.overallPct >= 50 ? "text-warning" : "text-destructive"}`}>
                {Math.round(f.overallPct)}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 text-xs text-muted-foreground">
              <span>Quality notes: <span className="text-foreground">{f.qualityNotesFilled}/{f.totalReports}</span></span>
              <span>Protocol: <span className="text-foreground">{f.protocolNotesFilled}/{f.totalReports}</span></span>
              <span>Comments: <span className="text-foreground">{f.generalCommentFilled}/{f.totalReports}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── AI Agent chat ───────────────────────── */

function SharedAIAgent({ payload }: { payload: any }) {
  const messages: { role: "user" | "assistant"; content: string }[] = payload?.messages || [];
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">AI Quality Agent — Conversation</h1>
      </div>
      <p className="text-xs text-muted-foreground italic">
        AI-generated insights — always verify against source data.
      </p>
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50 border border-border"
            }`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-3 [&_p:last-child]:mb-0 [&_table]:text-xs [&_table]:w-full [&_table]:my-3 [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5 [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border [&_th]:bg-muted/50">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : m.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Weekly Plan ───────────────────────── */

function SharedWeeklyPlan({ payload }: { payload: any }) {
  const plan = payload?.plan;
  const weekLabel = payload?.weekLabel;
  if (!plan) return <Unsupported />;
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Weekly Plan {weekLabel ? `· ${weekLabel}` : ""}</h1>
      </div>
      {plan.summary && (
        <div className="chrysal-gradient-subtle rounded-lg p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{plan.summary}</p>
        </div>
      )}
      {Array.isArray(plan.priorities) && plan.priorities.length > 0 && (
        <Section title="Priorities">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            {plan.priorities.map((p: any, i: number) => (
              <li key={i}>
                <span className="font-medium">{typeof p === "string" ? p : p.title || p.text}</span>
                {typeof p === "object" && p.detail && (
                  <p className="text-xs text-muted-foreground ml-5 mt-1">{p.detail}</p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}
      {Array.isArray(plan.byPerson) && plan.byPerson.length > 0 && (
        <Section title="By Team Member">
          <div className="space-y-3">
            {plan.byPerson.map((p: any, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3">
                <p className="font-medium text-sm">{p.name}</p>
                {Array.isArray(p.tasks) && (
                  <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-0.5">
                    {p.tasks.map((t: any, j: number) => <li key={j}>{typeof t === "string" ? t : t.text || JSON.stringify(t)}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
      {plan.raw && typeof plan.raw === "string" && (
        <Section title="Plan">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.raw}</ReactMarkdown>
          </div>
        </Section>
      )}
    </div>
  );
}

/* ───────────────────────── Trip / Container / Compare ───────────────────────── */

function SharedTripDetail({ payload }: { payload: any }) {
  const t = payload?.trip;
  if (!t) return <Unsupported />;
  const stats = payload?.stats || {};
  const map = payload?.map;
  const readings: any[] = payload?.readings || [];
  const vfRoute = payload?.vfRoute || null;
  const vf = payload?.vfSummary || null;
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Trip {t.tripId}</h1>

      {vf && <VFSummaryCard vf={vf} />}

      {(vfRoute || (map && (map.points?.length || map.destination || (t.latitude != null && t.longitude != null)))) && (
        <div className="rounded-xl border border-border overflow-hidden">
          <SharedTripMap
            points={map?.points || []}
            destination={map?.destination || null}
            current={t.latitude != null && t.longitude != null
              ? { lat: t.latitude, lon: t.longitude, label: t.lastLocation }
              : null}
            vfRoute={vfRoute}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard title="Most Recent">
          {t.lastReadingTime && <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{t.lastReadingTime}</p>}
          {t.isBackfillOnly && (
            <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5">
              <p className="text-[11px] text-warning-foreground/90 leading-tight">
                <span className="font-semibold">Historical data only</span> — no live update since the backfill (last reading: 19 Apr 23:59).
              </p>
            </div>
          )}
          {t.lastLocation && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2"><MapPin className="h-3 w-3" />{t.lastLocation}</p>}
          {t.serialNumber && <p className="text-xs font-mono text-muted-foreground mt-2">({t.serialNumber})</p>}
          <div className="flex gap-6 mt-3">
            <span className="flex items-center gap-1 text-destructive font-bold"><Thermometer className="h-4 w-4" />{t.lastTemp ?? "—"} °C</span>
            <span className="flex items-center gap-1 text-warning font-bold"><Sun className="h-4 w-4" />{t.lastLight ?? "—"} %</span>
            <span className="flex items-center gap-1 text-accent font-bold"><Droplets className="h-4 w-4" />{t.lastHumidity ?? "—"} %</span>
          </div>
        </InfoCard>
        <InfoCard title="Departed from Origin">
          <p className="font-medium text-sm">{t.originName}</p>
          <p className="text-xs text-muted-foreground">{t.originAddress}</p>
          {t.actualDepartureTime && <p className="text-xs text-muted-foreground mt-1">Actual Departure: {t.actualDepartureTime}</p>}
          {t.carrier && <p className="text-xs text-muted-foreground">Carrier: {t.carrier}</p>}
          {t.internalTripId && <p className="text-xs text-muted-foreground">Internal: {t.internalTripId}</p>}
        </InfoCard>
      </div>

      {readings.length > 0 && <Multigraph readings={readings} />}

      {(stats.avgTemp || stats.avgHumidity || stats.maxLight) && (
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Avg Temperature" value={stats.avgTemp ?? "—"} />
          <Stat label="Avg Humidity" value={stats.avgHumidity ?? "—"} />
          <Stat label="Max Light" value={stats.maxLight ?? "—"} />
        </div>
      )}

      {Array.isArray(payload.shipperReports) && payload.shipperReports.length > 0 && (
        <ShipperReportsList reports={payload.shipperReports} />
      )}
      {Array.isArray(payload.orders) && payload.orders.length > 0 && (
        <OrdersList orders={payload.orders} />
      )}
    </div>
  );
}

function SharedContainerDetail({ payload }: { payload: any }) {
  const c = payload?.container;
  if (!c) return <Unsupported />;
  const trips: any[] = payload?.trips || [];
  const map = payload?.map;
  const combined: any[] = payload?.combinedReadings || [];
  const serials: string[] = payload?.serials || [];
  const vfRoute = payload?.vfRoute || null;
  const vf = payload?.vfSummary || null;
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <ContainerIcon className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">{c.containerNumber || c.bookingCode || "Container"}</h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Stat label="Booking" value={c.bookingCode || "—"} />
        <Stat label="Drop-off" value={c.dropoffDate || "—"} />
        <Stat label="Shipping" value={c.shippingDate || "—"} />
        <Stat label="Loggers" value={String(trips.length)} />
      </div>

      {vf && <VFSummaryCard vf={vf} />}

      {(vfRoute || (map && (map.points?.length || map.destination || map.current))) && (
        <div className="rounded-xl border border-border overflow-hidden">
          <SharedTripMap
            points={map?.points || []}
            destination={map?.destination || null}
            current={map?.current || null}
            vfRoute={vfRoute}
          />
        </div>
      )}

      {trips.map((t: any) => (
        <div key={t.tripId} className="rounded-xl border border-border p-4 space-y-2">
          <p className="font-medium text-sm">Trip {t.tripId} {t.serialNumber && <span className="font-mono text-xs text-muted-foreground">({t.serialNumber})</span>}</p>
          {t.originName && <p className="text-xs text-muted-foreground">Origin: {t.originName} {t.originAddress && `· ${t.originAddress}`}</p>}
          {t.actualDepartureTime && <p className="text-xs text-muted-foreground">Departure: {t.actualDepartureTime}{t.carrier && ` · ${t.carrier}`}</p>}
          <div className="flex gap-6 text-sm">
            <span className="flex items-center gap-1 text-destructive"><Thermometer className="h-4 w-4" />{t.lastTemp ?? "—"} °C</span>
            <span className="flex items-center gap-1 text-warning"><Sun className="h-4 w-4" />{t.lastLight ?? "—"} %</span>
            <span className="flex items-center gap-1 text-accent"><Droplets className="h-4 w-4" />{t.lastHumidity ?? "—"} %</span>
          </div>
          {t.lastReadingTime && <p className="text-xs text-muted-foreground">Last reading: {t.lastReadingTime}</p>}
        </div>
      ))}

      {combined.length > 0 && <CombinedMultigraph data={combined} serials={serials} />}

      {Array.isArray(payload.shipperReports) && payload.shipperReports.length > 0 && (
        <ShipperReportsList reports={payload.shipperReports} />
      )}
      {Array.isArray(payload.orders) && payload.orders.length > 0 && (
        <OrdersList orders={payload.orders} />
      )}
    </div>
  );
}

function VFSummaryCard({ vf }: { vf: any }) {
  const fmt = (sec: number | null) => sec
    ? new Date(sec * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
  return (
    <div className="rounded-xl border border-border p-4 bg-card space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">Active Tracking</span>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-accent/10 text-accent">Live</span>
      </div>
      {typeof vf.progress === "number" && (
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{vf.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${vf.progress}%` }} />
          </div>
        </div>
      )}
      <div className="text-xs space-y-1 pt-1">
        {vf.carrier && <div className="text-muted-foreground">Carrier: <span className="text-foreground">{vf.carrier}</span></div>}
        {vf.vesselName && (
          <div className="text-muted-foreground">
            Vessel: <span className="text-foreground">{vf.vesselName}</span>
            {vf.vesselSpeed != null && <span className="text-muted-foreground"> · {vf.vesselSpeed} kn</span>}
          </div>
        )}
        {vf.portName && <div className="text-muted-foreground">At port: <span className="text-foreground">{vf.portName}</span></div>}
        {vf.destinationName && (
          <div className="text-muted-foreground">
            ETA {vf.destinationName}: <span className="text-foreground">{fmt(vf.destinationDate)}</span>
          </div>
        )}
        {vf.updatedAt && <div className="text-[10px] text-muted-foreground pt-1">Updated {fmt(vf.updatedAt)}</div>}
      </div>
    </div>
  );
}

function SharedCompareTrips({ payload }: { payload: any }) {
  const trips: any[] = payload?.trips || [];
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <GitCompare className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Comparing {trips.length} trip{trips.length !== 1 ? "s" : ""}</h1>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Trip</th>
              <th className="text-left px-4 py-2">Container · Booking</th>
              <th className="text-left px-4 py-2">Logger</th>
              <th className="text-left px-4 py-2">Avg Temp</th>
              <th className="text-left px-4 py-2">Avg Humidity</th>
              <th className="text-left px-4 py-2">Origin</th>
              <th className="text-left px-4 py-2">Departure</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t: any) => (
              <tr key={t.tripId} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{t.tripId}</td>
                <td className="px-4 py-2 text-xs">
                  <div className="font-mono">{t.containerNumber || "—"}</div>
                  {t.bookingCode && <div className="text-[10px] text-muted-foreground">{t.bookingCode}</div>}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{t.serialNumber || "—"}</td>
                <td className="px-4 py-2 text-xs">{t.avgTemp ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{t.avgHumidity ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{t.originName || "—"}</td>
                <td className="px-4 py-2 text-xs">{t.actualDepartureTime || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Multigraph({ readings }: { readings: any[] }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-semibold text-sm mb-3">Multigraph</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={readings} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(readings.length / 6))} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="temp" name="Temperature (°C)" stroke="hsl(207, 100%, 35%)" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="hsl(90, 67%, 41%)" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="light" name="Light (%)" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const LOGGER_COLORS = [
  { temp: "hsl(207, 100%, 35%)", humidity: "hsl(90, 67%, 41%)", light: "hsl(38, 92%, 50%)" },
  { temp: "hsl(340, 75%, 45%)", humidity: "hsl(170, 70%, 38%)", light: "hsl(20, 90%, 55%)" },
  { temp: "hsl(265, 65%, 50%)", humidity: "hsl(195, 75%, 42%)", light: "hsl(55, 90%, 50%)" },
  { temp: "hsl(0, 70%, 45%)", humidity: "hsl(140, 60%, 40%)", light: "hsl(45, 95%, 52%)" },
];

function CombinedMultigraph({ data, serials }: { data: any[]; serials: string[] }) {
  const isMulti = serials.length > 1;
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-semibold text-sm mb-3">
        Multigraph
        {isMulti && <span className="ml-2 text-xs font-normal text-muted-foreground">({serials.length} loggers combined)</span>}
      </h3>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(data.length / 6))} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {serials.flatMap((sn, i) => {
              const c = LOGGER_COLORS[i % LOGGER_COLORS.length];
              const suffix = isMulti ? ` · ${sn}` : "";
              return [
                <Line key={`t-${sn}`} yAxisId="left" type="monotone" dataKey={`temp_${sn}`} name={`Temp (°C)${suffix}`} stroke={c.temp} strokeWidth={2} dot={false} connectNulls />,
                <Line key={`h-${sn}`} yAxisId="right" type="monotone" dataKey={`humidity_${sn}`} name={`Humidity (%)${suffix}`} stroke={c.humidity} strokeWidth={2} dot={false} connectNulls />,
                <Line key={`l-${sn}`} yAxisId="right" type="monotone" dataKey={`light_${sn}`} name={`Light (%)${suffix}`} stroke={c.light} strokeWidth={2} dot={false} connectNulls />,
              ];
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ───────────────────────── tiny helpers ───────────────────────── */

function Stat({ label, value, tone }: { label: string; value: string; tone?: "destructive" | "accent" }) {
  const cls = tone === "destructive" ? "text-destructive" : tone === "accent" ? "text-accent" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="font-semibold text-sm mb-2">{title}</p>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      {children}
    </section>
  );
}

function ShipperReportsList({ reports }: { reports: any[] }) {
  return (
    <Section title={`Shipper Reports (${reports.length})`}>
      <div className="space-y-2">
        {reports.map((r: any, i: number) => (
          <div key={i} className="border border-border rounded-md p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span>Week <span className="font-mono">{r.weekNr}</span></span>
              {r.stuffingDate && <span className="text-muted-foreground">Stuffed: {r.stuffingDate}</span>}
            </div>
            {r.loadingMin != null && <div className="text-muted-foreground">Loading: {r.loadingMin} min</div>}
            {r.generalComments && <p className="italic">"{r.generalComments}"</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

function OrdersList({ orders }: { orders: any[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <Section title={`Orders & Arrivals (${orders.length})`}>
      <div className="space-y-2">
        {orders.map((o: any, i: number) => {
          const qr = o.qualityReport;
          const isOpen = expanded === i;
          return (
            <div key={i} className="border border-border rounded-md p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium">{o.orderNumber}</span>
                {o.statusName && <span className="text-[10px] text-muted-foreground">{o.statusName}</span>}
              </div>
              <div className="text-muted-foreground">Farm: <span className="text-foreground">{o.farmName || "—"}</span></div>
              <div className="text-muted-foreground">Customer: <span className="text-foreground">{o.customerName || "—"}</span></div>
              <div className="grid grid-cols-3 gap-1 text-muted-foreground pt-1">
                <span>Pallets: <span className="text-foreground">{o.pallets ?? "—"}</span></span>
                <span>Forecast: <span className="text-foreground">{o.forecast ?? "—"}</span></span>
                <span>Wk: <span className="text-foreground">{o.dippingWeek || "—"}</span></span>
              </div>
              {o.arrival && (
                <div className="mt-2 pt-2 border-t border-border space-y-1">
                  <div className="flex justify-between"><span className="font-medium">Arrival</span><span className="text-muted-foreground">{o.arrival.arrivalDate || "—"}</span></div>
                  {Array.isArray(o.arrival.temps) && o.arrival.temps.length > 0 && (
                    <div className="text-muted-foreground">Temps: {o.arrival.temps.join(" / ")} °C</div>
                  )}
                  {o.arrival.dischargeWaitingMin != null && <div className="text-muted-foreground">Discharge wait: {o.arrival.dischargeWaitingMin} min</div>}
                  {o.arrival.specificComments && <p className="italic">"{o.arrival.specificComments}"</p>}
                </div>
              )}
              {qr && (
                <div className="mt-2 pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                    onClick={() => setExpanded(isOpen ? null : i)}
                  >
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <FileText className="h-3.5 w-3.5" />
                    {isOpen ? "Hide Quality Report" : "Quality Report"}
                    {qr.report?.weekNr && <span className="text-muted-foreground ml-1">· wk {qr.report.weekNr}</span>}
                  </Button>
                  {isOpen && (
                    <div className="mt-3 rounded-lg bg-muted/20 border border-border p-2">
                      <QualityReportBody report={qr.report} farmName={qr.farmName || "—"} createdByName={qr.createdByName} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function SharedVaselifeReport({ payload }: { payload: any }) {
  const trial = payload?.trial;
  const vases = payload?.vases ?? [];
  const measurements = payload?.measurements ?? [];
  if (!trial) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <p className="text-sm text-muted-foreground">No trial data in this snapshot.</p>
      </div>
    );
  }
  const reportCode =
    trial.trial_number ||
    (trial.start_vl ? String(trial.start_vl).replace(/-/g, "").slice(0, 8) : String(trial.id || "").slice(0, 8));
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Vase Life Report</h1>
        <span className="ml-2 font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
          {reportCode}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {trial.crop || "—"}{trial.customer ? ` · ${trial.customer}` : ""}{trial.farm ? ` · ${trial.farm}` : ""}
      </p>
      <VaselifeTrialReportBody trial={trial} vases={vases} measurements={measurements} />
    </div>
  );
}
