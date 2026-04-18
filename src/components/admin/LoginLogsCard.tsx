import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Globe, Loader2, MapPin, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatAdminDate, formatAdminLocation, type LoginLog } from "@/lib/adminUtils";

export const LoginLogsCard = () => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("login_logs")
      .select("*")
      .order("logged_in_at", { ascending: false })
      .limit(50);
    setLogs((data as LoginLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Login Logbook</CardTitle>
              <CardDescription>Recent login activity (last 50 entries)</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No login events recorded yet. Logins will appear here after the next sign-in.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      IP Address
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            log.username === "admin" ? "bg-primary" : "bg-accent"
                          }`}
                        />
                        <span className="font-medium text-sm">{log.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatAdminDate(log.logged_in_at)}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {log.ip_address || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatAdminLocation(log)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
