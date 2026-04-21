import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CapacityRow } from "@/lib/trialsParser";

interface Props {
  rows: CapacityRow[];
}

/** Compute YYWW (Sat–Fri week, week containing Jan 1 = week 1). */
function getWeekNr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const daysSinceSat = (d.getUTCDay() + 1) % 7;
  const sat = new Date(d);
  sat.setUTCDate(d.getUTCDate() - daysSinceSat);
  const year = sat.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1DaysSinceSat = (jan1.getUTCDay() + 1) % 7;
  const week1Sat = new Date(jan1);
  week1Sat.setUTCDate(jan1.getUTCDate() - jan1DaysSinceSat);
  const weekNum = Math.floor((sat.getTime() - week1Sat.getTime()) / (7 * 86400000)) + 1;
  return `${String(year % 100).padStart(2, "0")}${String(weekNum).padStart(2, "0")}`;
}

const SERIES = [
  { key: "ca1", label: "CA1 (boxes)", color: "hsl(210, 70%, 55%)" },
  { key: "ca2", label: "CA2 (boxes)", color: "hsl(195, 65%, 50%)" },
  { key: "ca3", label: "CA3 (boxes)", color: "hsl(175, 55%, 45%)" },
  { key: "ca4", label: "CA4 (boxes)", color: "hsl(160, 50%, 45%)" },
  { key: "transport", label: "Transport / Retail (vases)", color: "hsl(35, 85%, 55%)" },
  { key: "vlRoom", label: "VL Room (vases)", color: "hsl(280, 55%, 55%)" },
] as const;

export function CapacityWeeklyChart({ rows }: Props) {
  const data = useMemo(() => {
    // Aggregate by week: take the PEAK (max) day-occupancy per location for the week.
    const map = new Map<string, { week: string; ca1: number; ca2: number; ca3: number; ca4: number; transport: number; vlRoom: number }>();
    for (const r of rows) {
      const wk = getWeekNr(r.date);
      const ex = map.get(wk) || { week: wk, ca1: 0, ca2: 0, ca3: 0, ca4: 0, transport: 0, vlRoom: 0 };
      ex.ca1 = Math.max(ex.ca1, r.ca1);
      ex.ca2 = Math.max(ex.ca2, r.ca2);
      ex.ca3 = Math.max(ex.ca3, r.ca3);
      ex.ca4 = Math.max(ex.ca4, r.ca4);
      ex.transport = Math.max(ex.transport, r.transport);
      ex.vlRoom = Math.max(ex.vlRoom, r.vlRoom);
      map.set(wk, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
  }, [rows]);

  return (
    <div className="bg-card rounded-xl shadow-card p-6 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="label-text">Weekly Capacity by Location</h3>
        <p className="text-xs text-muted-foreground">Peak daily occupancy per week (YYWW)</p>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "hsl(210, 12%, 46%)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(210, 12%, 46%)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(0, 0%, 100%)",
                border: "none",
                borderRadius: "8px",
                boxShadow: "0 0 0 1px rgba(0,50,100,0.08), 0 4px 16px rgba(0,50,100,0.12)",
                fontSize: "12px",
              }}
              labelFormatter={(v) => `Week ${v}`}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
