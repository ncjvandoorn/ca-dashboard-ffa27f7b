import { motion } from "framer-motion";
import type { QualityReport } from "@/lib/csvParser";

interface QualityTablesProps {
  reports: QualityReport[];
}

function ratingBadge(rating: number | null) {
  if (rating === null) return <span className="text-muted-foreground">—</span>;
  const colors =
    rating === 1
      ? "bg-accent/15 text-accent"
      : rating === 2
      ? "bg-warning/15 text-warning"
      : "bg-destructive/15 text-destructive";
  const labels = ["", "Good", "Fair", "Poor"];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${colors}`}>
      {rating} · {labels[rating] || rating}
    </span>
  );
}

export function QualityTables({ reports }: QualityTablesProps) {
  const sorted = [...reports].sort((a, b) => b.weekNr - a.weekNr);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Quality Rating Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-card rounded-xl shadow-card border border-border/40 overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-border/40">
          <h3 className="text-sm font-semibold text-foreground">Flower Quality Rating</h3>
        </div>
        <div className="max-h-[260px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
              <tr>
                <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Week</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-center text-muted-foreground text-xs">No data available</td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-2 text-xs font-mono text-foreground">{r.weekNr}</td>
                    <td className="px-5 py-2">{ratingBadge(r.qrGenQualityRating)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Notes Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="bg-card rounded-xl shadow-card border border-border/40 overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-border/40">
          <h3 className="text-sm font-semibold text-foreground">Quality Notes & Protocol Deviations</h3>
        </div>
        <div className="max-h-[260px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
              <tr>
                <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">Week</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.filter((r) => r.qrGenQualityFlowers || r.qrGenProtocolChanges).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-center text-muted-foreground text-xs">No notes recorded</td>
                </tr>
              ) : (
                sorted
                  .filter((r) => r.qrGenQualityFlowers || r.qrGenProtocolChanges)
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors align-top">
                      <td className="px-5 py-2 text-xs font-mono text-foreground">{r.weekNr}</td>
                      <td className="px-5 py-2 space-y-1">
                        {r.qrGenQualityFlowers && (
                          <p className="text-xs text-foreground">
                            <span className="text-muted-foreground font-medium">Quality: </span>
                            {r.qrGenQualityFlowers}
                          </p>
                        )}
                        {r.qrGenProtocolChanges && (
                          <p className="text-xs text-foreground">
                            <span className="text-muted-foreground font-medium">Protocol: </span>
                            {r.qrGenProtocolChanges}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
