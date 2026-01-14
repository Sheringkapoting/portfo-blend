import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/portfolioUtils';

interface SourceDetail {
  id: string;
  source: string;
  asset_type: string | null;
  total_investment: number;
  current_value: number;
  total_pnl: number;
  holdings_count: number;
  last_sync_at: string | null;
}

interface SourceBreakdownChartProps {
  sourceDetails: SourceDetail[];
}

const SOURCE_COLORS: Record<string, string> = {
  'Zerodha': 'hsl(142, 76%, 36%)',
  'INDMoney': 'hsl(217, 91%, 60%)',
  'Groww': 'hsl(280, 87%, 65%)',
  'Angel': 'hsl(25, 95%, 53%)',
  'ICICI Direct': 'hsl(350, 80%, 50%)',
  'Manual': 'hsl(220, 13%, 60%)',
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  'Stock': 'hsl(217, 91%, 60%)',
  'Mutual Fund': 'hsl(142, 76%, 36%)',
  'US Stock': 'hsl(45, 93%, 47%)',
  'EPF': 'hsl(280, 87%, 65%)',
  'PPF': 'hsl(350, 80%, 50%)',
  'NPS': 'hsl(25, 95%, 53%)',
  'Bond': 'hsl(220, 13%, 60%)',
  'SGB': 'hsl(38, 92%, 50%)',
  'Unknown': 'hsl(220, 13%, 45%)',
};

export function SourceBreakdownChart({ sourceDetails }: SourceBreakdownChartProps) {
  const sourceData = useMemo(() => {
    const grouped = sourceDetails.reduce((acc, detail) => {
      const source = detail.source || 'Unknown';
      if (!acc[source]) {
        acc[source] = { source, value: 0, investment: 0, pnl: 0, count: 0 };
      }
      acc[source].value += Number(detail.current_value) || 0;
      acc[source].investment += Number(detail.total_investment) || 0;
      acc[source].pnl += Number(detail.total_pnl) || 0;
      acc[source].count += detail.holdings_count || 0;
      return acc;
    }, {} as Record<string, { source: string; value: number; investment: number; pnl: number; count: number }>);
    
    return Object.values(grouped).filter(d => d.value > 0);
  }, [sourceDetails]);

  const assetTypeData = useMemo(() => {
    const grouped = sourceDetails.reduce((acc, detail) => {
      const assetType = detail.asset_type || 'Unknown';
      if (!acc[assetType]) {
        acc[assetType] = { type: assetType, value: 0, investment: 0, pnl: 0, count: 0 };
      }
      acc[assetType].value += Number(detail.current_value) || 0;
      acc[assetType].investment += Number(detail.total_investment) || 0;
      acc[assetType].pnl += Number(detail.total_pnl) || 0;
      acc[assetType].count += detail.holdings_count || 0;
      return acc;
    }, {} as Record<string, { type: string; value: number; investment: number; pnl: number; count: number }>);
    
    return Object.values(grouped).filter(d => d.value > 0);
  }, [sourceDetails]);

  const totalValue = sourceData.reduce((sum, d) => sum + d.value, 0);

  if (sourceDetails.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Source Breakdown */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Source</CardTitle>
            <CardDescription>Portfolio distribution by broker</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="source"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={SOURCE_COLORS[entry.source] || `hsl(${(index * 45) % 360}, 70%, 50%)`}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend 
                    formatter={(value, entry: any) => {
                      const data = sourceData.find(d => d.source === value);
                      const percent = data ? ((data.value / totalValue) * 100).toFixed(1) : 0;
                      return <span className="text-sm">{value} ({percent}%)</span>;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {sourceData.map((source) => (
                <div key={source.source} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: SOURCE_COLORS[source.source] || 'hsl(var(--muted))' }}
                    />
                    <span className="text-muted-foreground">{source.source}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono-numbers">{formatCurrency(source.value, true)}</span>
                    <span className={`font-mono-numbers text-xs ${source.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {source.pnl >= 0 ? '+' : ''}{formatCurrency(source.pnl, true)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Asset Type Breakdown */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Asset Class</CardTitle>
            <CardDescription>Distribution across asset types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="type"
                  >
                    {assetTypeData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={ASSET_TYPE_COLORS[entry.type] || `hsl(${(index * 60) % 360}, 70%, 50%)`}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend 
                    formatter={(value, entry: any) => {
                      const data = assetTypeData.find(d => d.type === value);
                      const percent = data ? ((data.value / totalValue) * 100).toFixed(1) : 0;
                      return <span className="text-sm">{value} ({percent}%)</span>;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {assetTypeData.map((asset) => (
                <div key={asset.type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: ASSET_TYPE_COLORS[asset.type] || 'hsl(var(--muted))' }}
                    />
                    <span className="text-muted-foreground">{asset.type}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono-numbers">{formatCurrency(asset.value, true)}</span>
                    <span className="text-xs text-muted-foreground">{asset.count} holdings</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
