import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, AlertCircle, ArrowLeft, Bot, ClipboardCheck, FileText, Container as ContainerIcon, GitCompare, CalendarDays } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import chrysalLogo from "@/assets/chrysal-logo.png";
import { fetchSharedPage, type SharedPageRow } from "@/lib/sharePages";
import { ExceptionReportBody, type ExceptionAnalysis } from "@/components/dashboard/ExceptionReportBody";
import { SeasonalityInsightsBody, type SeasonalityAnalysis } from "@/components/dashboard/SeasonalityInsightsBody";
import { QualityReportBody } from "@/components/dashboard/QualityReportBody";

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
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Trip {t.tripId}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard title="Most Recent">
          {t.lastReadingTime && <p className="text-xs text-muted-foreground">{t.lastReadingTime}</p>}
          {t.lastLocation && <p className="text-xs text-muted-foreground">{t.lastLocation}</p>}
          <div className="flex gap-6 mt-2 text-sm">
            <span className="text-destructive font-bold">{t.lastTemp ?? "—"} °C</span>
            <span className="text-warning font-bold">{t.lastLight ?? "—"} %</span>
            <span className="text-accent font-bold">{t.lastHumidity ?? "—"} %</span>
          </div>
        </InfoCard>
        <InfoCard title="Departed from Origin">
          <p className="font-medium text-sm">{t.originName}</p>
          <p className="text-xs text-muted-foreground">{t.originAddress}</p>
          {t.actualDepartureTime && <p className="text-xs text-muted-foreground mt-1">Actual Departure: {t.actualDepartureTime}</p>}
          {t.carrier && <p className="text-xs text-muted-foreground">Carrier: {t.carrier}</p>}
        </InfoCard>
      </div>
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
        <Stat label="Loggers" value={String(payload?.trips?.length || 0)} />
      </div>
      {Array.isArray(payload.trips) && payload.trips.map((t: any) => (
        <div key={t.tripId} className="rounded-xl border border-border p-4 space-y-2">
          <p className="font-medium text-sm">Trip {t.tripId} {t.serialNumber && <span className="font-mono text-xs text-muted-foreground">({t.serialNumber})</span>}</p>
          <div className="flex gap-6 text-sm">
            <span className="text-destructive">{t.lastTemp ?? "—"} °C</span>
            <span className="text-warning">{t.lastLight ?? "—"} %</span>
            <span className="text-accent">{t.lastHumidity ?? "—"} %</span>
          </div>
          {t.lastReadingTime && <p className="text-xs text-muted-foreground">Last reading: {t.lastReadingTime}</p>}
        </div>
      ))}
      {Array.isArray(payload.shipperReports) && payload.shipperReports.length > 0 && (
        <ShipperReportsList reports={payload.shipperReports} />
      )}
      {Array.isArray(payload.orders) && payload.orders.length > 0 && (
        <OrdersList orders={payload.orders} />
      )}
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
  return (
    <Section title={`Orders & Arrivals (${orders.length})`}>
      <div className="space-y-2">
        {orders.map((o: any, i: number) => (
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
          </div>
        ))}
      </div>
    </Section>
  );
}
