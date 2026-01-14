import { useMemo } from 'react';
import { Clock, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DataFreshnessIndicatorProps {
  lastSyncAt: string | null | Date;
  source?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

type FreshnessLevel = 'fresh' | 'recent' | 'stale';

export function DataFreshnessIndicator({
  lastSyncAt,
  source,
  showLabel = false,
  size = 'md',
}: DataFreshnessIndicatorProps) {
  const { level, label, daysAgo } = useMemo(() => {
    if (!lastSyncAt) {
      return { level: 'stale' as FreshnessLevel, label: 'Never synced', daysAgo: null };
    }

    const syncDate = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays === 0) {
      return {
        level: 'fresh' as FreshnessLevel,
        label: diffHours === 0 ? 'Just now' : `${diffHours}h ago`,
        daysAgo: 0,
      };
    } else if (diffDays <= 7) {
      return {
        level: 'recent' as FreshnessLevel,
        label: diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`,
        daysAgo: diffDays,
      };
    } else {
      return {
        level: 'stale' as FreshnessLevel,
        label: `${diffDays} days ago`,
        daysAgo: diffDays,
      };
    }
  }, [lastSyncAt]);

  const getIndicatorConfig = () => {
    switch (level) {
      case 'fresh':
        return {
          icon: CheckCircle2,
          className: 'text-profit',
          bgClassName: 'bg-profit/10',
          badgeVariant: 'default' as const,
        };
      case 'recent':
        return {
          icon: Clock,
          className: 'text-yellow-500',
          bgClassName: 'bg-yellow-500/10',
          badgeVariant: 'secondary' as const,
        };
      case 'stale':
        return {
          icon: AlertTriangle,
          className: 'text-loss',
          bgClassName: 'bg-loss/10',
          badgeVariant: 'destructive' as const,
        };
    }
  };

  const config = getIndicatorConfig();
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            <div className={`p-1 rounded-full ${config.bgClassName}`}>
              <Icon className={`${iconSize} ${config.className}`} />
            </div>
            {showLabel && (
              <span className={`text-xs ${config.className}`}>{label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">{source ? `${source} Data` : 'Data Freshness'}</p>
            <p className="text-muted-foreground">
              {lastSyncAt
                ? `Last updated: ${new Date(lastSyncAt).toLocaleString('en-IN')}`
                : 'No sync data available'}
            </p>
            {level === 'stale' && (
              <p className="text-loss text-xs mt-1">
                Data may be outdated. Consider syncing.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Component to show combined freshness for multiple sources
interface MultiSourceFreshnessProps {
  sources: { source: string; lastSyncAt: string | null }[];
}

export function MultiSourceFreshness({ sources }: MultiSourceFreshnessProps) {
  const freshness = useMemo(() => {
    const now = new Date();
    let oldestSync: Date | null = null;
    let freshCount = 0;
    let recentCount = 0;
    let staleCount = 0;

    sources.forEach(({ lastSyncAt }) => {
      if (!lastSyncAt) {
        staleCount++;
        return;
      }

      const syncDate = new Date(lastSyncAt);
      if (!oldestSync || syncDate < oldestSync) {
        oldestSync = syncDate;
      }

      const diffDays = Math.floor((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) freshCount++;
      else if (diffDays <= 7) recentCount++;
      else staleCount++;
    });

    return { freshCount, recentCount, staleCount, oldestSync };
  }, [sources]);

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {freshness.freshCount > 0 && (
        <Badge variant="outline" className="bg-profit/10 text-profit border-profit/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {freshness.freshCount} fresh
        </Badge>
      )}
      {freshness.recentCount > 0 && (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
          <Clock className="h-3 w-3 mr-1" />
          {freshness.recentCount} recent
        </Badge>
      )}
      {freshness.staleCount > 0 && (
        <Badge variant="outline" className="bg-loss/10 text-loss border-loss/30">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {freshness.staleCount} stale
        </Badge>
      )}
    </div>
  );
}
