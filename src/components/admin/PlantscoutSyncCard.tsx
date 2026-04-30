import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FlaskConical, Loader2, RefreshCw, Trash2 } from "lucide-react";
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
  const [cleaning, setCleaning] = useState(false);
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

  const cleanData = async () => {
    setCleaning(true);
    try {
      // Delete in dependency order: measurements, vases, headers
      const m = await supabase.from("vaselife_measurements").delete().not("id_line_property", "is", null);
      if (m.error) throw m.error;
      const v = await supabase.from("vaselife_vases").delete().not("id_line", "is", null);
      if (v.error) throw v.error;
      const h = await supabase.from("vaselife_headers").delete().not("id", "is", null);
      if (h.error) throw h.error;
      setResult(null);
      toast.success("Plantscout data cleared. Run Sync now to fetch a fresh batch.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Clean failed: ${msg}`);
    } finally {
      setCleaning(false);
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
          database. Existing records with matching IDs are updated. Use "Clean data" to wipe all
          Plantscout records before a fresh sync.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runSync} disabled={loading || cleaning}>
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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={loading || cleaning}>
                {cleaning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cleaning…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" /> Clean data
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clean all Plantscout data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all rows from <strong>vaselife_headers</strong>,{" "}
                  <strong>vaselife_vases</strong> and <strong>vaselife_measurements</strong>. You can
                  restore the data by running "Sync now" afterwards. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={cleanData}>Yes, clean it</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

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
