import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Plus, Loader2, Copy, Check, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAccounts, useCustomerFarms } from "@/hooks/useQualityData";
import { useMemo } from "react";

interface Invitation {
  id: string;
  code: string;
  customer_account_id: string;
  company_name: string | null;
  username: string | null;
  used_at: string | null;
  used_by_user_id: string | null;
  created_at: string;
  notes: string | null;
}

const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-customers`;

async function call(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

export const InvitationsCard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: allAccounts } = useAccounts();
  const { data: customerFarms } = useCustomerFarms();

  const [accountId, setAccountId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const fetchInvitations = async () => {
    setLoading(true);
    const data = await call("list_invitations");
    setInvitations(data.invitations || []);
    setLoading(false);
  };

  useEffect(() => { fetchInvitations(); }, []);

  const create = async () => {
    if (!accountId) {
      toast({ title: "Customer account required", variant: "destructive" });
      return;
    }
    const cleanUsername = usernameInput.trim().toLowerCase();
    if (!cleanUsername || !/^[a-z0-9_-]+$/.test(cleanUsername)) {
      toast({ title: "Username required", description: "Lowercase letters, numbers, _ and - only", variant: "destructive" });
      return;
    }
    setCreating(true);
    const data = await call("create_invitation", {
      customerAccountId: accountId,
      companyName: companyName || customerNameMap.get(accountId) || accountId,
      username: cleanUsername,
    });
    setCreating(false);
    if (data.error) {
      toast({ title: "Error", description: data.error, variant: "destructive" });
      return;
    }
    toast({ title: "Invitation created", description: `Code: ${data.invitation.code}` });
    setAccountId("");
    setCompanyName("");
    setUsernameInput("");
    fetchInvitations();
  };

  const copyLink = (code: string, id: string) => {
    const link = `${window.location.origin}/signup?code=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Link copied", description: link });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this invitation?")) return;
    await call("delete_invitation", { id });
    fetchInvitations();
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Customer Invitations</CardTitle>
              <CardDescription>Generate invite codes for customers to complete their own signup</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchInvitations} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-border rounded-lg p-4 mb-6 space-y-4">
          <p className="text-sm font-medium">Create New Invitation</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Customer account</Label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {availableAccounts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Company display name (optional)</Label>
              <Input
                placeholder="e.g. Xpol"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Login username</Label>
            <Input
              placeholder="e.g. xpol"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
            />
            <p className="text-xs text-muted-foreground">
              {usernameInput
                ? `Customer will sign in as ${usernameInput}@chrysal.app`
                : "Lowercase letters, numbers, _ and - only. Customer cannot change this."}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            The customer chooses their subscription tier and billing cycle when completing signup, and provides their contact email. Trial access is managed via the Permissions matrix.
          </p>
          <div className="flex justify-end">
            <Button onClick={create} disabled={creating} size="sm" className="gap-2">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Invitation
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No invitations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.code}</TableCell>
                    <TableCell className="text-sm">
                      {inv.company_name || customerNameMap.get(inv.customer_account_id) || inv.customer_account_id}
                    </TableCell>
                    <TableCell>
                      {inv.used_at ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Used</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">Pending</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {!inv.used_at && (
                          <Button variant="ghost" size="icon" onClick={() => copyLink(inv.code, inv.id)} title="Copy signup link">
                            {copiedId === inv.id ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => remove(inv.id)} className="text-destructive hover:text-destructive" title="Delete">
                          <Trash2 className="h-4 w-4" />
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
