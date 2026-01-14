import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { SectorAllocation, TypeAllocation, SourceAllocation } from '@/types/portfolio';
import { formatCurrency, formatPercent } from '@/lib/portfolioUtils';
import { cn } from '@/lib/utils';

type AllocationData = SectorAllocation | TypeAllocation | SourceAllocation;

interface AllocationChartProps<T extends AllocationData> {
  data: T[];
  title: string;
  labelKey: keyof T;
  delay?: number;
}

const CHART_COLORS = [
  'hsl(190, 95%, 45%)',   // Primary cyan
  'hsl(142, 71%, 45%)',   // Green
  'hsl(262, 83%, 58%)',   // Purple
  'hsl(45, 93%, 47%)',    // Yellow
  'hsl(0, 72%, 51%)',     // Red
  'hsl(32, 95%, 44%)',    // Orange
  'hsl(220, 70%, 50%)',   // Blue
  'hsl(340, 75%, 55%)',   // Pink
  'hsl(180, 60%, 45%)',   // Teal
  'hsl(280, 60%, 55%)',   // Violet
];

export function AllocationChart<T extends AllocationData>({ 
  data, 
  title, 
  labelKey,
  delay = 0 
}: AllocationChartProps<T>) {
  const chartData = useMemo(() => 
    data.slice(0, 8).map((item, index) => ({
      name: String(item[labelKey]),
      value: item.value,
      percent: item.percent,
      color: CHART_COLORS[index % CHART_COLORS.length]
    })),
    [data, labelKey]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              stroke="transparent"
              animationBegin={delay * 1000}
              animationDuration={800}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground truncate">{item.name}</span>
            <span className="font-mono-numbers text-foreground ml-auto">
              {item.percent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
      <p className="font-semibold text-foreground">{data.name}</p>
      <p className="text-sm text-muted-foreground font-mono-numbers">
        {formatCurrency(data.value)}
      </p>
      <p className="text-sm font-mono-numbers" style={{ color: data.color }}>
        {data.percent.toFixed(2)}%
      </p>
    </div>
  );
}
