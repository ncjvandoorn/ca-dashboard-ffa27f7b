import { useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, ArrowUp, ArrowDown, Search, FileDown } from "lucide-react";
import { useContainers } from "@/hooks/useQualityData";
import { exportElementToPdf } from "@/lib/exportPdf";
import { toast } from "@/hooks/use-toast";

/** Compute YYWW week number (Sat–Fri cycle, week 1 contains Jan 1) */
function getWeekNr(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const shifted = new Date(d);
  shifted.setDate(shifted.getDate() - ((shifted.getDay() + 1) % 7));
  const year = shifted.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const jan1Sat = new Date(jan1);
  jan1Sat.setDate(jan1.getDate() - ((jan1.getDay() + 1) % 7));
  const weekNum = Math.floor((shifted.getTime() - jan1Sat.getTime()) / (7 * 864e5)) + 1;
  const yy = String(year).slice(-2);
  return `${yy}${String(weekNum).padStart(2, "0")}`;
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type SortField = "dropoffDate" | "shippingDate" | "weekNr";
type SortDir = "asc" | "desc";

export function ContainersDialog() {
  const [open, setOpen] = useState(false);
  const { data: containers, isLoading } = useContainers();
  const [search, setSearch] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("shippingDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const weekOptions = useMemo(() => {
    if (!containers) return [];
    const counts = new Map<string, number>();
    for (const c of containers) {
      const wk = getWeekNr(c.shippingDate);
      counts.set(wk, (counts.get(wk) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([wk, count]) => ({ wk, count }));
  }, [containers]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />;
  };

  const filtered = useMemo(() => {
    if (!containers) return [];
    const q = search.toLowerCase().trim();
    let list = containers;
    if (selectedWeek !== "all") {
      list = list.filter((c) => getWeekNr(c.shippingDate) === selectedWeek);
    }
    if (q) {
      list = list.filter((c) =>
        c.bookingCode.toLowerCase().includes(q) ||
        c.containerNumber.toLowerCase().includes(q) ||
        c.shippingLineId.toLowerCase().includes(q) ||
        formatDate(c.dropoffDate).toLowerCase().includes(q) ||
        formatDate(c.shippingDate).toLowerCase().includes(q) ||
        getWeekNr(c.shippingDate).includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortField === "weekNr") {
        const aw = getWeekNr(a.shippingDate);
        const bw = getWeekNr(b.shippingDate);
        return sortDir === "asc" ? aw.localeCompare(bw) : bw.localeCompare(aw);
      }
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [containers, search, selectedWeek, sortField, sortDir]);

  const handleExport = async () => {
    if (!tableRef.current) return;
    setExporting(true);
    try {
      const label = selectedWeek !== "all" ? `wk${selectedWeek}` : "all";
      await exportElementToPdf(tableRef.current, `containers-${label}`);
      toast({ title: "PDF exported" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Package className="h-4 w-4" />
          Containers
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Containers ({filtered.length})</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search booking code, container, shipping line…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All weeks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All weeks</SelectItem>
              {weekOptions.map(({ wk, count }) => (
                <SelectItem key={wk} value={wk}>
                  Week {wk} ({count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1">
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
        </div>
        <div ref={tableRef}>
          <ScrollArea className="h-[55vh]">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-4">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("weekNr")}>
                      Week <SortIcon field="weekNr" />
                    </TableHead>
                    <TableHead>Booking Code</TableHead>
                    <TableHead>Container #</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("dropoffDate")}>
                      Drop-off Date <SortIcon field="dropoffDate" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("shippingDate")}>
                      Shipping Date <SortIcon field="shippingDate" />
                    </TableHead>
                    <TableHead>Shipping Line ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{getWeekNr(c.shippingDate)}</TableCell>
                      <TableCell>{c.bookingCode}</TableCell>
                      <TableCell className="font-mono">{c.containerNumber}</TableCell>
                      <TableCell>{formatDate(c.dropoffDate)}</TableCell>
                      <TableCell>{formatDate(c.shippingDate)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.shippingLineId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
