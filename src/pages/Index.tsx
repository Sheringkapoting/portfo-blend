import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, PiggyBank, BarChart3, Briefcase } from 'lucide-react';
import { DashboardHeader } from '@/components/portfolio/DashboardHeader';
import { StatCard } from '@/components/portfolio/StatCard';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { AllocationChart } from '@/components/portfolio/AllocationChart';
import { sampleHoldings } from '@/data/sampleHoldings';
import { 
  enrichHolding, 
  calculatePortfolioSummary,
  calculateSectorAllocation,
  calculateTypeAllocation,
  calculateSourceAllocation
} from '@/lib/portfolioUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const [lastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Enrich holdings with calculated values
  const enrichedHoldings = useMemo(() => 
    sampleHoldings.map(enrichHolding),
    []
  );

  // Calculate portfolio summary
  const summary = useMemo(() => 
    calculatePortfolioSummary(enrichedHoldings),
    [enrichedHoldings]
  );

  // Calculate allocations
  const sectorAllocation = useMemo(() => 
    calculateSectorAllocation(enrichedHoldings),
    [enrichedHoldings]
  );

  const typeAllocation = useMemo(() => 
    calculateTypeAllocation(enrichedHoldings),
    [enrichedHoldings]
  );

  const sourceAllocation = useMemo(() => 
    calculateSourceAllocation(enrichedHoldings),
    [enrichedHoldings]
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const isProfitable = summary.totalPnl >= 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <DashboardHeader 
          lastUpdated={lastUpdated}
          isLive={false}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Investment"
            value={summary.totalInvestment}
            subtitle={`${summary.holdingsCount} holdings`}
            icon={Wallet}
            variant="neutral"
            delay={0.1}
          />
          <StatCard
            title="Current Value"
            value={summary.currentValue}
            icon={TrendingUp}
            variant="neutral"
            delay={0.15}
          />
          <StatCard
            title="Total P&L"
            value={summary.totalPnl}
            percentChange={summary.pnlPercent}
            icon={isProfitable ? PiggyBank : BarChart3}
            variant={isProfitable ? 'profit' : 'loss'}
            delay={0.2}
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="holdings" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="holdings" className="gap-2 data-[state=active]:bg-card">
              <Briefcase className="h-4 w-4" />
              Holdings
            </TabsTrigger>
            <TabsTrigger value="allocation" className="gap-2 data-[state=active]:bg-card">
              <BarChart3 className="h-4 w-4" />
              Allocation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="holdings" className="mt-6">
            <HoldingsTable holdings={enrichedHoldings} />
          </TabsContent>

          <TabsContent value="allocation" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AllocationChart
                data={sectorAllocation}
                title="Sector Allocation"
                labelKey="sector"
                delay={0.1}
              />
              <AllocationChart
                data={typeAllocation}
                title="Asset Type Allocation"
                labelKey="type"
                delay={0.2}
              />
              <AllocationChart
                data={sourceAllocation}
                title="Source Allocation"
                labelKey="source"
                delay={0.3}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 text-center text-sm text-muted-foreground"
        >
          <p>Data from Zerodha & INDMoney • Last synced: {lastUpdated.toLocaleDateString('en-IN')}</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
