import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Calendar, ArrowUpRight, ArrowDownRight, Camera, Clock, Database, Layers } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatPercent } from '@/lib/portfolioUtils';
import { toast } from 'sonner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
// SourceBreakdownChart import removed - section removed per user request
import { CaptureModal } from './CaptureModal';
import { DataFreshnessIndicator, MultiSourceFreshness } from './DataFreshnessIndicator';

interface Snapshot {
  id: string;
  snapshot_date: string;
  total_investment: number;
  current_value: number;
  total_pnl: number;
  pnl_percent: number;
  holdings_count: number;
}

interface SourceDetail {
  id: string;
  snapshot_id: string;
  source: string;
  asset_type: string | null;
  total_investment: number;
  current_value: number;
  total_pnl: number;
  holdings_count: number;
  last_sync_at: string | null;
}

type DateRange = '7d' | '30d' | '90d' | 'all';

const chartConfig = {
  current_value: {
    label: 'Portfolio Value',
    color: 'hsl(var(--primary))',
  },
  total_investment: {
    label: 'Invested Amount',
    color: 'hsl(var(--muted-foreground))',
  },
};

export function PortfolioAnalytics() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [sourceDetails, setSourceDetails] = useState<SourceDetail[]>([]);
  const [availableSources, setAvailableSources] = useState<{ source: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [showCaptureModal, setShowCaptureModal] = useState(false);

  useEffect(() => {
    fetchSnapshots();
    fetchAvailableSources();
  }, []);

  const fetchSnapshots = async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: true })
        .limit(365);

      if (error) throw error;
      setSnapshots(data || []);

      // Fetch source details for the latest snapshot
      if (data && data.length > 0) {
        const latestSnapshot = data[data.length - 1];
        const { data: details } = await supabase
          .from('snapshot_source_details')
          .select('*')
          .eq('snapshot_id', latestSnapshot.id);
        
        setSourceDetails((details as SourceDetail[]) || []);
      }
    } catch (error) {
      console.error('Error fetching snapshots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableSources = async () => {
    try {
      const { data } = await supabase
        .from('holdings')
        .select('source');
      
      if (data) {
        const sourceCounts = data.reduce((acc, h) => {
          const source = h.source || 'Unknown';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        setAvailableSources(
          Object.entries(sourceCounts).map(([source, count]) => ({ source, count }))
        );
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  };

  const captureSnapshot = async () => {
    setIsCapturing(true);
    try {
      const { data, error } = await supabase.functions.invoke('capture-snapshot');
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(data.message);
        await fetchSnapshots();
      } else {
        toast.error(data.error || 'Failed to capture snapshot');
      }
    } catch (error: any) {
      console.error('Snapshot error:', error);
      toast.error(error.message || 'Failed to capture snapshot');
    } finally {
      setIsCapturing(false);
    }
  };

  const filteredSnapshots = useMemo(() => {
    if (dateRange === 'all') return snapshots;
    
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return snapshots.filter(s => new Date(s.snapshot_date) >= cutoff);
  }, [snapshots, dateRange]);

  const chartData = useMemo(() => {
    return filteredSnapshots.map(s => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      fullDate: s.snapshot_date,
      current_value: Number(s.current_value),
      total_investment: Number(s.total_investment),
      pnl: Number(s.total_pnl),
      pnl_percent: Number(s.pnl_percent),
    }));
  }, [filteredSnapshots]);

  const stats = useMemo(() => {
    if (filteredSnapshots.length === 0) return null;
    
    const latest = filteredSnapshots[filteredSnapshots.length - 1];
    const oldest = filteredSnapshots[0];
    
    const periodPnl = Number(latest.current_value) - Number(oldest.current_value);
    const periodPnlPercent = Number(oldest.current_value) > 0 
      ? (periodPnl / Number(oldest.current_value)) * 100 
      : 0;

    const values = filteredSnapshots.map(s => Number(s.current_value));
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const volatility = ((maxValue - minValue) / minValue) * 100;
    
    return {
      latest,
      periodPnl,
      periodPnlPercent,
      daysTracked: filteredSnapshots.length,
      maxValue,
      minValue,
      volatility,
    };
  }, [filteredSnapshots]);

  // Calculate source freshness for display
  const sourceFreshness = useMemo(() => {
    return sourceDetails.map(d => ({
      source: d.source,
      lastSyncAt: d.last_sync_at,
    }));
  }, [sourceDetails]);

  if (isLoading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-[300px] bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Source Data Freshness */}
      {sourceFreshness.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Data Sources:</span>
            <MultiSourceFreshness sources={sourceFreshness} />
          </div>
          <div className="flex items-center gap-2">
            {availableSources.map(({ source }) => (
              <DataFreshnessIndicator
                key={source}
                source={source}
                lastSyncAt={sourceDetails.find(d => d.source === source)?.last_sync_at || null}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Value</p>
                  <p className="text-2xl font-bold font-mono-numbers">{formatCurrency(Number(stats.latest.current_value), true)}</p>
                  {sourceDetails.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {sourceDetails.length} source{sourceDetails.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total P&L</p>
                  <p className={`text-2xl font-bold font-mono-numbers ${Number(stats.latest.total_pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatCurrency(Number(stats.latest.total_pnl), true)}
                  </p>
                  <p className={`text-sm ${Number(stats.latest.pnl_percent) >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatPercent(Number(stats.latest.pnl_percent))}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${Number(stats.latest.total_pnl) >= 0 ? 'bg-profit/10' : 'bg-loss/10'}`}>
                  {Number(stats.latest.total_pnl) >= 0 ? (
                    <ArrowUpRight className="h-5 w-5 text-profit" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 text-loss" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Period Change</p>
                  <p className={`text-2xl font-bold font-mono-numbers ${stats.periodPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {stats.periodPnl >= 0 ? '+' : ''}{formatPercent(stats.periodPnlPercent)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stats.daysTracked} days
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">High / Low</p>
                  <p className="text-lg font-bold font-mono-numbers text-profit">
                    {formatCurrency(stats.maxValue, true)}
                  </p>
                  <p className="text-sm font-mono-numbers text-loss">
                    {formatCurrency(stats.minValue, true)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted">
                  <TrendingDown className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Source Breakdown Charts section removed per user request */}

      {/* Main Chart */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Portfolio Performance
                {sourceDetails.length > 1 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    <Layers className="h-3 w-3 mr-1" />
                    Multi-source
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Clock className="h-3 w-3" />
                {snapshots.length > 0 
                  ? `Auto-captures daily at 3:30 PM IST`
                  : 'Start tracking your portfolio performance'
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ToggleGroup 
                type="single" 
                value={dateRange} 
                onValueChange={(value) => value && setDateRange(value as DateRange)}
                className="bg-muted/50 p-1 rounded-lg"
              >
                <ToggleGroupItem value="7d" size="sm" className="text-xs px-3">7D</ToggleGroupItem>
                <ToggleGroupItem value="30d" size="sm" className="text-xs px-3">30D</ToggleGroupItem>
                <ToggleGroupItem value="90d" size="sm" className="text-xs px-3">90D</ToggleGroupItem>
                <ToggleGroupItem value="all" size="sm" className="text-xs px-3">All</ToggleGroupItem>
              </ToggleGroup>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCaptureModal(true)}
                disabled={isCapturing}
              >
                <Camera className="h-4 w-4 mr-2" />
                {isCapturing ? 'Capturing...' : 'Capture Now'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No snapshots yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Click "Capture Now" to start tracking your portfolio performance over time
              </p>
              <Badge variant="outline">Tip: Capture daily for best insights</Badge>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent 
                    formatter={(value, name) => {
                      if (name === 'current_value') return [formatCurrency(Number(value)), 'Value'];
                      if (name === 'total_investment') return [formatCurrency(Number(value)), 'Invested Amount'];
                      return [value, name];
                    }}
                  />} 
                />
                <Area
                  type="monotone"
                  dataKey="total_investment"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="url(#colorInvested)"
                />
                <Area
                  type="monotone"
                  dataKey="current_value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Capture Modal */}
      <CaptureModal
        open={showCaptureModal}
        onOpenChange={setShowCaptureModal}
        onCaptureComplete={fetchSnapshots}
        availableSources={availableSources}
      />
    </motion.div>
  );
}
