import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  sparkData: { v: number }[];
  color?: string;
  index?: number;
}

export function MetricCard({
  label,
  value,
  unit = "",
  delta,
  deltaType = "neutral",
  sparkData,
  color = "hsl(210, 100%, 50%)",
  index = 0,
}: MetricCardProps) {
  const deltaColor =
    deltaType === "positive"
      ? "text-accent"
      : deltaType === "negative"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] }}
      className="bg-card rounded-xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 p-5 flex flex-col justify-between min-h-[160px]"
    >
      <p className="label-text">{label}</p>
      <div className="mt-2">
        <div className="flex items-baseline gap-1">
          <span className="display-value text-foreground">{value}</span>
          {unit && <span className="text-sm text-muted-foreground font-medium">{unit}</span>}
        </div>
        {delta && (
          <p className={`text-xs font-medium mt-1 ${deltaColor}`}>{delta}</p>
        )}
      </div>
      {sparkData.length > 1 && (
        <div className="h-10 mt-3 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
