import { useMemo, useState, useEffect, useRef } from 'react';
import { Wallet, TrendingUp, PiggyBank, BarChart3, Briefcase, Database, LineChart, LayoutGrid, MessageSquare } from 'lucide-react';
import { DashboardHeader } from '@/components/portfolio/DashboardHeader';
import { StatCard } from '@/components/portfolio/StatCard';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { TabbedHoldings } from '@/components/portfolio/TabbedHoldings';
import { AllocationChart } from '@/components/portfolio/AllocationChart';
import { DataSourcePanel } from '@/components/portfolio/DataSourcePanel';
import { PortfolioAnalytics } from '@/components/portfolio/PortfolioAnalytics';
import { CacheStatusBadge } from '@/components/portfolio/CacheStatusBadge';
import { KiteLoginModal } from '@/components/portfolio/KiteLoginModal';
import { AIAssistantPanel } from '@/components/portfolio/AIAssistantPanel';
import { AIInsightsCard } from '@/components/portfolio/AIInsightsCard';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { usePortfolioCache } from '@/hooks/usePortfolioCache';
import { useKiteSession } from '@/hooks/useKiteSession';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

  const {
    cachedSnapshot,
    cacheTimestamp,
    isLoadingCache,
    isUsingCache,
    refreshCache,
    getCacheAge,
  } = usePortfolioCache();

  const {
    isSessionValid,
    loginUrl,
    loginUrlError,
    isLoading: isKiteLoading,
    refetch: refetchKiteSession,
  } = useKiteSession();

  // View mode for holdings: 'tabbed' (by asset class tabs) or 'flat' (traditional table)
  const [holdingsView, setHoldingsView] = useState<'tabbed' | 'flat'>('tabbed');
  
  // AI Assistant panel state
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  // Active tab state - controlled to allow programmatic switching
  const [activeTab, setActiveTab] = useState('holdings');

  // Check if we should show mandatory Kite login
  // Show it when there's no valid session and no holdings synced yet
  const [showMandatoryLogin, setShowMandatoryLogin] = useState(false);
  const [hasCheckedKiteOnce, setHasCheckedKiteOnce] = useState(false);
  const hasHandledKiteRedirect = useRef(false);

  // Handle Kite OAuth redirect - show toast, auto-sync, and switch to sources tab
  useEffect(() => {
    if (hasHandledKiteRedirect.current) return;
    
    const params = new URLSearchParams(window.location.search);
    const kiteConnected = params.get('kite_connected');
    const kiteError = params.get('kite_error');
    
    if (kiteConnected === 'true') {
      hasHandledKiteRedirect.current = true;
      
      // Refetch kite session status
      refetchKiteSession();
      
      toast.success('Zerodha connected successfully!', {
        description: 'Syncing your portfolio holdings...',
        duration: 5000,
      });
      
      // Switch to Data Sources tab to show sync progress
      setActiveTab('sources');
      
      // Auto-sync after successful connection
      setTimeout(async () => {
        try {
          await syncZerodha();
          toast.success('Portfolio synced!', {
            description: 'Your Zerodha holdings have been imported.',
            duration: 4000,
          });
          // Switch to holdings tab after successful sync
          setActiveTab('holdings');
        } catch (err) {
          toast.error('Sync failed', {
            description: 'Please try syncing again from Data Sources.',
          });
        }
      }, 1500);
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (kiteError) {
      hasHandledKiteRedirect.current = true;
      toast.error('Zerodha connection failed', {
        description: decodeURIComponent(kiteError),
        duration: 5000,
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [syncZerodha, refetchKiteSession]);

  useEffect(() => {
    // Only check once after initial load
    if (!isKiteLoading && !isLoading && !hasCheckedKiteOnce) {
      setHasCheckedKiteOnce(true);
      // Show mandatory login if no valid session and no holdings
      if (!isSessionValid && liveHoldings.length === 0) {
        // Check if user just came back from Kite OAuth
        const params = new URLSearchParams(window.location.search);
        if (!params.get('kite_connected')) {
          setShowMandatoryLogin(true);
        }
      }
    }
  }, [isKiteLoading, isLoading, isSessionValid, liveHoldings.length, hasCheckedKiteOnce]);

  // Hide modal when session becomes valid
  useEffect(() => {
    if (isSessionValid) {
      setShowMandatoryLogin(false);
    }
  }, [isSessionValid]);

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
    await refreshCache();
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
      {/* Mandatory Kite Login Modal */}
      {showMandatoryLogin && (
        <KiteLoginModal
          loginUrl={loginUrl}
          loginUrlError={loginUrlError}
          isLoading={isKiteLoading}
        />
      )}

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <DashboardHeader 
            lastUpdated={lastSync || new Date()}
            isLive={isLive}
            onRefresh={handleRefresh}
            isRefreshing={isSyncing}
          />
          {/* Cache status indicator */}
          {isUsingCache && (
            <CacheStatusBadge
              cacheTimestamp={cacheTimestamp}
              getCacheAge={getCacheAge}
              isLoadingCache={isLoadingCache}
              isUsingCache={isUsingCache}
            />
          )}
        </div>

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="holdings" className="gap-2 data-[state=active]:bg-card">
              <Briefcase className="h-4 w-4" />
              Holdings
            </TabsTrigger>
            <TabsTrigger value="allocation" className="gap-2 data-[state=active]:bg-card">
              <BarChart3 className="h-4 w-4" />
              Allocation
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-card">
              <LineChart className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-2 data-[state=active]:bg-card">
              <Database className="h-4 w-4" />
              Data Sources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="holdings" className="mt-6">
            {/* View toggle */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Portfolio Holdings</h2>
              <ToggleGroup
                type="single"
                value={holdingsView}
                onValueChange={(value) => value && setHoldingsView(value as 'tabbed' | 'flat')}
                className="bg-muted/50 border border-border rounded-lg p-1"
              >
                <ToggleGroupItem value="tabbed" className="gap-2 px-3 py-1.5 text-sm data-[state=on]:bg-card">
                  <LayoutGrid className="h-4 w-4" />
                  By Asset Class
                </ToggleGroupItem>
                <ToggleGroupItem value="flat" className="gap-2 px-3 py-1.5 text-sm data-[state=on]:bg-card">
                  <Briefcase className="h-4 w-4" />
                  All Holdings
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {holdingsView === 'tabbed' ? (
              <TabbedHoldings holdings={enrichedHoldings} />
            ) : (
              <HoldingsTable holdings={enrichedHoldings} />
            )}
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

          <TabsContent value="analytics" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <PortfolioAnalytics />
              </div>
              <AIInsightsCard holdings={enrichedHoldings} summary={summary} />
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
              : 'Sample data • Connect your Zerodha account in Data Sources tab'
            }
          </p>
        </div>
      </div>

      {/* AI Assistant FAB */}
      <Button
        onClick={() => setShowAIAssistant(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>

      {/* AI Assistant Panel */}
      <AIAssistantPanel
        holdings={enrichedHoldings}
        summary={summary}
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
      />
    </div>
  );
};

export default Index;
