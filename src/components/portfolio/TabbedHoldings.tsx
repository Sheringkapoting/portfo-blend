import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Building2, 
  Globe, 
  BarChart3, 
  Coins, 
  PiggyBank,
  Landmark,
  Building
} from 'lucide-react';
import { EnrichedHolding, AssetType } from '@/types/portfolio';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetClassTable } from './asset-tables/AssetClassTable';
import { MutualFundsTable } from './asset-tables/MutualFundsTable';
import { EquityTable } from './asset-tables/EquityTable';
import { ETFTable } from './asset-tables/ETFTable';
import { USStockTable } from './asset-tables/USStockTable';
import { SGBTable } from './asset-tables/SGBTable';
import { BondTable } from './asset-tables/BondTable';
import { formatCurrency, formatPercent } from '@/lib/portfolioUtils';
import { cn } from '@/lib/utils';

interface TabbedHoldingsProps {
  holdings: EnrichedHolding[];
}

// Asset type configuration with icons and labels
const ASSET_CONFIG: Record<string, { 
  label: string; 
  icon: React.ElementType;
  consolidateTypes?: string[];
}> = {
  'Equity': { label: 'Equity', icon: TrendingUp },
  'Mutual Fund': { label: 'Mutual Funds', icon: BarChart3, consolidateTypes: ['Mutual Fund', 'Debt MF', 'Equity MF', 'Hybrid MF', 'Commodity MF', 'Index MF'] },
  'ETF': { label: 'ETF', icon: Coins },
  'US Stock': { label: 'US Stocks', icon: Globe },
  'SGB': { label: 'SGB', icon: Coins },
  'Bond': { label: 'Bonds', icon: Landmark },
  'REIT': { label: 'REIT', icon: Building },
  'Commodity': { label: 'Commodity', icon: PiggyBank },
  'Index': { label: 'Index', icon: BarChart3 },
};

// Order of tabs
const TAB_ORDER = ['Equity', 'Mutual Fund', 'ETF', 'US Stock', 'SGB', 'Bond', 'REIT', 'Commodity', 'Index'];

