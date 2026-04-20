import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CreditCard,
  History,
  KeyRound,
  Building2,
  ShieldCheck,
  Plus,
  Minus,
  Infinity as InfinityIcon,
} from "lucide-react";
import chrysalLogo from "@/assets/chrysal-logo.png";

interface CreditEntry {
  id: string;
  delta: number;
  reason: string;
  container_id: string | null;
  note: string | null;
  created_at: string;
}

interface AccountInfo {
  id: string;
  customer_account_id: string;
  company_name: string | null;
  tier: string;
  billing_cycle: string;
  can_see_trials: boolean;
  status: string;
}

const TIER_INFO: Record<string, { label: string; monthly: number }> = {
  basic: { label: "Basic", monthly: 0 },
  pro: { label: "Pro", monthly: 4 },
  pro_plus: { label: "Pro+", monthly: 10 },
  heavy: { label: "Heavy", monthly: -1 },
};

export default function Profile() {
  const { user, customerAccount, changePassword } = useAuth();
  const { toast } = useToast();

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [balance, setBalance] = useState<{ balance: number; total_granted: number; total_consumed: number } | null>(null);
  const [history, setHistory] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const isHeavy = account?.tier === "heavy";
  const tierInfo = account ? TIER_INFO[account.tier] || TIER_INFO.basic : TIER_INFO.basic;

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [accRes, balRes, histRes] = await Promise.all([
        supabase
          .from("customer_accounts")
          .select("id, customer_account_id, company_name, tier, billing_cycle, can_see_trials, status")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("customer_credit_balance")
          .select("balance, total_granted, total_consumed")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("container_credits_ledger")
          .select("id, delta, reason, container_id, note, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setAccount(accRes.data as AccountInfo | null);
      setBalance(balRes.data as any);
      setHistory((histRes.data as CreditEntry[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setPwSubmitting(true);
    const { error } = await changePassword(newPassword);
    setPwSubmitting(false);
    if (error) {
      toast({ title: "Failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "Password updated" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label="Go to dashboard"
              className="bg-card border border-border rounded-md p-1.5 hover:bg-accent/10 transition-colors"
            >
              <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">My Profile</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage your subscription, credits and password
              </p>
            </div>
          </div>
          <PageHeaderActions />
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Account info */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Account</CardTitle>
                    <CardDescription>Login: {user?.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {account ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Company</Label>
                      <p className="font-medium mt-1">{account.company_name || account.customer_account_id}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Plan</Label>
                      <p className="font-medium mt-1">{tierInfo.label}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Billing</Label>
                      <p className="font-medium mt-1 capitalize">{account.billing_cycle}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <p className="font-medium mt-1 capitalize flex items-center gap-1.5">
                        {account.status === "active" && <ShieldCheck className="h-4 w-4 text-accent" />}
                        {account.status}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No subscription found.</p>
                )}
              </CardContent>
            </Card>

            {/* Credit balance */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Container Tracking Credits</CardTitle>
                    <CardDescription>
                      Each new container tracked via VesselFinder uses 1 credit. Credits roll over indefinitely.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Available balance</p>
                    {isHeavy ? (
                      <p className="text-2xl font-bold flex items-center gap-1.5">
                        <InfinityIcon className="h-6 w-6 text-primary" />
                        Unlimited
                      </p>
                    ) : (
                      <p className={`text-2xl font-bold ${balance && balance.balance <= 0 ? "text-destructive" : "text-foreground"}`}>
                        {balance?.balance ?? 0}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Total granted</p>
                    <p className="text-2xl font-bold">{balance?.total_granted ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Total consumed</p>
                    <p className="text-2xl font-bold">{balance?.total_consumed ?? 0}</p>
                  </div>
                </div>
                {!isHeavy && tierInfo.monthly > 0 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    You receive <strong>{tierInfo.monthly}</strong> credits at the start of each month.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* History */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <History className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Credit History</CardTitle>
                    <CardDescription>Last 50 grants and consumptions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
                ) : (
                  <div className="divide-y divide-border text-sm">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center ${
                              h.delta > 0
                                ? "bg-accent/10 text-accent"
                                : h.delta < 0
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {h.delta > 0 ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{h.reason.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(h.created_at).toLocaleString("en-GB")}
                              {h.container_id && ` · ${h.container_id}`}
                              {h.note && ` · ${h.note}`}
                            </p>
                          </div>
                        </div>
                        <p className={`font-mono font-semibold ${h.delta > 0 ? "text-accent" : h.delta < 0 ? "text-destructive" : ""}`}>
                          {h.delta > 0 ? "+" : ""}{h.delta}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Change password */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <KeyRound className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Change Password</CardTitle>
                    <CardDescription>Update your login password</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
                  <div className="space-y-1.5">
                    <Label>New password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" disabled={pwSubmitting}>
                    {pwSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Update password
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
