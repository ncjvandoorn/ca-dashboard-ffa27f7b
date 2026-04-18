import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAccounts, useCustomerFarms } from "@/hooks/useQualityData";
import type { CustomerAccountRecord } from "@/lib/adminUtils";

export const CustomerAccountsCard = () => {
  const [customerAccounts, setCustomerAccounts] = useState<CustomerAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCustUsername, setNewCustUsername] = useState("");
  const [newCustPassword, setNewCustPassword] = useState("CA@2026");
  const [newCustAccountId, setNewCustAccountId] = useState("");
  const [newCustTrials, setNewCustTrials] = useState(false);
  const [newCustTier, setNewCustTier] = useState<"basic" | "pro">("basic");
  const [creating, setCreating] = useState(false);
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
          canSeeTrials: newCustTrials,
          tier: newCustTier,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "Created", description: `Customer account ${newCustUsername} created successfully.` });
      setNewCustUsername("");
      setNewCustPassword("CA@2026");
      setNewCustAccountId("");
      setNewCustTrials(false);
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
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch checked={newCustTrials} onCheckedChange={setNewCustTrials} />
                <Label className="text-sm">Can see Trials Dashboard</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Tier:</Label>
                <select
                  value={newCustTier}
                  onChange={(e) => setNewCustTier(e.target.value as "basic" | "pro")}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro / Pro+ / Heavy</option>
                </select>
              </div>
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
                  <TableHead>Trials Access</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerAccounts.map((ca) => (
                  <TableRow key={ca.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent" />
                        <span className="font-medium text-sm">{ca.username}</span>
                      </div>
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
                        <option value="pro">Pro / Pro+ / Heavy</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={ca.can_see_trials}
                        onCheckedChange={(checked) => updateCustomerAccount(ca.id, { canSeeTrials: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCustomerAccount(ca.id, ca.user_id, ca.username)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
