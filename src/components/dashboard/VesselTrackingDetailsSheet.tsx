import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ship, Anchor, MapPin, Navigation, Calendar, Gauge, Compass, ArrowRight, Clock } from "lucide-react";
import type { VFResponse } from "@/hooks/useVesselFinder";

interface Props {
  open: boolean;
  onClose: () => void;
  response: VFResponse | null;
}

function fmtDateTime(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// Maersk-ish event code → friendly description fallback
const EVENT_LABELS: Record<string, string> = {
  CEP: "Container empty to shipper",
  CGI: "Container arrival at first POL (Gate in)",
  CLL: "Container loaded at first POL",
  VDL: "Vessel departure from first POL",
  VAT: "Vessel arrival at T/S port",
  CDT: "Container discharge at T/S port",
  CLT: "Container loaded at T/S port",
  VDT: "Vessel departure from T/S",
  VAD: "Vessel arrival at final POD",
  CDD: "Container discharge at final POD",
  CGO: "Container gate out from final POD",
  CER: "Container empty return to depot",
};

export function VesselTrackingDetailsSheet({ open, onClose, response }: Props) {
  const general = response?.general;
  const schedule = response?.schedule || [];
  const currentVessel = general?.currentLocation?.vessel;
  const currentPort = general?.currentLocation?.port;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-primary" />
            VesselFinder Details
            {general?.containerNumber && (
              <span className="ml-2 font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                {general.containerNumber}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {!response && (
          <div className="py-8 text-center text-sm text-muted-foreground">No tracking data yet.</div>
        )}

        {response && (
          <div className="mt-4 space-y-5">
            {/* Header card: origin → destination + progress */}
            {(general?.origin || general?.destination) && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">From</div>
                    <div className="text-sm font-semibold">{general?.origin?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(general?.origin?.date)}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground">To</div>
                    <div className="text-sm font-semibold">{general?.destination?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(general?.destination?.date)}</div>
                  </div>
                </div>
                {typeof general?.progress === "number" && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Voyage progress</span>
                      <span>{general.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${general.progress}%` }} />
                    </div>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {general?.carrier && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Carrier</div>
                      <div className="font-medium">{general.carrier}</div>
                    </div>
                  )}
                  {general?.updatedAt && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Updated</div>
                      <div className="font-medium">{fmtDateTime(general.updatedAt)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current vessel position */}
            {(currentVessel || currentPort) && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Navigation className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Current Position</span>
                </div>
                {currentVessel?.name && (
                  <div className="text-sm font-medium mb-2">🚢 {currentVessel.name}</div>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {currentVessel?.imo && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">IMO</div>
                      <div className="font-mono">{currentVessel.imo}</div>
                    </div>
                  )}
                  {currentVessel?.mmsi && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">MMSI</div>
                      <div className="font-mono">{currentVessel.mmsi}</div>
                    </div>
                  )}
                  {currentVessel?.speed != null && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                        <Gauge className="h-3 w-3" /> Speed
                      </div>
                      <div className="font-medium">{currentVessel.speed} kn</div>
                    </div>
                  )}
                  {currentVessel?.course != null && (
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                        <Compass className="h-3 w-3" /> Course
                      </div>
                      <div className="font-medium">{currentVessel.course}°</div>
                    </div>
                  )}
                  {currentVessel?.latitude != null && (
                    <div className="col-span-2">
                      <div className="text-[10px] uppercase text-muted-foreground">Position</div>
                      <div className="font-mono text-xs">
                        {currentVessel.latitude.toFixed(4)}, {currentVessel.longitude.toFixed(4)}
                      </div>
                    </div>
                  )}
                  {currentVessel?.aisTimestamp && (
                    <div className="col-span-2">
                      <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Last AIS signal
                      </div>
                      <div className="font-medium">{fmtDateTime(currentVessel.aisTimestamp)}</div>
                    </div>
                  )}
                  {currentPort?.name && (
                    <div className="col-span-2 pt-2 border-t border-border">
                      <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                        <Anchor className="h-3 w-3" /> At port
                      </div>
                      <div className="font-medium">
                        {currentPort.name}
                        {currentPort.country && <span className="text-muted-foreground"> · {currentPort.country}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Schedule / Transshipments */}
            {schedule.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Schedule & Transshipments</span>
                  <span className="text-[10px] text-muted-foreground">({schedule.length} ports)</span>
                </div>
                <div className="space-y-3">
                  {schedule.map((stop, idx) => (
                    <div key={idx} className="relative pl-5 border-l-2 border-border">
                      <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold text-sm">{stop.name || stop.locode || "Unknown port"}</span>
                        {stop.country && (
                          <span className="text-[10px] text-muted-foreground">{stop.country}</span>
                        )}
                      </div>
                      {(stop.events || []).length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {stop.events!.map((ev, ei) => (
                            <div key={ei} className="flex items-baseline gap-2 text-xs">
                              <span className="text-accent font-mono shrink-0">
                                {ev.date ? new Date(ev.date * 1000).toISOString().slice(0, 10) : "—"}
                              </span>
                              <span className="text-foreground">
                                {ev.description || (ev.code ? EVENT_LABELS[ev.code] || ev.code : "Event")}
                                {ev.vessel?.name && (
                                  <span className="text-muted-foreground"> · 🚢 {ev.vessel.name}</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw response (debug) */}
            <details className="rounded-xl border border-dashed border-border p-3">
              <summary className="cursor-pointer text-[11px] text-muted-foreground">
                Raw VesselFinder response (debug)
              </summary>
              <pre className="mt-2 text-[10px] overflow-x-auto bg-muted/30 p-2 rounded">
                {JSON.stringify(response, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
