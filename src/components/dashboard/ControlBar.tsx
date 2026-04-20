import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, LogOut, FlaskConical, CalendarRange, Search, X, Menu, Package, Ship, CreditCard, Users, UserCircle, ClipboardCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import type { Account, CustomerFarm } from "@/lib/csvParser";
import chrysalLogo from "@/assets/chrysal-logo.png";
...
export function ControlBar({
  accounts, allAccounts, selectedFarmId, onFarmChange,
  years, selectedYear, onYearChange, farmCount,
  customerFarms, selectedCustomerId, onCustomerChange,
  onOpenContainers,
}: ControlBarProps) {
  const navigate = useNavigate();
  const { signOut, isAdmin, isCustomer, customerAccount } = useAuth();
  const { can } = usePermissions();
...
        <div className="flex items-center gap-1 border-l border-border pl-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Menu" aria-label="Open menu">
                <Menu className="h-5 w-5 text-primary" strokeWidth={2.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              {can("containers") && onOpenContainers && (
                <DropdownMenuItem onClick={onOpenContainers}>
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
              {(isCustomer || isAdmin || can("settings")) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserCircle className="h-4 w-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                </>
              )}
              {isAdmin && (
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
      </div>

      {/* Row 2: Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Year filter */}
        <div className="flex items-center gap-2">
          <span className="label-text">Year</span>
          <Select value={selectedYear} onValueChange={onYearChange}>
            <SelectTrigger className="w-[110px] shadow-card border-0 rounded-lg bg-card">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  20{y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Customer filter — hidden for customer users */}
        {!isCustomer && (
          <SearchableDropdown
            label="Customer"
            placeholder="All customers"
            items={[{ id: "", name: "All customers" }, ...customerItems]}
            value={selectedCustomerId}
            onChange={onCustomerChange}
            width="w-[240px]"
          />
        )}

        {/* Farm filter */}
        <SearchableDropdown
          label="Farm"
          placeholder="Select a farm"
          items={farmItems}
          value={selectedFarmId}
          onChange={onFarmChange}
          width="w-[280px]"
        />

        {/* Search field — hidden for customers */}
        {!isCustomer && (
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search all farms…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => search.length >= 2 && setShowResults(true)}
                className="w-[200px] pl-8 h-9 text-sm shadow-card border-0 rounded-lg bg-card"
              />
            </div>
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-[300px] right-0 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-[280px] overflow-y-auto">
                {searchResults.map((a) => {
                  const hasData = accounts.some((acc) => acc.id === a.id);
                  return (
                    <button
                      key={a.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex items-center justify-between gap-2"
                      onClick={() => {
                        onFarmChange(a.id);
                        setSearch("");
                        setShowResults(false);
                      }}
                    >
                      <span className="truncate">{a.name}</span>
                      {!hasData && (
                        <span className="text-xs text-muted-foreground shrink-0">No reports</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
