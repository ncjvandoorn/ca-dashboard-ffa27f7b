import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Menu } from "lucide-react";
import { AppMenuItems } from "@/components/AppMenuItems";

interface PageHeaderActionsProps {
  /** If true, hides the Dashboard button (e.g. on the dashboard itself) */
  hideDashboardButton?: boolean;
}

export function PageHeaderActions({ hideDashboardButton = false }: PageHeaderActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      {!hideDashboardButton && (
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
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
          <AppMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
