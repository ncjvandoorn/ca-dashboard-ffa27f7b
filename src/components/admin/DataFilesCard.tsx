import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DATA_FILES, bulkUploadFiles } from "@/lib/adminBulkUpload";

export const DataFilesCard = () => {
  const [bulkUploading, setBulkUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleBulkUpload = async (files: File[]) => {
    setBulkUploading(true);
    const result = await bulkUploadFiles(files, async (key) => {
      await queryClient.invalidateQueries({ queryKey: [key] });
    });
    setBulkUploading(false);

    if (result.unknown.length > 0) {
      toast({
        title: `${result.unknown.length} file(s) skipped`,
        description: `Unrecognized: ${result.unknown.join(", ")}. Filename must match (e.g. container.csv, ALL_Account.csv, ALL_User.csv).`,
        variant: "destructive",
      });
    }
    if (result.success > 0) {
      toast({
        title: `${result.success} file(s) uploaded`,
        description: result.failed.length ? `Failed: ${result.failed.join(", ")}` : "All recognized files updated.",
      });
    } else if (result.failed.length > 0) {
      toast({ title: "All uploads failed", description: result.failed.join(", "), variant: "destructive" });
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Data Files</CardTitle>
            <CardDescription>
              Drop multiple files at once — each is auto-routed by filename. Recognized: {DATA_FILES.map((f) => f.key).join(", ")}.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const files = Array.from(e.dataTransfer.files);
            if (files.length) handleBulkUpload(files);
          }}
          className={`mb-6 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"
          }`}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            {bulkUploading ? "Uploading…" : "Drop multiple files here"}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Files are matched by exact filename (e.g. <span className="font-mono">container.csv</span>, <span className="font-mono">servicesOrder.csv</span>). Unrecognized files are skipped.
          </p>
          <label>
            <input
              type="file"
              multiple
              accept=".csv,.xlsx"
              className="hidden"
              disabled={bulkUploading}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length) handleBulkUpload(files);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" disabled={bulkUploading} asChild>
              <span className="cursor-pointer gap-2 inline-flex items-center">
                {bulkUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Select Files
              </span>
            </Button>
          </label>
        </div>
      </CardContent>
    </Card>
  );
};
