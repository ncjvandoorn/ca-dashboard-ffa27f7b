import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, LogOut, FlaskConical, CalendarRange, Search, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Account, CustomerFarm } from "@/lib/csvParser";

interface ControlBarProps {
  accounts: Account[];
  allAccounts: Account[];
  selectedFarmId: string;
  onFarmChange: (id: string) => void;
  years: number[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  farmCount: number;
  customerFarms: CustomerFarm[];
  selectedCustomerId: string;
  onCustomerChange: (id: string) => void;
  hideSearch?: boolean;
}

function SearchableDropdown({
  label,
  placeholder,
  items,
  value,
  onChange,
  width = "w-[280px]",
}: {
  label: string;
  placeholder: string;
  items: { id: string; name: string; secondary?: string }[];
  value: string;
  onChange: (id: string) => void;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const selectedName = items.find((i) => i.id === value)?.name;

  return (
    <div className="flex items-center gap-2">
      <span className="label-text">{label}</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
          className={`${width} flex items-center justify-between h-10 rounded-lg bg-card shadow-card px-3 py-2 text-sm`}
        >
          <span className="truncate text-left">{selectedName || placeholder}</span>
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
        </button>
        {open && (
          <div className="absolute top-full mt-1 right-0 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden" style={{ width: "320px" }}>
            <div className="flex items-center border-b px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button onClick={() => setSearch("")} className="p-0.5">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No results</p>
              ) : (
                filtered.slice(0, 50).map((item) => (
                  <button
                    key={item.id}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex items-center justify-between gap-2 ${item.id === value ? "bg-accent/5 font-medium" : ""}`}
                    onClick={() => {
                      onChange(item.id);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{item.name}</span>
                    {item.secondary && (
                      <span className="text-xs text-muted-foreground shrink-0">{item.secondary}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ControlBar({
  accounts, allAccounts, selectedFarmId, onFarmChange,
  years, selectedYear, onYearChange, farmCount,
  customerFarms, selectedCustomerId, onCustomerChange,
}: ControlBarProps) {
  const navigate = useNavigate();
  const { signOut, isAdmin, isCustomer, customerAccount } = useAuth();

  // Build customer list from customerFarms + accounts
  const customers = useMemo(() => {
    const customerIds = new Set(customerFarms.map((cf) => cf.customerAccountId));
    const accountMap = new Map(allAccounts.map((a) => [a.id, a]));
    return [...customerIds]
      .map((id) => accountMap.get(id))
      .filter((a): a is Account => !!a)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customerFarms, allAccounts]);

  // Farm items for dropdown — filtered by customer if one is selected
  const farmItems = useMemo(() => {
    let farms = [...accounts];
    if (selectedCustomerId) {
      const allowedFarmIds = new Set(
        customerFarms
          .filter((cf) =>
            cf.customerAccountId === selectedCustomerId &&
            cf.farmAccountConsent === "1" &&
            !cf.deletedAt
          )
          .map((cf) => cf.farmAccountId)
      );
      farms = farms.filter((a) => allowedFarmIds.has(a.id));
    }
    return farms
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({ id: a.id, name: a.name }));
  }, [accounts, selectedCustomerId, customerFarms]);

  const customerItems = useMemo(() =>
    customers.map((c) => ({
      id: c.id,
      name: c.name,
      secondary: `${customerFarms.filter((cf) => cf.customerAccountId === c.id && !cf.deletedAt).length} farms`,
    })),
    [customers, customerFarms]
  );

  // Global search scoped to the currently allowed farm universe
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchableAccounts = useMemo(() => {
    if (selectedCustomerId) {
      const allowedFarmIds = new Set(
        customerFarms
          .filter((cf) =>
            cf.customerAccountId === selectedCustomerId &&
            cf.farmAccountConsent === "1" &&
            !cf.deletedAt
          )
          .map((cf) => cf.farmAccountId)
      );
      return allAccounts.filter((a) => allowedFarmIds.has(a.id));
    }
    return isCustomer ? accounts : allAccounts;
  }, [selectedCustomerId, customerFarms, allAccounts, isCustomer, accounts]);

  const searchResults = search.length >= 2
    ? searchableAccounts
        .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 15)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-10 backdrop-blur-sm py-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="chrysal-gradient rounded-xl px-4 py-2">
            <span className="text-lg font-bold tracking-wide text-primary-foreground">CHRYSAL</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Quality & Trials
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Quality & trial insights at a glance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
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

          <div className="flex items-center gap-1 ml-2 border-l border-border pl-3">
            {!isCustomer && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/planner")} title="Trial Planner">
                <CalendarRange className="h-4 w-4" />
              </Button>
            )}
            {(!isCustomer || customerAccount?.canSeeTrials) && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/trials")} title="Trials Dashboard">
                <FlaskConical className="h-4 w-4" />
              </Button>
            )}
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} title="Admin Settings">
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign Out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
