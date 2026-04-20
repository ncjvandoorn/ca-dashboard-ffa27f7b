import { useEffect, useState } from "react";
import { Ship, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, ListTree, Lock, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useVesselFinderTracking, type VFTracking } from "@/hooks/useVesselFinder";
import { VesselTrackingDetailsSheet } from "./VesselTrackingDetailsSheet";

interface Props {
  containerId: string | null;
  defaultContainerNumber: string | null;
  isAdmin: boolean;
  isCustomer?: boolean;
  onTrackingChange?: (t: VFTracking | null) => void;
}

function fmtDate(ts?: number | null) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function VesselTrackingCard({ containerId, defaultContainerNumber, isAdmin, isCustomer = false, onTrackingChange }: Props) {
  const canAccess = isAdmin || isCustomer;
  const { tracking, loading, error, enable, disable } = useVesselFinderTracking(containerId, canAccess);
  const [override, setOverride] = useState("");
  const [sealine, setSealine] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (tracking) {
      setOverride(tracking.container_number_override || defaultContainerNumber || "");
      setSealine(tracking.sealine || "");
    } else {
      setOverride(defaultContainerNumber || "");
      setSealine("");
    }
  }, [tracking, defaultContainerNumber]);

  useEffect(() => {
    onTrackingChange?.(tracking);
  }, [tracking, onTrackingChange]);

  if (!canAccess) return null;
  if (!containerId) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        No linked container — tracking unavailable.
      </div>
    );
  }

  const isActive = !!tracking?.enabled && tracking.status !== "error";
  // Customer locked number: prefer the already-linked override (so Refresh hits the same container), else the order default.
  const customerLockedNumber = (tracking?.container_number_override || defaultContainerNumber || "").trim();
  const effectiveNumber = isAdmin ? override.trim() : customerLockedNumber;

  const handleSubmit = async (force = false) => {
    if (!effectiveNumber) {
      setActionError("Container number required");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await enable(effectiveNumber, isAdmin ? (sealine.trim() || null) : null, force);
    } catch (e: any) {
      setActionError(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    if (!next) {
      if (!isAdmin) return; // customers cannot disable
      await disable();
    } else {
      await handleSubmit(false);
    }
  };

  const StatusBadge = () => {
    if (!tracking) return null;
    const map: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
      success: { label: "Live", cls: "bg-accent/10 text-accent", Icon: CheckCircle2 },
      queued: { label: "Queued", cls: "bg-muted text-muted-foreground", Icon: Clock },
      processing: { label: "Processing", cls: "bg-primary/10 text-primary", Icon: Loader2 },
      error: { label: "Error", cls: "bg-destructive/10 text-destructive", Icon: AlertCircle },
    };
    const cfg = map[tracking.status] || map.error;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
        <cfg.Icon className={`h-3 w-3 ${tracking.status === "processing" ? "animate-spin" : ""}`} />
        {cfg.label}
      </span>
    );
  };

  const general = tracking?.response?.general;
  const showActivationCTA = isCustomer && !tracking;

  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 mb-3">
        <Ship className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Active Tracking</span>
        <StatusBadge />
        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="vf-toggle" className="text-xs text-muted-foreground">Enable</Label>
            <Switch
              id="vf-toggle"
              checked={isActive}
              onCheckedChange={handleToggle}
              disabled={submitting || loading}
            />
          </div>
        )}
      </div>

      {/* Customer activation CTA when no tracking exists yet */}
      {showActivationCTA && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs space-y-2 mb-3">
          <div className="flex items-start gap-2">
            <Coins className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Live vessel tracking is not yet activated</p>
              <p className="text-muted-foreground mt-0.5">
                Activating uses <strong>1 container credit</strong> and connects this container to live VesselFinder data.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
            Container #
            {!isAdmin && <Lock className="h-2.5 w-2.5" />}
          </Label>
          <Input
            value={isAdmin ? override : (defaultContainerNumber || "")}
            onChange={(e) => isAdmin && setOverride(e.target.value.toUpperCase())}
            placeholder="e.g. MMAU1432549"
            className="h-8 text-xs font-mono mt-1"
            readOnly={!isAdmin}
            disabled={!isAdmin}
          />
        </div>
        {isAdmin && (
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Carrier SCAC (optional)</Label>
            <Input
              value={sealine}
              onChange={(e) => setSealine(e.target.value.toUpperCase())}
              placeholder="auto-detect"
              className="h-8 text-xs font-mono mt-1"
            />
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          {isAdmin ? (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={() => handleSubmit(false)}
                disabled={submitting || loading || !effectiveNumber}
                className="h-7 text-xs"
              >
                {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                {tracking ? "Refresh" : "Track"}
              </Button>
              {tracking && (
                <Button size="sm" variant="outline" onClick={() => handleSubmit(true)} disabled={submitting} className="h-7 text-xs">
                  Force
                </Button>
              )}
            </>
          ) : (
            // Customer: single primary CTA. Activate (uses 1 credit) OR Refresh (free, no credit).
            <Button
              size="sm"
              variant="default"
              onClick={() => handleSubmit(false)}
              disabled={submitting || loading || !effectiveNumber}
              className="h-7 text-xs"
            >
              {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : tracking ? <RefreshCw className="h-3 w-3 mr-1" /> : <Coins className="h-3 w-3 mr-1" />}
              {tracking ? "Refresh" : "Activate (1 credit)"}
            </Button>
          )}
          {tracking?.status === "success" && tracking.response && (
            <Button size="sm" variant="outline" onClick={() => setDetailsOpen(true)} className="h-7 text-xs">
              <ListTree className="h-3 w-3 mr-1" />
              Details
            </Button>
          )}
        </div>
      </div>

      <VesselTrackingDetailsSheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        response={tracking?.response ?? null}
      />

      {(actionError || error) && (
        <div className="mt-2 text-[11px] text-destructive flex items-start gap-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{actionError || error}</span>
        </div>
      )}

      {tracking?.status === "error" && tracking.error_message && (
        <div className="mt-2 text-[11px] text-destructive">
          {tracking.error_code}: {tracking.error_message}
        </div>
      )}

      {tracking?.status === "success" && general && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs">
          {typeof general.progress === "number" && (
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{general.progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${general.progress}%` }} />
              </div>
            </div>
          )}
          {general.carrier && (
            <div className="text-muted-foreground">Carrier: <span className="text-foreground">{general.carrier}</span></div>
          )}
          {general.currentLocation?.vessel?.name && (
            <div className="text-muted-foreground">
              Vessel: <span className="text-foreground">{general.currentLocation.vessel.name}</span>
              {general.currentLocation.vessel.speed != null && (
                <span className="text-muted-foreground"> · {general.currentLocation.vessel.speed} kn</span>
              )}
            </div>
          )}
          {general.currentLocation?.port?.name && (
            <div className="text-muted-foreground">At port: <span className="text-foreground">{general.currentLocation.port.name}</span></div>
          )}
          {general.destination && (
            <div className="text-muted-foreground">
              ETA {general.destination.name}: <span className="text-foreground">{fmtDate(general.destination.date)}</span>
            </div>
          )}
          {general.updatedAt && (
            <div className="text-[10px] text-muted-foreground pt-1">Updated {fmtDate(general.updatedAt)}</div>
          )}
        </div>
      )}

      {(tracking?.status === "queued" || tracking?.status === "processing") && (
        <div className="mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
          Data is being prepared by VesselFinder. This typically takes under 60 seconds, sometimes up to 15–20 minutes. Click <strong>Refresh</strong> to check again.
        </div>
      )}
    </div>
  );
}
