import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LineConfig { key: string; label: string; color: string; yAxisId?: string }

interface TrendChartProps {
  title: string;
  data: { week: number; [key: string]: number | null }[];
  lines: LineConfig[];
}

export function TrendChart({ title, data, lines }: TrendChartProps) {
  // Determine if we need dual axes: any line explicitly on "right" axis
  const hasDualAxis = lines.some((l) => l.yAxisId === "right");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="bg-card rounded-xl shadow-card p-6"
    >
      <h3 className="label-text mb-4">{title}</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: hasDualAxis ? 10 : 4, bottom: 0, left: -20 }}>
            <defs>
              {lines.map((l) => (
                <linearGradient key={l.key} id={`grad-${l.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={l.color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={l.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "hsl(210, 12%, 46%)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "hsl(210, 12%, 46%)" }}
              tickLine={false}
              axisLine={false}
              label={hasDualAxis ? { value: "pH", angle: -90, position: "insideLeft", offset: 20, style: { fontSize: 11, fill: "hsl(210, 12%, 46%)" } } : undefined}
            />
            {hasDualAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "hsl(210, 12%, 46%)" }}
                tickLine={false}
                axisLine={false}
                label={{ value: "EC (μS)", angle: 90, position: "insideRight", offset: 15, style: { fontSize: 11, fill: "hsl(210, 12%, 46%)" } }}
              />
            )}
            <Tooltip
              contentStyle={{
                background: "hsl(0, 0%, 100%)",
                border: "none",
                borderRadius: "8px",
                boxShadow: "0 0 0 1px rgba(0,50,100,0.08), 0 4px 16px rgba(0,50,100,0.12)",
                fontSize: "12px",
                fontFamily: '"IBM Plex Sans", sans-serif',
              }}
              labelFormatter={(v) => `Week ${v}`}
            />
            {lines.map((l) => (
              <Area
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.label}
                stroke={l.color}
                strokeWidth={2}
                fill={`url(#grad-${l.key})`}
                dot={false}
                connectNulls
                yAxisId={l.yAxisId || "left"}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
