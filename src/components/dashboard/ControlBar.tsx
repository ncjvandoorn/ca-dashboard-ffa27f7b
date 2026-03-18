import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, LogOut, FlaskConical, CalendarRange, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Account } from "@/lib/csvParser";

interface ControlBarProps {
  accounts: Account[];
  allAccounts: Account[];
  selectedFarmId: string;
  onFarmChange: (id: string) => void;
  years: number[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  farmCount: number;
}

export function ControlBar({ accounts, allAccounts, selectedFarmId, onFarmChange, years, selectedYear, onYearChange, farmCount }: ControlBarProps) {
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchResults = search.length >= 2
    ? allAccounts
        .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 15)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
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

          {/* Farm filter */}
          <div className="flex items-center gap-2">
            <span className="label-text">Farm</span>
            <Select value={selectedFarmId} onValueChange={onFarmChange}>
              <SelectTrigger className="w-[280px] shadow-card border-0 rounded-lg bg-card">
                <SelectValue placeholder="Select a farm" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {sorted.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search field */}
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

          <div className="flex items-center gap-1 ml-2 border-l border-border pl-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/planner")} title="Trial Planner">
              <CalendarRange className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/trials")} title="Trials Dashboard">
              <FlaskConical className="h-4 w-4" />
            </Button>
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
