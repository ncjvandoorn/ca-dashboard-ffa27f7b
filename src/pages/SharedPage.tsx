import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import chrysalLogo from "@/assets/chrysal-logo.png";
import { fetchSharedPage, type SharedPageRow } from "@/lib/sharePages";
import { ExceptionReportBody, type ExceptionAnalysis } from "@/components/dashboard/ExceptionReportBody";
import { SeasonalityInsightsBody, type SeasonalityAnalysis } from "@/components/dashboard/SeasonalityInsightsBody";

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

/** Minimal Data Loggers shared view: shows the flagged loggers table + summary. */
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
