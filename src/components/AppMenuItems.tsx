import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  LogOut,
  FlaskConical,
  CalendarRange,
  Ship,
  CreditCard,
  Users,
  ClipboardCheck,
  UserCircle,
  Activity,
  BarChart3,
  MapPin,
} from "lucide-react";

/**
 * Shared menu items used by both the dashboard ControlBar and the
 * PageHeaderActions menu on every other page. Single source of truth so
 * the two menus never drift apart.
 *
 * Order:
 *   Customer-facing links (Active SF, Trials Dashboard, Subscription Plans)
 *   ─── separator ───
 *   Internal tools (Trial Planner, Data Loggers, Reporting Check, CRM, Customers Map)
 *   ─── separator ───
 *   My Profile / Settings
 *   ─── separator ───
 *   Logout
 */
export function AppMenuItems() {
  const navigate = useNavigate();
  const { signOut, isCustomer } = useAuth();
  const { can } = usePermissions();

  return (
    <>
      {can("active_sf") && (
        <DropdownMenuItem onClick={() => navigate("/active-sf")}>
          <Ship className="h-4 w-4 mr-2" />
          Active Sea Freight
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
      {can("data_loggers") && (
        <DropdownMenuItem onClick={() => navigate("/data-loggers")}>
          <Activity className="h-4 w-4 mr-2" />
          Data Loggers
        </DropdownMenuItem>
      )}
      {can("crm_activities") && (
        <DropdownMenuItem onClick={() => navigate("/crm")}>
          <Users className="h-4 w-4 mr-2" />
          CRM Activities
        </DropdownMenuItem>
      )}
      {can("customers_map") && (
        <DropdownMenuItem onClick={() => navigate("/customers")}>
          <MapPin className="h-4 w-4 mr-2" />
          Customers Map
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
      {can("reporting_check") && (
        <DropdownMenuItem onClick={() => navigate("/?check=reporting")}>
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Reporting Check
        </DropdownMenuItem>
      )}
      {can("activity_analysis") && (
        <DropdownMenuItem onClick={() => navigate("/activity-analysis")}>
          <BarChart3 className="h-4 w-4 mr-2" />
          Activity Analysis
        </DropdownMenuItem>
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
    </>
  );
}
