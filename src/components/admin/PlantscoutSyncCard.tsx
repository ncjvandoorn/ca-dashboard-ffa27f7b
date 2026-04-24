import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SyncResult {
  ok: boolean;
  synced_at: string;
  headers: { fetched: number; stubs: number; upserted: number };
  vases: { fetched: number; upserted: number };
  measurements: { fetched: number; upserted: number };
}

export function PlantscoutSyncCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const runSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<SyncResult>("plantscout-sync");
      if (error) throw error;
      if (!data?.ok) throw new Error("Sync did not complete");
      setResult(data);
      toast.success(
        `Plantscout sync complete — ${data.headers.upserted} headers, ${data.vases.upserted} vases, ${data.measurements.upserted} measurements`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Plantscout sync failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          Plantscout Vaselife Sync
        </CardTitle>
        <CardDescription>
          Pull the latest trial Headers, Vases and Measurements from the live Plantscout API into the
          database. Existing records with matching IDs are updated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={runSync} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" /> Sync now
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4 text-sm space-y-1 bg-muted/40 border border-border rounded-md p-3">
            <div>
              <strong>Headers:</strong> {result.headers.fetched} fetched
              {result.headers.stubs > 0 && ` (+${result.headers.stubs} stub)`} → {result.headers.upserted}{" "}
              upserted
            </div>
            <div>
              <strong>Vases:</strong> {result.vases.fetched} fetched → {result.vases.upserted} upserted
            </div>
            <div>
              <strong>Measurements:</strong> {result.measurements.fetched} fetched →{" "}
              {result.measurements.upserted} upserted
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              Synced at {new Date(result.synced_at).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
