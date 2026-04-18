import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Menu,
  Settings,
  LogOut,
  FlaskConical,
  CalendarRange,
  Package,
  Ship,
  CreditCard,
} from "lucide-react";

interface PageHeaderActionsProps {
  /** If true, hides the Dashboard button (e.g. on the dashboard itself) */
  hideDashboardButton?: boolean;
}

export function PageHeaderActions({ hideDashboardButton = false }: PageHeaderActionsProps) {
  const navigate = useNavigate();
  const { signOut, isAdmin, isCustomer, customerAccount } = useAuth();

  return (
    <div className="flex items-center gap-2">
      {!hideDashboardButton && (
        <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Menu" aria-label="Open menu">
            <Menu className="h-5 w-5 text-primary" strokeWidth={2.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
          {!isCustomer && (
            <DropdownMenuItem onClick={() => navigate("/containers")}>
              <Package className="h-4 w-4 mr-2" />
              Containers
            </DropdownMenuItem>
          )}
          {!isCustomer && (
            <DropdownMenuItem onClick={() => navigate("/active-sf")}>
              <Ship className="h-4 w-4 mr-2" />
              Active SF
            </DropdownMenuItem>
          )}
          {!isCustomer && (
            <DropdownMenuItem onClick={() => navigate("/planner")}>
              <CalendarRange className="h-4 w-4 mr-2" />
              Trial Planner
            </DropdownMenuItem>
          )}
          {(!isCustomer || customerAccount?.canSeeTrials) && (
            <DropdownMenuItem onClick={() => navigate("/trials")}>
              <FlaskConical className="h-4 w-4 mr-2" />
              Trials Dashboard
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => navigate("/subscriptions")}>
            <CreditCard className="h-4 w-4 mr-2" />
            Subscription Plans
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/admin")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
