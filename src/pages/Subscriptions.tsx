import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { PageHeaderActions } from "@/components/PageHeaderActions";
import chrysalLogo from "@/assets/chrysal-logo.png";

type PlanKey = "basic" | "pro" | "proPlus" | "heavy";

const PLANS: {
  key: PlanKey;
  name: string;
  tagline: string;
  monthly: string;
  yearly: string;
  highlight?: boolean;
}[] = [
  { key: "basic", name: "Basic", tagline: "Quality fundamentals", monthly: "€45", yearly: "€39" },
  { key: "pro", name: "Pro", tagline: "Quality + sea freight", monthly: "€95", yearly: "€89", highlight: true },
  { key: "proPlus", name: "Pro+", tagline: "Scaling operations", monthly: "€145", yearly: "€139" },
  { key: "heavy", name: "Heavy", tagline: "Enterprise scale", monthly: "Upon request", yearly: "Upon request" },
];

const FEATURES: { label: string; included: Record<PlanKey, boolean> }[] = [
  { label: "Quality insights", included: { basic: true, pro: true, proPlus: true, heavy: true } },
  { label: "Seasonality insights", included: { basic: true, pro: true, proPlus: true, heavy: true } },
  { label: "AI insights", included: { basic: true, pro: true, proPlus: true, heavy: true } },
  { label: "Sea freight insights", included: { basic: false, pro: true, proPlus: true, heavy: true } },
  { label: "Sea freight tracking", included: { basic: false, pro: true, proPlus: true, heavy: true } },
];

const LIMITS: { label: string; values: Record<PlanKey, string> }[] = [
  { label: "Clients", values: { basic: "—", pro: "1", proPlus: "1", heavy: "Unlimited" } },
  { label: "Farms", values: { basic: "—", pro: "10", proPlus: "25", heavy: "Unlimited" } },
  { label: "Containers / month", values: { basic: "—", pro: "4", proPlus: "10", heavy: "TBD" } },
];

export default function Subscriptions() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header (matches other internal pages) */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-card border border-border rounded-md p-1.5 flex items-center justify-center">
                <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto" />
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
            <PageHeaderActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Plan cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.key}
              className={`p-6 flex flex-col gap-3 ${
                plan.highlight ? "border-primary border-2 shadow-lg" : ""
              }`}
            >
              {plan.highlight && (
                <span className="text-xs font-medium uppercase tracking-wide text-primary">
                  Most popular
                </span>
              )}
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{plan.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{plan.tagline}</p>
              </div>
              <div className="space-y-1 mt-2">
                <div>
                  <span className="text-3xl font-bold text-foreground">{plan.monthly}</span>
                  {plan.monthly.startsWith("€") && (
                    <span className="text-sm text-muted-foreground"> /month</span>
                  )}
                </div>
                {plan.yearly.startsWith("€") ? (
                  <p className="text-xs text-muted-foreground">
                    {plan.yearly}/month billed yearly
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Custom yearly pricing</p>
                )}
              </div>
            </Card>
          ))}
        </section>

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
                {FEATURES.map((row) => (
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
