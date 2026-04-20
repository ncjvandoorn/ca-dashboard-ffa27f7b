import { Fragment, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, BarChart3, Ship, Brain, Leaf, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import chrysalLogo from "@/assets/chrysal-logo.png";

type PlanKey = "basic" | "pro" | "proPlus" | "heavy";
type Cycle = "monthly" | "yearly";

// Maps PlanKey (UI) -> tier value used by the signup edge function
const SIGNUP_TIER: Record<PlanKey, string> = {
  basic: "basic",
  pro: "pro",
  proPlus: "pro_plus",
  heavy: "heavy",
};

const PLANS: {
  key: PlanKey;
  name: string;
  tagline: string;
  monthly: string;
  yearly: string;
  highlight?: boolean;
}[] = [
  { key: "basic", name: "Basic", tagline: "Quality fundamentals", monthly: "€45", yearly: "€39" },
  { key: "pro", name: "Pro", tagline: "Quality + sea freight", monthly: "€95", yearly: "€89" },
  { key: "proPlus", name: "Pro+", tagline: "Scaling operations", monthly: "€145", yearly: "€139", highlight: true },
  { key: "heavy", name: "Heavy", tagline: "Enterprise scale", monthly: "Upon request", yearly: "Upon request" },
];

type FeatureGroup = {
  group: string;
  rows: { label: string; included: Record<PlanKey, boolean> }[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    group: "Quality & AI",
    rows: [
      { label: "Quality insights", included: { basic: true, pro: true, proPlus: true, heavy: true } },
      { label: "Seasonality insights", included: { basic: true, pro: true, proPlus: true, heavy: true } },
      { label: "AI insights", included: { basic: true, pro: true, proPlus: true, heavy: true } },
      { label: "AI chat agent", included: { basic: false, pro: true, proPlus: true, heavy: true } },
    ],
  },
  {
    group: "Sea freight",
    rows: [
      { label: "Sea freight overview", included: { basic: true, pro: true, proPlus: true, heavy: true } },
      { label: "Sea freight insights", included: { basic: false, pro: true, proPlus: true, heavy: true } },
      { label: "Sea freight tracking", included: { basic: false, pro: true, proPlus: true, heavy: true } },
    ],
  },
  {
    group: "Trials",
    rows: [
      { label: "Trials overview", included: { basic: true, pro: true, proPlus: true, heavy: true } },
      { label: "Trials insights", included: { basic: false, pro: true, proPlus: true, heavy: true } },
    ],
  },
];

const LIMITS: { label: string; values: Record<PlanKey, string> }[] = [
  { label: "Clients", values: { basic: "—", pro: "1", proPlus: "1", heavy: "Unlimited" } },
  { label: "Farms", values: { basic: "—", pro: "10", proPlus: "25", heavy: "Unlimited" } },
  { label: "Containers / month", values: { basic: "—", pro: "4", proPlus: "10", heavy: "TBD" } },
];

export default function Subscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<Cycle>("yearly");

  const goToSignup = (planKey: PlanKey) => {
    if (planKey === "heavy") {
      window.location.href = "mailto:info@chrysal.co.ke?subject=Heavy%20tier%20enquiry";
      return;
    }
    const tier = SIGNUP_TIER[planKey];
    navigate(`/signup?tier=${tier}&cycle=${cycle}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header (matches other internal pages) */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-card border border-border rounded-md p-1.5 flex items-center justify-center shrink-0">
                <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto max-w-none block shrink-0" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Subscription Plans
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Choose the Chrysal Intelligence plan that fits your operation
                </p>
              </div>
            </div>
            {user ? (
              <PageHeaderActions />
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 px-8 py-10">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Chrysal Intelligence subscriptions
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
              Valuable insights.<br />
              Intelligent Sea Freight tracking.
            </h2>
            <p className="mt-3 text-base text-muted-foreground max-w-2xl">
              Pick the plan that matches how deep you want to go — from essential
              quality insights to full live container tracking and unlimited scale.
            </p>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl">
              {[
                { icon: Leaf, label: "Quality insights" },
                { icon: BarChart3, label: "Seasonality trends" },
                { icon: Brain, label: "AI insights" },
                { icon: Ship, label: "Sea freight tracking" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/70 backdrop-blur-sm px-3 py-2"
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-medium text-foreground leading-tight">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">Billing cycle:</span>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                cycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                cycle === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly <span className="text-[10px] opacity-80">(save up to 13%)</span>
            </button>
          </div>
        </div>

        {/* Plan cards with signup CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((p) => {
            const price = cycle === "monthly" ? p.monthly : p.yearly;
            const priceSuffix =
              p.key === "heavy" ? "" : cycle === "monthly" ? " / month" : " / month, billed yearly";
            return (
              <Card
                key={p.key}
                className={`relative p-5 flex flex-col ${
                  p.highlight ? "border-primary shadow-md ring-1 ring-primary/20" : ""
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide px-2.5 py-0.5">
                    Most popular
                  </span>
                )}
                <div className="space-y-1 mb-4">
                  <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.tagline}</p>
                </div>
                <div className="mb-5">
                  <div className="text-2xl font-bold text-foreground leading-none">{price}</div>
                  {priceSuffix && (
                    <div className="text-[11px] text-muted-foreground mt-1">{priceSuffix}</div>
                  )}
                </div>
                <Button
                  className="w-full mt-auto gap-1"
                  variant={p.highlight ? "default" : "outline"}
                  onClick={() => goToSignup(p.key)}
                >
                  {p.key === "heavy" ? "Contact sales" : "Sign up"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Comparison table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3 w-1/3">
                    Features
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.key}
                      className="text-center font-semibold text-foreground px-4 py-3"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_GROUPS.map((grp, gi) => (
                  <Fragment key={grp.group}>
                    {gi > 0 && (
                      <tr className="border-t border-border bg-muted/20">
                        <td
                          colSpan={PLANS.length + 1}
                          className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium"
                        >
                          {grp.group}
                        </td>
                      </tr>
                    )}
                    {grp.rows.map((row) => (
                      <tr key={row.label} className="border-t border-border">
                        <td className="px-4 py-3 text-foreground">{row.label}</td>
                        {PLANS.map((p) => (
                          <td key={p.key} className="px-4 py-3 text-center">
                            {row.included[p.key] ? (
                              <Check className="h-4 w-4 text-primary inline" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}

                <tr className="border-t border-border bg-muted/20">
                  <td
                    colSpan={PLANS.length + 1}
                    className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium"
                  >
                    Usage limits
                  </td>
                </tr>
                {LIMITS.map((row) => (
                  <tr key={row.label} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">{row.label}</td>
                    {PLANS.map((p) => (
                      <td
                        key={p.key}
                        className="px-4 py-3 text-center text-foreground"
                      >
                        {row.values[p.key]}
                      </td>
                    ))}
                  </tr>
                ))}

                <tr className="border-t border-border bg-muted/20">
                  <td
                    colSpan={PLANS.length + 1}
                    className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium"
                  >
                    Pricing (EUR)
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-3 text-foreground">Monthly renewal</td>
                  {PLANS.map((p) => (
                    <td key={p.key} className="px-4 py-3 text-center font-semibold text-foreground">
                      {p.monthly}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-3 text-foreground">Yearly renewal (per month)</td>
                  {PLANS.map((p) => (
                    <td key={p.key} className="px-4 py-3 text-center font-semibold text-foreground">
                      {p.yearly}
                    </td>
                  ))}
                </tr>

                {/* Sign up row */}
                <tr className="border-t border-border bg-muted/20">
                  <td className="px-4 py-3 text-foreground font-medium">Get started</td>
                  {PLANS.map((p) => (
                    <td key={p.key} className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant={p.highlight ? "default" : "outline"}
                        onClick={() => goToSignup(p.key)}
                        className="gap-1 text-xs h-8"
                      >
                        {p.key === "heavy" ? "Contact" : "Sign up"}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          All prices in euros (EUR), excluding VAT. Contact us for custom Heavy plan pricing.
        </p>
      </main>
    </div>
  );
}
