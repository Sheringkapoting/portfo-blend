import { useMemo } from 'react';
import { Wallet, TrendingUp, PiggyBank, BarChart3, Briefcase, Database } from 'lucide-react';
import { DashboardHeader } from '@/components/portfolio/DashboardHeader';
import { StatCard } from '@/components/portfolio/StatCard';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { AllocationChart } from '@/components/portfolio/AllocationChart';
import { DataSourcePanel } from '@/components/portfolio/DataSourcePanel';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { sampleHoldings } from '@/data/sampleHoldings';
import { 
  enrichHolding, 
  calculatePortfolioSummary,
  calculateSectorAllocation,
  calculateTypeAllocation,
  calculateSourceAllocation
} from '@/lib/portfolioUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

const Index = () => {
  const {
    holdings: liveHoldings,
    isLoading,
    isSyncing,
    lastSync,
    syncStatus,
    syncZerodha,
    uploadINDMoneyExcel,
    refetch,
  } = usePortfolioData();

  // Use live holdings if available, otherwise fall back to sample data
  const enrichedHoldings = useMemo(() => {
    if (liveHoldings.length > 0) {
      return liveHoldings;
    }
    return sampleHoldings.map(enrichHolding);
  }, [liveHoldings]);

  const isLive = liveHoldings.length > 0;

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

  const handleRefresh = async () => {
    await refetch();
  };

  const isProfitable = summary.totalPnl >= 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <DashboardHeader 
          lastUpdated={lastSync || new Date()}
          isLive={isLive}
          onRefresh={handleRefresh}
          isRefreshing={isSyncing}
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
            <TabsTrigger value="sources" className="gap-2 data-[state=active]:bg-card">
              <Database className="h-4 w-4" />
              Data Sources
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

          <TabsContent value="sources" className="mt-6">
            <DataSourcePanel
              onSyncZerodha={syncZerodha}
              onUploadINDMoney={uploadINDMoneyExcel}
              isSyncing={isSyncing}
              syncStatus={syncStatus}
              lastSync={lastSync}
            />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            {isLive 
              ? `Live data from ${sourceAllocation.map(s => s.source).join(' & ')} • Last synced: ${lastSync?.toLocaleDateString('en-IN')}`
              : 'Sample data • Connect your accounts in Data Sources tab'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
