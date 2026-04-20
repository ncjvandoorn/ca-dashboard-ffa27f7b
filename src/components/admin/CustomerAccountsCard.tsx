import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RefreshCw, Trash2, Users, KeyRound, Coins, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAccounts, useCustomerFarms } from "@/hooks/useQualityData";
import type { CustomerAccountRecord } from "@/lib/adminUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExtendedCustomerAccount extends CustomerAccountRecord {
  credit_balance?: number;
  credit_granted?: number;
  credit_consumed?: number;
  status?: string;
  company_name?: string | null;
  billing_cycle?: string;
}

interface CreditEntry {
  id: string;
  delta: number;
  reason: string;
  container_id: string | null;
  note: string | null;
  created_at: string;
}

export const CustomerAccountsCard = () => {
  const [customerAccounts, setCustomerAccounts] = useState<ExtendedCustomerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCustUsername, setNewCustUsername] = useState("");
  const [newCustPassword, setNewCustPassword] = useState("");
  const [newCustAccountId, setNewCustAccountId] = useState("");
  const [newCustTier, setNewCustTier] = useState<"basic" | "pro" | "pro_plus" | "heavy">("basic");
  const [creating, setCreating] = useState(false);
  const [creditDialogFor, setCreditDialogFor] = useState<ExtendedCustomerAccount | null>(null);
  const [creditHistory, setCreditHistory] = useState<CreditEntry[]>([]);
  const [creditHistoryLoading, setCreditHistoryLoading] = useState(false);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [granting, setGranting] = useState(false);
  const { toast } = useToast();
  const { data: allAccounts } = useAccounts();
  const { data: customerFarms } = useCustomerFarms();

  const manageCustomerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-customers`;

  const customerNameMap = useMemo(
    () => new Map((allAccounts || []).map((a) => [a.id, a.name])),
    [allAccounts],
  );

  const availableCustomerAccountIds = useMemo(
    () =>
      [...new Set((customerFarms || []).map((cf) => cf.customerAccountId))]
        .map((id) => ({ id, name: customerNameMap.get(id) || id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [customerFarms, customerNameMap],
  );

  const fetchCustomerAccounts = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "list" }),
      });
      const data = await res.json();
      setCustomerAccounts(data.accounts || []);
    } catch {
      setCustomerAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCustomerAccount = async () => {
    if (!newCustUsername || !newCustAccountId) {
      toast({ title: "Error", description: "Username and customer account are required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "create",
          username: newCustUsername,
          password: newCustPassword,
          customerAccountId: newCustAccountId,
          tier: newCustTier,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "Created", description: `Customer account ${newCustUsername} created successfully.` });
      setNewCustUsername("");
      setNewCustPassword("");
      setNewCustAccountId("");
      setNewCustTier("basic");
      fetchCustomerAccounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const updateCustomerAccount = async (id: string, updates: Record<string, unknown>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "update", id, ...updates }),
      });
      fetchCustomerAccounts();
    } catch {
      // silent
    }
  };

  const deleteCustomerAccount = async (id: string, userId: string, username: string) => {
    if (!confirm(`Delete customer account "${username}"? This cannot be undone.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "delete", id, userId }),
      });
      toast({ title: "Deleted", description: `Customer account ${username} deleted.` });
      fetchCustomerAccounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const resetPassword = async (userId: string, username: string) => {
    const password = window.prompt(`Set a new password for "${username}":`, "");
    if (!password) return;
    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "reset_password", userId, password }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "Password updated", description: `New password set for ${username}.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const openCreditDialog = async (ca: ExtendedCustomerAccount) => {
    setCreditDialogFor(ca);
    setGrantAmount("");
    setGrantNote("");
    setCreditHistoryLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "credit_history", customerAccountId: ca.id }),
      });
      const data = await res.json();
      setCreditHistory(data.history || []);
    } catch {
      setCreditHistory([]);
    } finally {
      setCreditHistoryLoading(false);
    }
  };

  const grantCredits = async () => {
    if (!creditDialogFor) return;
    const amt = parseInt(grantAmount, 10);
    if (!Number.isFinite(amt) || amt === 0) {
      toast({ title: "Enter a non-zero amount", variant: "destructive" });
      return;
    }
    setGranting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(manageCustomerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "grant_credits",
          customerAccountId: creditDialogFor.id,
          delta: amt,
          note: grantNote || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "Credits updated" });
      await openCreditDialog(creditDialogFor);
      fetchCustomerAccounts();
      setGrantAmount("");
      setGrantNote("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed",
        variant: "destructive",
      });
    } finally {
      setGranting(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Customer Accounts</CardTitle>
              <CardDescription>Create and manage customer login accounts linked to customer entities</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchCustomerAccounts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-border rounded-lg p-4 mb-6 space-y-4">
          <p className="text-sm font-medium">Create New Customer Account</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Username</Label>
              <Input
                placeholder="e.g. floraholland"
                value={newCustUsername}
                onChange={(e) => setNewCustUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {newCustUsername ? `${newCustUsername}@chrysal.app` : "Will become username@chrysal.app"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password</Label>
              <Input
                value={newCustPassword}
                onChange={(e) => setNewCustPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Link to Customer Account</Label>
            <select
              value={newCustAccountId}
              onChange={(e) => setNewCustAccountId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a customer account…</option>
              {availableCustomerAccountIds.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Tier:</Label>
              <select
                value={newCustTier}
                onChange={(e) => setNewCustTier(e.target.value as "basic" | "pro" | "pro_plus" | "heavy")}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="pro_plus">Pro+</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
            <Button onClick={createCustomerAccount} disabled={creating} size="sm" className="gap-2">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Account
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : customerAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No customer accounts created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Linked Customer</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead className="w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerAccounts.map((ca) => (
                  <TableRow key={ca.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${ca.status === "pending" ? "bg-muted-foreground" : "bg-accent"}`} />
                        <span className="font-medium text-sm">{ca.username}</span>
                      </div>
                      {ca.company_name && (
                        <p className="text-[11px] text-muted-foreground ml-4">{ca.company_name}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {customerNameMap.get(ca.customer_account_id) || ca.customer_account_id}
                    </TableCell>
                    <TableCell>
                      <select
                        value={ca.tier || "basic"}
                        onChange={(e) => updateCustomerAccount(ca.id, { tier: e.target.value })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="pro_plus">Pro+</option>
                        <option value="heavy">Heavy</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        ca.status === "pending" ? "bg-muted text-muted-foreground" :
                        ca.status === "suspended" ? "bg-destructive/10 text-destructive" :
                        "bg-accent/10 text-accent"
                      }`}>
                        {ca.status || "active"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {ca.tier === "heavy" ? (
                        <span className="text-primary">∞ ({ca.credit_consumed ?? 0} used)</span>
                      ) : (
                        <span className={ca.credit_balance != null && ca.credit_balance <= 0 ? "text-destructive" : ""}>
                          {ca.credit_balance ?? 0}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openCreditDialog(ca)} title="Manage credits">
                          <Coins className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => resetPassword(ca.user_id, ca.username)} title="Reset password">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteCustomerAccount(ca.id, ca.user_id, ca.username)} className="text-destructive hover:text-destructive" title="Delete account">
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

      <Dialog open={!!creditDialogFor} onOpenChange={(o) => !o && setCreditDialogFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Container credits — {creditDialogFor?.username}</DialogTitle>
            <DialogDescription>Grant free credits or review activity. Credits roll over indefinitely.</DialogDescription>
          </DialogHeader>
          <div className="border border-border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Grant credits (admin, free)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount (+ or -)</Label>
                <Input type="number" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} placeholder="e.g. 5" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Note (optional)</Label>
                <Input value={grantNote} onChange={(e) => setGrantNote(e.target.value)} placeholder="e.g. Bonus offered" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={grantCredits} disabled={granting} size="sm" className="gap-2">
                {granting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Apply
              </Button>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">History (last 100)</p>
            </div>
            {creditHistoryLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : creditHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No activity yet.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-border text-xs">
                {creditHistory.map((h) => (
                  <div key={h.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium capitalize">{h.reason.replace(/_/g, " ")}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {new Date(h.created_at).toLocaleString("en-GB")}
                        {h.container_id && ` · ${h.container_id}`}
                        {h.note && ` · ${h.note}`}
                      </p>
                    </div>
                    <span className={`font-mono font-semibold ${h.delta > 0 ? "text-accent" : h.delta < 0 ? "text-destructive" : ""}`}>
                      {h.delta > 0 ? "+" : ""}{h.delta}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
