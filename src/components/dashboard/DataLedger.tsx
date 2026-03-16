import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { QualityReport } from "@/lib/csvParser";

interface DataLedgerProps {
  reports: QualityReport[];
}

function fmt(v: number | null | string): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function ratingLabel(v: number | null): string {
  if (v === null) return "—";
  if (v === 1) return "Good";
  if (v === 2) return "Average";
  if (v === 3) return "Bad";
  return String(v);
}

export function DataLedger({ reports }: DataLedgerProps) {
  const sorted = [...reports].sort((a, b) => b.weekNr - a.weekNr);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="bg-card rounded-xl shadow-card overflow-hidden"
    >
      <div className="p-6 pb-3">
        <h3 className="label-text">Raw Data Ledger</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground sticky left-0 bg-card">Week</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quality Rating</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">pH (Intake)</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">EC (Intake)</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Temp °C (Intake)</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Humidity % (Intake)</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">pH (Export)</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">EC (Export)</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Temp °C (Export)</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pack Rate</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Truck Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.slice(0, 50).map((r) => (
              <TableRow key={r.id} className="border-0 hover:bg-secondary/50 transition-colors duration-150">
                <TableCell className="font-medium sticky left-0 bg-card tabular-nums">{r.weekNr}</TableCell>
                <TableCell>{ratingLabel(r.qrGenQualityRating)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.qrIntakePh)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.qrIntakeEc)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.qrIntakeTempColdstore)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.qrIntakeHumidityColdstore)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.qrExportPh)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.qrExportEc)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.qrExportTempColdstore)}</TableCell>
                <TableCell className="tabular-nums">{fmt(r.qrDispatchPackrate)}</TableCell>
                <TableCell>{fmt(r.qrDispatchTruckType)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}
