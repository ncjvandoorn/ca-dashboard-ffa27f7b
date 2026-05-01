import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppMenuItems } from "@/components/AppMenuItems";
import { useAuth } from "@/hooks/useAuth";
import type { Account, CustomerFarm } from "@/lib/csvParser";
import chrysalLogo from "@/assets/chrysal-logo.png";

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
          onClick={() => {
            setOpen(!open);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className={`${width} flex items-center justify-between h-10 rounded-lg bg-card shadow-card px-3 py-2 text-sm`}
        >
          <span className="truncate text-left">{selectedName || placeholder}</span>
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
        </button>
        {open && (
          <div
            className="absolute top-full mt-1 right-0 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden"
            style={{ width: "320px" }}
          >
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
  accounts,
  allAccounts,
  selectedFarmId,
  onFarmChange,
  years,
  selectedYear,
  onYearChange,
  farmCount,
  customerFarms,
  selectedCustomerId,
  onCustomerChange,
}: ControlBarProps) {
  const navigate = useNavigate();
  const { isCustomer } = useAuth();

  const customers = useMemo(() => {
    const customerIds = new Set(customerFarms.map((cf) => cf.customerAccountId));
    const accountMap = new Map(allAccounts.map((a) => [a.id, a]));
    return [...customerIds]
      .map((id) => accountMap.get(id))
      .filter((a): a is Account => !!a)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customerFarms, allAccounts]);

  const farmItems = useMemo(() => {
    let farms = [...accounts];
    if (selectedCustomerId) {
      const allowedFarmIds = new Set(
        customerFarms
          .filter(
            (cf) =>
              cf.customerAccountId === selectedCustomerId &&
              cf.farmAccountConsent === "1" &&
              !cf.deletedAt
          )
          .map((cf) => cf.farmAccountId)
      );
      farms = farms.filter((a) => allowedFarmIds.has(a.id));
    }
    return farms.sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ id: a.id, name: a.name }));
  }, [accounts, selectedCustomerId, customerFarms]);

  const customerItems = useMemo(
    () =>
      customers.map((c) => ({
        id: c.id,
        name: c.name,
        secondary: `${customerFarms.filter((cf) => cf.customerAccountId === c.id && !cf.deletedAt).length} farms`,
      })),
    [customers, customerFarms]
  );


  return (
    <header className="sticky top-0 z-10 backdrop-blur-sm py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Go to dashboard"
            className="rounded-xl px-3 py-2 flex items-center bg-card border border-border/50 shadow-sm shrink-0 hover:bg-accent/10 transition-colors cursor-pointer"
          >
            <img src={chrysalLogo} alt="Chrysal" className="h-7 w-auto max-w-none block shrink-0" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Chrysal Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-0.5">One app for tracking & insights in quality performance, cold chain management and sea freight shipments</p>
          </div>
        </div>

        <div className="flex items-center gap-1 border-l border-border pl-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Menu" aria-label="Open menu">
                <Menu className="h-5 w-5 text-primary" strokeWidth={2.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <AppMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
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

        <SearchableDropdown
          label="Farm"
          placeholder="Select a farm"
          items={farmItems}
          value={selectedFarmId}
          onChange={onFarmChange}
          width="w-[280px]"
        />

      </div>
    </header>
  );
}
