import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, PieChart, Building2, Wallet, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMFCASSync } from '@/hooks/useMFCASSync';
import { MFHoldingSummary, MFAllocationByAMC, MFAllocationByCategory, MFPortfolioSummary } from '@/types/mutualFund';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/portfolio/StatCard';

export function MFDashboard() {
  const { mfHoldings, isLoadingHoldings } = useMFCASSync();

  const portfolioSummary = useMemo((): MFPortfolioSummary => {
    if (!mfHoldings || mfHoldings.length === 0) {
      return {
        total_invested: 0,
        current_value: 0,
        total_returns: 0,
        returns_percent: 0,
        total_schemes: 0,
        total_folios: 0,
        total_dividend_received: 0,
      };
    }

    const total_invested = mfHoldings.reduce((sum, h) => sum + (h.invested_value || 0), 0);
    const current_value = mfHoldings.reduce((sum, h) => sum + (h.current_value || 0), 0);
    const total_returns = current_value - total_invested;
    const returns_percent = total_invested > 0 ? (total_returns / total_invested) * 100 : 0;
    const total_schemes = mfHoldings.length;
    const total_folios = new Set(mfHoldings.map(h => h.folio_number)).size;
    const total_dividend_received = mfHoldings.reduce((sum, h) => sum + (h.total_dividend_amount || 0), 0);

    return {
      total_invested,
      current_value,
      total_returns,
      returns_percent,
      total_schemes,
      total_folios,
      total_dividend_received,
    };
  }, [mfHoldings]);

  const amcAllocation = useMemo((): MFAllocationByAMC[] => {
    if (!mfHoldings || mfHoldings.length === 0) return [];

    const amcMap = new Map<string, { value: number; schemes_count: number }>();

    mfHoldings.forEach(holding => {
      const existing = amcMap.get(holding.amc_name) || { value: 0, schemes_count: 0 };
      amcMap.set(holding.amc_name, {
        value: existing.value + (holding.current_value || 0),
        schemes_count: existing.schemes_count + 1,
      });
    });

    const total = portfolioSummary.current_value;

    return Array.from(amcMap.entries())
      .map(([amc_name, data]) => ({
        amc_name,
        value: data.value,
        percent: total > 0 ? (data.value / total) * 100 : 0,
        schemes_count: data.schemes_count,
      }))
      .sort((a, b) => b.value - a.value);
  }, [mfHoldings, portfolioSummary.current_value]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoadingHoldings) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!mfHoldings || mfHoldings.length === 0) {
    return (
      <Card className="bg-card/50">
        <CardContent className="p-12 text-center">
          <PieChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold text-lg mb-2">No Mutual Fund Holdings</h3>
          <p className="text-sm text-muted-foreground">
            Sync your mutual funds using PAN to view detailed analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  const isProfitable = portfolioSummary.total_returns >= 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Invested"
          value={portfolioSummary.total_invested}
          subtitle={`${portfolioSummary.total_schemes} schemes • ${portfolioSummary.total_folios} folios`}
          icon={Wallet}
          variant="neutral"
          delay={0.1}
        />
        <StatCard
          title="Current Value"
          value={portfolioSummary.current_value}
          icon={TrendingUp}
          variant="neutral"
          delay={0.15}
        />
        <StatCard
          title="Total Returns"
          value={portfolioSummary.total_returns}
          percentChange={portfolioSummary.returns_percent}
          icon={isProfitable ? TrendingUp : BarChart3}
          variant={isProfitable ? 'profit' : 'loss'}
          delay={0.2}
        />
      </div>

      {/* AMC-wise Allocation */}
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            AMC-wise Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {amcAllocation.map((amc, index) => (
              <motion.div
                key={amc.amc_name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{amc.amc_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {amc.schemes_count} scheme{amc.schemes_count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${amc.percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground min-w-[3rem] text-right">
                      {amc.percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="font-semibold">{formatCurrency(amc.value)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Holdings */}
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Top Holdings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mfHoldings.slice(0, 10).map((holding, index) => {
              const returns = (holding.current_value || 0) - (holding.invested_value || 0);
              const returnsPercent = holding.invested_value && holding.invested_value > 0
                ? (returns / holding.invested_value) * 100
                : 0;
              const isProfit = returns >= 0;

              return (
                <motion.div
                  key={holding.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg bg-background/50 border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm mb-1">{holding.scheme_name}</h4>
                      <p className="text-xs text-muted-foreground">{holding.amc_name}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(holding.current_value || 0)}</div>
                      <div className={`text-xs ${isProfit ? 'text-profit' : 'text-loss'}`}>
                        {isProfit ? '+' : ''}{formatCurrency(returns)} ({returnsPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block">Units</span>
                      <span className="font-medium text-foreground">{holding.total_units?.toFixed(3)}</span>
                    </div>
                    <div>
                      <span className="block">NAV</span>
                      <span className="font-medium text-foreground">₹{holding.current_nav?.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="block">Invested</span>
                      <span className="font-medium text-foreground">{formatCurrency(holding.invested_value || 0)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