export function TabbedHoldings({ holdings }: TabbedHoldingsProps) {
  const [activeTab, setActiveTab] = useState<string>('all');

  // Group holdings by asset type with MF consolidation
  const { groupedHoldings, assetSummaries, availableTabs } = useMemo(() => {
    const groups = new Map<string, EnrichedHolding[]>();
    const summaries = new Map<string, { count: number; invested: number; current: number; pnl: number }>();

    // Initialize groups
    TAB_ORDER.forEach(type => {
      groups.set(type, []);
      summaries.set(type, { count: 0, invested: 0, current: 0, pnl: 0 });
    });

    holdings.forEach(holding => {
      const type = holding.type as string;
      
      // Consolidate MF types
      if (type.includes('MF') || type === 'Mutual Fund') {
        const mfHoldings = groups.get('Mutual Fund') || [];
        mfHoldings.push(holding);
        groups.set('Mutual Fund', mfHoldings);
        
        const summary = summaries.get('Mutual Fund')!;
        summary.count++;
        summary.invested += holding.investedValue;
        summary.current += holding.currentValue;
        summary.pnl += holding.pnl;
      } else if (groups.has(type)) {
        const typeHoldings = groups.get(type) || [];
        typeHoldings.push(holding);
        groups.set(type, typeHoldings);
        
        const summary = summaries.get(type)!;
        summary.count++;
        summary.invested += holding.investedValue;
        summary.current += holding.currentValue;
        summary.pnl += holding.pnl;
      } else {
        // Handle unknown types - add to a generic group
        const existing = groups.get(type) || [];
        existing.push(holding);
        groups.set(type, existing);
        
        if (!summaries.has(type)) {
          summaries.set(type, { count: 0, invested: 0, current: 0, pnl: 0 });
        }
        const summary = summaries.get(type)!;
        summary.count++;
        summary.invested += holding.investedValue;
        summary.current += holding.currentValue;
        summary.pnl += holding.pnl;
      }
    });

    // Filter to only tabs with holdings
    const available = TAB_ORDER.filter(type => (groups.get(type)?.length || 0) > 0);

    return {
      groupedHoldings: groups,
      assetSummaries: summaries,
      availableTabs: available,
    };
  }, [holdings]);

  // Total summary for "All" tab
  const totalSummary = useMemo(() => {
    return {
      count: holdings.length,
      invested: holdings.reduce((sum, h) => sum + h.investedValue, 0),
      current: holdings.reduce((sum, h) => sum + h.currentValue, 0),
      pnl: holdings.reduce((sum, h) => sum + h.pnl, 0),
    };
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 text-muted-foreground"
      >
        <p>No holdings found. Connect your broker account to sync your portfolio.</p>
      </motion.div>
    );
  }

  const renderTable = (assetType: string, data: EnrichedHolding[]) => {
    switch (assetType) {
      case 'Equity':
        return <EquityTable holdings={data} />;
      case 'Mutual Fund':
        return <MutualFundsTable holdings={data} />;
      case 'ETF':
        return <ETFTable holdings={data} />;
      case 'US Stock':
        return <USStockTable holdings={data} />;
      case 'SGB':
        return <SGBTable holdings={data} />;
      case 'Bond':
        return <BondTable holdings={data} />;
      default:
        return <AssetClassTable holdings={data} assetType={assetType} />;
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 pb-2">
          <TabsList className="bg-muted/30 border border-border p-1 inline-flex min-w-max gap-1">
            {/* All Holdings Tab */}
            <TabsTrigger 
              value="all" 
              className="gap-2 px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm whitespace-nowrap"
            >
              <Building2 className="h-4 w-4" />
              <span>All</span>
              <span className="ml-1 text-xs text-muted-foreground">
                ({totalSummary.count})
              </span>
            </TabsTrigger>

            {/* Asset Type Tabs */}
            {availableTabs.map(type => {
              const config = ASSET_CONFIG[type];
              const summary = assetSummaries.get(type)!;
              const Icon = config?.icon || BarChart3;
              const isProfitable = summary.pnl >= 0;

              return (
                <TabsTrigger 
                  key={type}
                  value={type} 
                  className="gap-2 px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  <span>{config?.label || type}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({summary.count})
                  </span>
                  <span className={cn(
                    "ml-1 text-xs font-medium",
                    isProfitable ? "text-profit" : "text-loss"
                  )}>
                    {formatPercent((summary.pnl / summary.invested) * 100)}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* All Holdings Content */}
        <TabsContent value="all" className="mt-4">
          <div className="space-y-4">
            {availableTabs.map((type, index) => {
              const data = groupedHoldings.get(type) || [];
              const config = ASSET_CONFIG[type];
              const summary = assetSummaries.get(type)!;
              const Icon = config?.icon || BarChart3;
              const isProfitable = summary.pnl >= 0;

              return (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-lg border border-border bg-card/50 overflow-hidden"
                >
                  {/* Section Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {config?.label || type}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {summary.count} holding{summary.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Invested</p>
                        <p className="font-mono font-medium">{formatCurrency(summary.invested, true)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Current</p>
                        <p className="font-mono font-medium">{formatCurrency(summary.current, true)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">P&L</p>
                        <p className={cn(
                          "font-mono font-semibold",
                          isProfitable ? "text-profit" : "text-loss"
                        )}>
                          {isProfitable ? '+' : ''}{formatCurrency(summary.pnl, true)}
                          <span className="text-xs ml-1">
                            ({formatPercent((summary.pnl / summary.invested) * 100)})
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="p-2">
                    {renderTable(type, data)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* Individual Asset Type Content */}
        {availableTabs.map(type => (
          <TabsContent key={type} value={type} className="mt-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border bg-card/50 overflow-hidden"
            >
              {/* Header with summary */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = ASSET_CONFIG[type];
                    const Icon = config?.icon || BarChart3;
                    return (
                      <>
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {config?.label || type}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {assetSummaries.get(type)!.count} holding{assetSummaries.get(type)!.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                {(() => {
                  const summary = assetSummaries.get(type)!;
                  const isProfitable = summary.pnl >= 0;
                  return (
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Total Invested</p>
                        <p className="font-mono font-medium text-lg">{formatCurrency(summary.invested, true)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Current Value</p>
                        <p className="font-mono font-medium text-lg">{formatCurrency(summary.current, true)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Total P&L</p>
                        <p className={cn(
                          "font-mono font-semibold text-lg",
                          isProfitable ? "text-profit" : "text-loss"
                        )}>
                          {isProfitable ? '+' : ''}{formatCurrency(summary.pnl, true)}
                          <span className="text-sm ml-1">
                            ({formatPercent((summary.pnl / summary.invested) * 100)})
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Table */}
              <div className="p-4">
                {renderTable(type, groupedHoldings.get(type) || [])}
              </div>
            </motion.div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
