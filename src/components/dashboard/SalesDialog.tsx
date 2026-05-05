import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ShoppingCart } from "lucide-react";
import { useOrderDay } from "@/hooks/useOrderDay";

interface SalesDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** YYWW (Sat-Fri week, week containing Jan 1 = week 1). */
function getWeekNr(d: Date): string {
  const daysSinceSat = (d.getUTCDay() + 1) % 7;
  const sat = new Date(d);
  sat.setUTCDate(d.getUTCDate() - daysSinceSat);
  const year = sat.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1DaysSinceSat = (jan1.getUTCDay() + 1) % 7;
  const week1Sat = new Date(jan1);
  week1Sat.setUTCDate(jan1.getUTCDate() - jan1DaysSinceSat);
  const weekNum = Math.floor((sat.getTime() - week1Sat.getTime()) / (7 * 86400000)) + 1;
  return `${String(year % 100).padStart(2, "0")}${String(weekNum).padStart(2, "0")}`;
}

function parseDate(raw: any): Date | null {
  if (raw == null || raw === "") return null;
  // bigint Unix-ms (number or numeric string)
  if (typeof raw === "number" && isFinite(raw)) return new Date(raw);
  if (typeof raw === "string" && /^\d{10,}$/.test(raw)) {
    const n = Number(raw);
    if (isFinite(n)) return new Date(n);
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export function SalesDialog({ open, onOpenChange }: SalesDialogProps) {
  const { data: rows, isLoading, error } = useOrderDay();

  const weekly = useMemo(() => {
    const map = new Map<string, { week: string; stems: number; forecast: number; rtu: number; orders: number }>();
    for (const r of rows || []) {
      const d = parseDate(r.date);
      if (!d) continue;
      const wk = getWeekNr(d);
      const ex = map.get(wk) || { week: wk, stems: 0, forecast: 0, rtu: 0, orders: 0 };
      ex.stems += Number(r.stems) || 0;
      ex.forecast += Number(r.forecast) || 0;
      ex.rtu += Number(r.rtuPrepared) || 0;
      ex.orders += 1;
      map.set(wk, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
  }, [rows]);

  const totalStems = weekly.reduce((s, w) => s + w.stems, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Sales — Stems per Week
          </DialogTitle>
          <DialogDescription>
            Aggregated from <code>orderDay</code> (external secured database).
            {weekly.length > 0 && (
              <> {weekly.length} week{weekly.length !== 1 ? "s" : ""} · {totalStems.toLocaleString()} stems total.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading sales data…
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Could not load <code>orderDay</code>. Make sure the table exists in the external database and the publishable key has read access.
            <div className="mt-2 text-xs opacity-80">{(error as Error).message}</div>
          </div>
        ) : weekly.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No order rows yet. Insert a dummy row in the external <code>orderDay</code> table to verify the connection.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week (YYWW)</TableHead>
                <TableHead className="text-right">Stems</TableHead>
                <TableHead className="text-right">Forecast</TableHead>
                <TableHead className="text-right">RTU Prepared</TableHead>
                <TableHead className="text-right">Order rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weekly.map((w) => (
                <TableRow key={w.week}>
                  <TableCell className="font-mono">{w.week}</TableCell>
                  <TableCell className="text-right font-semibold">{w.stems.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{w.forecast.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{w.rtu.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{w.orders}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
