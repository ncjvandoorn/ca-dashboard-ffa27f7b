import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Flower2,
  Ship,
  FlaskConical,
  CreditCard,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";
import { AppMenuItems } from "@/components/AppMenuItems";
import chrysalLogo from "@/assets/chrysal-logo.png";
import type { PermissionKey } from "@/lib/permissions";

interface Tile {
  label: string;
  description: string;
  icon: LucideIcon;
  to: string;
  permission?: PermissionKey;
  always?: boolean;
}

const TILES: Tile[] = [
  {
    label: "Dashboard",
    description: "Quality, KPIs and farm performance",
    icon: LayoutDashboard,
    to: "/dashboard",
    always: true,
  },
  {
    label: "Rose Dip",
    description: "Stems dipped per week, farm and freight type",
    icon: Flower2,
    to: "/rose-dip",
    permission: "rose_dip",
  },
  {
    label: "Sea Freight",
    description: "Active sea freight trips and live tracking",
    icon: Ship,
    to: "/active-sf",
    permission: "active_sf",
  },
  {
    label: "Trials",
    description: "Vase life trial results and analysis",
    icon: FlaskConical,
    to: "/trials",
    permission: "trials_dashboard",
  },
  {
    label: "Subscription Plans",
    description: "Tier, billing and account management",
    icon: CreditCard,
    to: "/subscriptions",
    permission: "subscription_plans",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { can, loaded } = usePermissions();

  const visibleTiles = TILES.filter(
    (t) => t.always || (loaded && t.permission && can(t.permission)),
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={chrysalLogo} alt="Chrysal" className="h-9 w-auto" />
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-tight">Chrysal Africa</div>
              <div className="text-xs text-muted-foreground leading-tight">Customer Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="gap-2 text-muted-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Menu" aria-label="Open menu">
                  <Menu className="h-5 w-5 text-primary" strokeWidth={2.5} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                <AppMenuItems />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 container mx-auto px-4 py-12 sm:py-16 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Welcome
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Choose where you'd like to go.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {visibleTiles.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.button
                key={t.to}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * i }}
                whileHover={{ y: -3 }}
                onClick={() => navigate(t.to)}
                className="group text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all p-6 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 text-primary p-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base mb-1">{t.label}</div>
                    <div className="text-sm text-muted-foreground leading-snug">
                      {t.description}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>

      <footer className="border-t bg-card/30">
        <div className="container mx-auto px-4 py-4 max-w-6xl text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Chrysal Africa
        </div>
      </footer>
    </div>
  );
}
