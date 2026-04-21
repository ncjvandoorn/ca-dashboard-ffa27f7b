import { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, Search } from "lucide-react";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { useAuth } from "@/hooks/useAuth";
import {
  useContainers,
  useServicesOrders,
  useServicesOrderDatalogdevices,
  useShipperArrivals,
  useShipperReports,
  useAccounts,
  useShippingLines,
} from "@/hooks/useQualityData";
import chrysalLogo from "@/assets/chrysal-logo.png";

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

export default function Containers() {
  const { isCustomer, customerAccount } = useAuth();
  const { data: containers, isLoading } = useContainers();
  const { data: servicesOrders } = useServicesOrders();
  const { data: orderDatalogdevices } = useServicesOrderDatalogdevices();
  const { data: shipperArrivals } = useShipperArrivals();
  const { data: shipperReports } = useShipperReports();
  const { data: accounts } = useAccounts();
  const { data: shippingLines } = useShippingLines();

  // Build a map: servicesOrderId -> datalogdeviceId[]
  const devicesByOrder = useMemo(() => {
    const m = new Map<string, string[]>();
    (orderDatalogdevices || []).forEach((d) => {
      if (!d.servicesOrderId || !d.datalogdeviceId) return;
      const arr = m.get(d.servicesOrderId) || [];
      arr.push(d.datalogdeviceId);
      m.set(d.servicesOrderId, arr);
    });
    return m;
  }, [orderDatalogdevices]);
  const [search, setSearch] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("shippingDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [exporting, setExporting] = useState(false);
  const [detailContainerId, setDetailContainerId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const accountNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (accounts || []).forEach((a) => m.set(a.id, a.name));
    return m;
  }, [accounts]);

  const shippingLineNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (shippingLines || []).forEach((s) => m.set(s.id, s.name));
    return m;
  }, [shippingLines]);

  const shippingLineName = (id: string) => shippingLineNameMap.get(id) || id;

  // Customers only see orders where they are the customer
  const scopedOrders = useMemo(() => {
    if (!servicesOrders) return [];
    if (!isCustomer) return servicesOrders;
    if (!customerAccount) return [];
    return servicesOrders.filter(
      (o) => o.customerAccountId === customerAccount.customerAccountId
    );
  }, [servicesOrders, isCustomer, customerAccount]);

  const ordersByContainer = useMemo(() => {
    const m = new Map<string, typeof servicesOrders>();
    scopedOrders.forEach((o) => {
      if (!o.containerId) return;
      const arr = m.get(o.containerId) || [];
      arr.push(o);
      m.set(o.containerId, arr);
    });
    return m;
  }, [scopedOrders]);

  const arrivalsByOrder = useMemo(() => {
    const m = new Map<string, typeof shipperArrivals>();
    (shipperArrivals || []).forEach((a) => {
      if (!a.servicesOrderId) return;
      const arr = m.get(a.servicesOrderId) || [];
      arr.push(a);
      m.set(a.servicesOrderId, arr);
    });
    return m;
  }, [shipperArrivals]);

  const reportsByContainer = useMemo(() => {
    const m = new Map<string, typeof shipperReports>();
    (shipperReports || []).forEach((r) => {
      if (!r.containerId) return;
      const arr = m.get(r.containerId) || [];
      arr.push(r);
      m.set(r.containerId, arr);
    });
    return m;
  }, [shipperReports]);

  type Row = {
    rowKey: string;
    container: NonNullable<typeof containers>[number];
    orders: NonNullable<typeof servicesOrders>;
  };
  const rows = useMemo<Row[]>(() => {
    if (!containers) return [];
    return containers
      .map((c) => ({
        rowKey: c.id,
        container: c,
        orders: ordersByContainer.get(c.id) || [],
      }))
      // Customers only see containers with at least one of their orders
      .filter((r) => (isCustomer ? r.orders.length > 0 : true));
  }, [containers, ordersByContainer, isCustomer]);

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
    const q = search.toLowerCase().trim();
    let list = rows;
    if (selectedWeek !== "all") {
      list = list.filter((r) => getWeekNr(r.container.shippingDate) === selectedWeek);
    }
    if (q) {
      list = list.filter((r) => {
        const orderHit = r.orders.some((o) => {
          const farmName = accountNameMap.get(o.farmAccountId) || "";
          return (
            (o.orderNumber || "").toLowerCase().includes(q) ||
            farmName.toLowerCase().includes(q)
          );
        });
        return (
          r.container.bookingCode.toLowerCase().includes(q) ||
          r.container.containerNumber.toLowerCase().includes(q) ||
          shippingLineName(r.container.shippingLineId).toLowerCase().includes(q) ||
          formatDate(r.container.dropoffDate).toLowerCase().includes(q) ||
          formatDate(r.container.shippingDate).toLowerCase().includes(q) ||
          getWeekNr(r.container.shippingDate).includes(q) ||
          orderHit
        );
      });
    }
    return [...list].sort((a, b) => {
      if (sortField === "weekNr") {
        const aw = getWeekNr(a.container.shippingDate);
        const bw = getWeekNr(b.container.shippingDate);
        return sortDir === "asc" ? aw.localeCompare(bw) : bw.localeCompare(aw);
      }
      const av = a.container[sortField] ?? 0;
      const bv = b.container[sortField] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, search, selectedWeek, sortField, sortDir, accountNameMap]);

  // PDF export removed.

  const detailContainer = detailContainerId ? containers?.find((c) => c.id === detailContainerId) : null;
  const detailOrders = detailContainerId ? ordersByContainer.get(detailContainerId) || [] : [];
  const detailReports = detailContainerId ? reportsByContainer.get(detailContainerId) || [] : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="chrysal-gradient h-1.5" />
      <div className="max-w-[1400px] mx-auto px-6 pt-6 pb-12">
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/"
            aria-label="Go to dashboard"
            className="rounded-xl px-3 py-2 flex items-center bg-card border border-border/50 shadow-sm shrink-0 hover:bg-accent/10 transition-colors"
          >
            <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto max-w-none block shrink-0" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Containers ({filtered.length})</h1>
            <p className="text-sm text-muted-foreground">Container shipments, linked orders, and arrivals.</p>
          </div>
          <PageHeaderActions />
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search booking, container, order, farm…"
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
        </div>

        <div ref={tableRef} className="rounded-xl border border-border bg-card">
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
                  <TableHead className="text-center"># Dataloggers</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("dropoffDate")}>
                    Drop-off <SortIcon field="dropoffDate" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("shippingDate")}>
                    Shipping <SortIcon field="shippingDate" />
                  </TableHead>
                  <TableHead>Shipping Line</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.rowKey}
                    className="cursor-pointer"
                    onClick={() => setDetailContainerId(r.container.id)}
                  >
                    <TableCell className="font-mono text-xs">{getWeekNr(r.container.shippingDate)}</TableCell>
                    <TableCell>{r.container.bookingCode}</TableCell>
                    <TableCell className="font-mono">{r.container.containerNumber}</TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {r.orders.reduce((sum, o) => sum + (devicesByOrder.get(o.id)?.length || 0), 0)}
                    </TableCell>
                    <TableCell>{formatDate(r.container.dropoffDate)}</TableCell>
                    <TableCell>{formatDate(r.container.shippingDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{shippingLineName(r.container.shippingLineId)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Sheet open={!!detailContainerId} onOpenChange={(o) => !o && setDetailContainerId(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Container {detailContainer?.containerNumber || ""}</SheetTitle>
          </SheetHeader>
          {detailContainer && (
            <div className="mt-4 space-y-6 text-sm">
              <section>
                <h3 className="font-semibold mb-2">Container</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-muted-foreground">Booking</div><div>{detailContainer.bookingCode || "—"}</div>
                  <div className="text-muted-foreground">Week</div><div className="font-mono">{getWeekNr(detailContainer.shippingDate)}</div>
                  <div className="text-muted-foreground">Drop-off</div><div>{formatDate(detailContainer.dropoffDate)}</div>
                  <div className="text-muted-foreground">Shipping</div><div>{formatDate(detailContainer.shippingDate)}</div>
                  <div className="text-muted-foreground">Shipping Line</div><div>{detailContainer.shippingLineId ? shippingLineName(detailContainer.shippingLineId) : "—"}</div>
                </div>
              </section>

              <section>
                <h3 className="font-semibold mb-2">Shipper Reports ({detailReports.length})</h3>
                {detailReports.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No shipper reports.</p>
                ) : (
                  <div className="space-y-2">
                    {detailReports.map((r) => (
                      <div key={r.id} className="border border-border rounded-md p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span>Week <span className="font-mono">{r.weekNr}</span></span>
                          <span className="text-muted-foreground">Stuffed: {formatDate(r.stuffingDate)}</span>
                        </div>
                        {r.loadingMin !== null && <div className="text-muted-foreground">Loading: {r.loadingMin} min</div>}
                        {r.generalComments && <p className="text-foreground/80 italic">"{r.generalComments}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="font-semibold mb-2">Orders &amp; Arrivals ({detailOrders.length})</h3>
                {detailOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No linked orders.</p>
                ) : (
                  <div className="space-y-2">
                    {detailOrders.map((o) => {
                      const arrivals = arrivalsByOrder.get(o.id) || [];
                      return (
                        <div key={o.id} className="border border-border rounded-md p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-medium">{o.orderNumber}</span>
                            {o.statusName && <Badge variant="secondary" className="text-[10px]">{o.statusName}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Farm: <span className="text-foreground">{accountNameMap.get(o.farmAccountId) || o.farmAccountId.slice(0, 8)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Customer: <span className="text-foreground">{accountNameMap.get(o.customerAccountId) || o.customerAccountId.slice(0, 8)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground grid grid-cols-3 gap-1">
                            <span>Pallets: <span className="text-foreground">{o.pallets ?? "—"}</span></span>
                            <span>Forecast: <span className="text-foreground">{o.forecast ?? "—"}</span></span>
                            <span>Wk: <span className="text-foreground">{o.dippingWeek || "—"}</span></span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Datalogger Device ID: <span className="text-foreground font-mono">{(devicesByOrder.get(o.id) || []).join(", ") || "—"}</span>
                          </div>

                          {arrivals.length > 0 && (
                            <div className="pt-2 border-t border-border space-y-2">
                              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                Arrival{arrivals.length > 1 ? `s (${arrivals.length})` : ""}
                              </div>
                              {arrivals.map((a) => (
                                <div key={a.id} className="text-xs space-y-1">
                                  <div className="text-muted-foreground">
                                    Date: <span className="text-foreground">{formatDate(a.arrivalDate)}</span>
                                  </div>
                                  {(a.arrivalTemp1 !== null || a.arrivalTemp2 !== null || a.arrivalTemp3 !== null) && (
                                    <div className="text-muted-foreground">
                                      Arrival temps: <span className="text-foreground">{[a.arrivalTemp1, a.arrivalTemp2, a.arrivalTemp3].filter((v) => v !== null).join(" / ")} °C</span>
                                    </div>
                                  )}
                                  {a.dischargeWaitingMin !== null && (
                                    <div className="text-muted-foreground">Discharge wait: <span className="text-foreground">{a.dischargeWaitingMin} min</span></div>
                                  )}
                                  {a.specificComments && <p className="text-foreground/80 italic">"{a.specificComments}"</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
