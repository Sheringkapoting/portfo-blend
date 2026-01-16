import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown,
  PieChart,
  Shield,
  Lightbulb,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EnrichedHolding, PortfolioSummary } from '@/types/portfolio';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency, formatPercent } from '@/lib/portfolioUtils';

interface PortfolioAnalysis {
  sectorConcentration: {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    topSector: string;
    percentage: number;
  };
  riskExposure: {
    level: 'low' | 'moderate' | 'high';
    message: string;
  };
  diversificationScore: {
    score: number;
    message: string;
  };
  topPerformers: Array<{
    name: string;
    symbol: string;
    returnPercent: number;
  }>;
  underperformers: Array<{
    name: string;
    symbol: string;
    returnPercent: number;
  }>;
  recommendations: Array<{
    type: 'rebalance' | 'accumulate' | 'trim' | 'diversify';
    title: string;
    description: string;
  }>;
  overallHealth: {
    status: 'excellent' | 'good' | 'fair' | 'needs_attention';
    summary: string;
  };
}

interface AIInsightsCardProps {
  holdings: EnrichedHolding[];
  summary: PortfolioSummary;
}

const statusColors = {
  excellent: 'text-profit',
  good: 'text-green-400',
  fair: 'text-yellow-500',
  needs_attention: 'text-loss',
  healthy: 'text-profit',
  warning: 'text-yellow-500',
  critical: 'text-loss',
  low: 'text-profit',
  moderate: 'text-yellow-500',
  high: 'text-loss',
};

const statusBadgeColors = {
  excellent: 'bg-profit/20 text-profit border-profit/30',
  good: 'bg-green-500/20 text-green-400 border-green-500/30',
  fair: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  needs_attention: 'bg-loss/20 text-loss border-loss/30',
};

export function AIInsightsCard({ holdings, summary }: AIInsightsCardProps) {
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);

  const fetchAnalysis = async () => {
    if (holdings.length === 0) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const portfolioData = {
        summary,
        holdings: holdings.map(h => ({
          name: h.name,
          symbol: h.symbol,
          sector: h.sector,
          type: h.type,
          investedValue: h.investedValue,
          currentValue: h.currentValue,
          pnlPercent: h.pnlPercent,
          source: h.source,
        })),
        sectorBreakdown: holdings.reduce((acc, h) => {
          acc[h.sector] = (acc[h.sector] || 0) + h.currentValue;
          return acc;
        }, {} as Record<string, number>),
      };

      const { data, error: fnError } = await supabase.functions.invoke('portfolio-analysis', {
        body: { portfolioData },
      });

      if (fnError) throw fnError;
      
      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(data.analysis);
      setLastAnalyzed(new Date());
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze portfolio');
      toast.error('Failed to generate insights');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch on mount if we have holdings
  useEffect(() => {
    if (holdings.length > 0 && !analysis && !isLoading) {
      fetchAnalysis();
    }
  }, [holdings.length]);

  if (holdings.length === 0) {
    return null;
  }

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">AI Portfolio Insights</CardTitle>
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAnalysis}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            {analysis ? 'Refresh' : 'Analyze'}
          </Button>
        </div>
        {lastAnalyzed && (
          <p className="text-xs text-muted-foreground mt-1">
            Last analyzed: {lastAnalyzed.toLocaleTimeString()}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchAnalysis}>
              Try Again
            </Button>
          </div>
        ) : !analysis ? (
          <div className="text-center py-6">
            <Sparkles className="h-8 w-8 text-primary/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Click Analyze to get AI-powered insights about your portfolio
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Overall Health */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Portfolio Health</span>
                <Badge className={statusBadgeColors[analysis.overallHealth.status]}>
                  {analysis.overallHealth.status.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{analysis.overallHealth.summary}</p>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-3 gap-2">
              {/* Diversification Score */}
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <PieChart className="h-4 w-4 mx-auto mb-1 text-primary" />
                <div className="text-lg font-bold">{analysis.diversificationScore.score}/10</div>
                <p className="text-xs text-muted-foreground">Diversification</p>
              </div>

              {/* Risk Level */}
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <Shield className={`h-4 w-4 mx-auto mb-1 ${statusColors[analysis.riskExposure.level]}`} />
                <div className={`text-lg font-bold capitalize ${statusColors[analysis.riskExposure.level]}`}>
                  {analysis.riskExposure.level}
                </div>
                <p className="text-xs text-muted-foreground">Risk Level</p>
              </div>

              {/* Sector Concentration */}
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <AlertTriangle className={`h-4 w-4 mx-auto mb-1 ${statusColors[analysis.sectorConcentration.status]}`} />
                <div className="text-lg font-bold">{analysis.sectorConcentration.percentage.toFixed(0)}%</div>
                <p className="text-xs text-muted-foreground">{analysis.sectorConcentration.topSector}</p>
              </div>
            </div>

            {/* Top Performers & Underperformers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-sm font-medium text-profit">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Top Performers
                </div>
                {analysis.topPerformers.slice(0, 3).map((stock, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="truncate">{stock.symbol}</span>
                    <span className="text-profit font-medium">
                      +{stock.returnPercent.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-sm font-medium text-loss">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Need Attention
                </div>
                {analysis.underperformers.slice(0, 3).map((stock, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="truncate">{stock.symbol}</span>
                    <span className="text-loss font-medium">
                      {stock.returnPercent.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                  Recommendations
                </div>
                {analysis.recommendations.map((rec, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {rec.type}
                      </Badge>
                      <span className="text-xs font-medium">{rec.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.description}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
