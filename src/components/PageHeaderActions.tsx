import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
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
  Users,
  ClipboardCheck,
  UserCircle,
} from "lucide-react";

interface PageHeaderActionsProps {
  /** If true, hides the Dashboard button (e.g. on the dashboard itself) */
  hideDashboardButton?: boolean;
}

export function PageHeaderActions({ hideDashboardButton = false }: PageHeaderActionsProps) {
  const navigate = useNavigate();
  const { signOut, isCustomer } = useAuth();
  const { can } = usePermissions();

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
          {can("containers") && (
            <DropdownMenuItem onClick={() => navigate("/containers")}>
              <Package className="h-4 w-4 mr-2" />
              Containers
            </DropdownMenuItem>
          )}
          {can("active_sf") && (
            <DropdownMenuItem onClick={() => navigate("/active-sf")}>
              <Ship className="h-4 w-4 mr-2" />
              Active SF
            </DropdownMenuItem>
          )}
          {can("trials_dashboard") && (
            <DropdownMenuItem onClick={() => navigate("/trials")}>
              <FlaskConical className="h-4 w-4 mr-2" />
              Trials Dashboard
            </DropdownMenuItem>
          )}
          {can("subscription_plans") && (
            <DropdownMenuItem onClick={() => navigate("/subscriptions")}>
              <CreditCard className="h-4 w-4 mr-2" />
              Subscription Plans
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {can("trial_planner") && (
            <DropdownMenuItem onClick={() => navigate("/planner")}>
              <CalendarRange className="h-4 w-4 mr-2" />
              Trial Planner
            </DropdownMenuItem>
          )}
          {can("reporting_check") && (
            <DropdownMenuItem onClick={() => navigate("/?check=reporting")}>
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Reporting Check
            </DropdownMenuItem>
          )}
          {can("crm_activities") && (
            <DropdownMenuItem onClick={() => navigate("/crm")}>
              <Users className="h-4 w-4 mr-2" />
              CRM Activities
            </DropdownMenuItem>
          )}
          {(isCustomer || can("settings")) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <UserCircle className="h-4 w-4 mr-2" />
                My Profile
              </DropdownMenuItem>
            </>
          )}
          {can("settings") && (
            <DropdownMenuItem onClick={() => navigate("/admin")}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
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
