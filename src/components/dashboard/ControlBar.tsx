import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account } from "@/lib/csvParser";

interface ControlBarProps {
  accounts: Account[];
  selectedFarmId: string;
  onFarmChange: (id: string) => void;
  years: number[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  farmCount: number;
}

export function ControlBar({ accounts, selectedFarmId, onFarmChange, years, selectedYear, onYearChange, farmCount }: ControlBarProps) {
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <header className="sticky top-0 z-10 backdrop-blur-sm py-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="chrysal-gradient rounded-xl px-4 py-2">
            <span className="text-lg font-bold tracking-wide text-primary-foreground">CHRYSAL</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Quality Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Farm quality parameters over time
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
            <span className="text-xs text-muted-foreground tabular-nums">
              {farmCount} farms
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
