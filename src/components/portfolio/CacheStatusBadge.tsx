import { motion } from 'framer-motion';
import { Database, RefreshCw, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CacheStatusBadgeProps {
  cacheTimestamp: Date | null;
  getCacheAge: () => string | null;
  isLoadingCache: boolean;
  isUsingCache: boolean;
  onRefresh: () => void;
}

export function CacheStatusBadge({
  cacheTimestamp,
  getCacheAge,
  isLoadingCache,
  isUsingCache,
  onRefresh,
}: CacheStatusBadgeProps) {
  const cacheAge = getCacheAge();

  if (!isUsingCache && !cacheTimestamp) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <Badge variant="outline" className="bg-muted/50 text-muted-foreground gap-1.5 py-1">
              <Database className="h-3 w-3" />
              <span className="text-xs">
                {isLoadingCache ? 'Loading...' : cacheAge || 'Cached'}
              </span>
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRefresh}
              disabled={isLoadingCache}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCache ? 'animate-spin' : ''}`} />
            </Button>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          <div className="text-sm space-y-1">
            <p className="font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Cached Data
            </p>
            {cacheTimestamp && (
              <p className="text-muted-foreground text-xs">
                Snapshot from: {cacheTimestamp.toLocaleString('en-IN')}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Click refresh to get live data
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
