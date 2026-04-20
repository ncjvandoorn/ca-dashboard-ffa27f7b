import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserCheck, Check, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAccounts, useCustomerFarms } from "@/hooks/useQualityData";

interface PendingAccount {
  id: string;
  user_id: string;
  username: string;
  email: string;
  company_name: string | null;
  customer_account_id: string;
  tier: string;
  billing_cycle: string;
  status: string;
  created_at: string;
}

const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-customers`;

async function call(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

export const PendingApprovalsCard = () => {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountSelect, setAccountSelect] = useState<Record<string, string>>({});
  const [usernameInput, setUsernameInput] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const { data: allAccounts } = useAccounts();
  const { data: customerFarms } = useCustomerFarms();

  const customerNameMap = useMemo(
    () => new Map((allAccounts || []).map((a) => [a.id, a.name])),
    [allAccounts],
  );
  const availableAccounts = useMemo(
    () =>
      [...new Set((customerFarms || []).map((cf) => cf.customerAccountId))]
        .map((id) => ({ id, name: customerNameMap.get(id) || id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [customerFarms, customerNameMap],
  );

  const fetchPending = async () => {
    setLoading(true);
    const data = await call("list");
    const all = (data.accounts || []) as PendingAccount[];
    setPending(all.filter((a) => a.status === "pending"));
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const approve = async (acc: PendingAccount) => {
    const customerAccountId = accountSelect[acc.id];
    const username = (usernameInput[acc.id] || "").trim().toLowerCase();
    if (!customerAccountId) {
      toast({ title: "Pick a customer account first", variant: "destructive" });
      return;
    }
    if (!username || !/^[a-z0-9_-]+$/.test(username)) {
      toast({ title: "Assign a username", description: "Lowercase letters, numbers, _ and - only", variant: "destructive" });
      return;
    }
    setActing(acc.id);
    const data = await call("approve_customer", { id: acc.id, customerAccountId, username });
    setActing(null);
    if (data.error) {
      toast({ title: "Error", description: data.error, variant: "destructive" });
      return;
    }
    toast({ title: "Approved", description: `Login: ${username}@chrysal.app` });
    fetchPending();
  };

  const reject = async (acc: PendingAccount) => {
    if (!confirm(`Reject and delete signup request from "${acc.company_name || acc.username}"?`)) return;
    setActing(acc.id);
    await call("reject_customer", { id: acc.id, userId: acc.user_id });
    setActing(null);
    toast({ title: "Rejected", description: `Request from ${acc.company_name || acc.username} deleted.` });
    fetchPending();
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Pending Customer Approvals</CardTitle>
              <CardDescription>Review and approve customers who signed up via the Subscriptions page</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchPending} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No pending approvals.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Link to Customer</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="text-sm font-medium">{acc.username}</TableCell>
                    <TableCell className="text-sm">{acc.company_name || "—"}</TableCell>
                    <TableCell className="text-sm capitalize">
                      {acc.tier.replace("_", "+")} · {acc.billing_cycle}
                    </TableCell>
                    <TableCell>
                      <select
                        value={accountSelect[acc.id] || ""}
                        onChange={(e) => setAccountSelect((s) => ({ ...s, [acc.id]: e.target.value }))}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs w-full"
                      >
                        <option value="">Select…</option>
                        {availableAccounts.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => approve(acc)}
                          disabled={acting === acc.id}
                          className="text-accent hover:text-accent"
                          title="Approve"
                        >
                          {acting === acc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => reject(acc)}
                          disabled={acting === acc.id}
                          className="text-destructive hover:text-destructive"
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
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
