import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package } from "lucide-react";
import { useContainers } from "@/hooks/useQualityData";

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ContainersDialog() {
  const [open, setOpen] = useState(false);
  const { data: containers, isLoading } = useContainers();

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
          <DialogTitle>Containers</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking Code</TableHead>
                  <TableHead>Container #</TableHead>
                  <TableHead>Drop-off Date</TableHead>
                  <TableHead>Shipping Date</TableHead>
                  <TableHead>Shipping Line ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(containers || []).map((c) => (
                  <TableRow key={c.id}>
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
      </DialogContent>
    </Dialog>
  );
}
