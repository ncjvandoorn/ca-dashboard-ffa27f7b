import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, KeyRound, Building2, Sparkles, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import chrysalLogo from "@/assets/chrysal-logo.png";

type Tier = "basic" | "pro" | "pro_plus" | "heavy";
type Cycle = "monthly" | "yearly";

const TIER_LABELS: Record<Tier, string> = {
  basic: "Basic",
  pro: "Pro",
  pro_plus: "Pro+",
  heavy: "Heavy",
};

interface InvitationDetails {
  code: string;
  customer_account_id: string;
  company_name: string | null;
  username: string | null;
}

const fnUrl = (name: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;

export default function Signup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();

  const codeFromUrl = params.get("code")?.trim().toLowerCase() || "";
  const tierFromUrl = (params.get("tier") as Tier) || "basic";
  const cycleFromUrl = (params.get("cycle") as Cycle) || "monthly";

  const [mode, setMode] = useState<"invite" | "public">(codeFromUrl ? "invite" : "public");

  // Invite mode
  const [code, setCode] = useState(codeFromUrl);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Public mode
  const [companyName, setCompanyName] = useState("");
  const [tier, setTier] = useState<Tier>(tierFromUrl);
  const [billingCycle, setBillingCycle] = useState<Cycle>(cycleFromUrl);

  // Shared
  const [username, setUsername] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<"active" | "pending" | null>(null);

  // When an invitation is verified and pre-assigned a username, lock it in
  useEffect(() => {
    if (invitation?.username) setUsername(invitation.username);
  }, [invitation]);

  const usernameLocked = mode === "invite" && !!invitation?.username;

  const validateInvite = async (c: string) => {
    setInviteLoading(true);
    setInviteError(null);
    setInvitation(null);
    try {
      const res = await fetch(fnUrl("customer-signup"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: "validate_invitation", code: c }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Invalid invitation");
      } else {
        setInvitation(data.invitation);
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to validate code");
    } finally {
      setInviteLoading(false);
    }
  };

  useEffect(() => {
    if (codeFromUrl) validateInvite(codeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planLabel = useMemo(() => {
    return `${TIER_LABELS[tier]} · ${billingCycle}`;
  }, [tier, billingCycle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "invite") {
      const inviteUsername = invitation?.username || username;
      if (!invitation || !inviteUsername || !/^[a-z0-9_-]+$/.test(inviteUsername)) {
        toast({ title: "Invalid invitation", description: "Verify your code first", variant: "destructive" });
        return;
      }
    } else if (!companyName.trim()) {
      toast({ title: "Company name required", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    const cleanEmail = contactEmail.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast({ title: "Valid contact email required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload =
        mode === "invite" && invitation
          ? {
              action: "signup_with_invitation",
              code: invitation.code,
              username: (invitation.username || username).toLowerCase(),
              password,
              tier,
              billingCycle,
              contactEmail: cleanEmail,
            }
          : {
              action: "signup_public",
              password,
              companyName: companyName.trim(),
              tier,
              billingCycle,
              contactEmail: cleanEmail,
            };

      const res = await fetch(fnUrl("customer-signup"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      setSubmitted(data.pending ? "pending" : "active");
    } catch (err) {
      toast({
        title: "Signup failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ----- success screens -----
  if (submitted === "active") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <CardTitle>Account ready</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your <strong>{username}</strong> account is active. Sign in to continue.
            </p>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/login")}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (submitted === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Awaiting approval</CardTitle>
            <p className="text-sm text-muted-foreground">
              Thanks <strong>{companyName}</strong>! Your request has been received and is pending review by our team.
              We'll email <strong>{contactEmail}</strong> with your sign-in username once your account is approved.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
              Back to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- form -----
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="chrysal-gradient h-1.5" />
      <div className="container mx-auto px-4 py-8 flex-1 flex items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                aria-label="Go to dashboard"
                className="bg-card border border-border rounded-md p-1.5 hover:bg-accent/10 transition-colors"
              >
                <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto" />
              </Link>
              <div>
                <CardTitle className="text-xl">Create your Chrysal account</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Plan: <strong>{planLabel}</strong>
                </p>
              </div>
            </div>

            {!codeFromUrl && (
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("invite")}
                  className={`px-3 py-1.5 rounded-md border ${
                    mode === "invite" ? "bg-primary text-primary-foreground border-primary" : "border-border"
                  }`}
                >
                  I have an invitation code
                </button>
                <button
                  type="button"
                  onClick={() => setMode("public")}
                  className={`px-3 py-1.5 rounded-md border ${
                    mode === "public" ? "bg-primary text-primary-foreground border-primary" : "border-border"
                  }`}
                >
                  Sign up to a plan
                </button>
              </div>
            )}
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "invite" ? (
                <div className="space-y-2">
                  <Label>Invitation code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toLowerCase())}
                      placeholder="Invitation code"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => validateInvite(code)}
                      disabled={!code || inviteLoading}
                    >
                      {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </Button>
                  </div>
                  {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
                  {invitation && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-0.5">
                      <div>
                        <span className="text-muted-foreground">Account:</span>{" "}
                        <strong>{invitation.company_name || invitation.customer_account_id}</strong>
                      </div>
                      {invitation.username && (
                        <div>
                          <span className="text-muted-foreground">Sign in as:</span>{" "}
                          <strong>{invitation.username}@chrysal.app</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Company name</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company name"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Your account will be reviewed and approved by our team before activation.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as Tier)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="pro_plus">Pro+</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Billing</Label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as Cycle)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {mode === "public" && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Our team will review your request, link you to the right customer account, and assign your login username. You'll receive your sign-in details by email at <strong>{contactEmail || "your contact address"}</strong>.
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
                <p className="text-xs text-muted-foreground">
                  We use this only to reach out about your account — your sign-in stays as the username above.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={submitting || (mode === "invite" && !invitation)}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Create account
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary inline-flex items-center gap-1">
                  Sign in <ArrowRight className="h-3 w-3" />
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
