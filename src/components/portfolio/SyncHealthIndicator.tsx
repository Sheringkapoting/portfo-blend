import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SourceStatus {
  source: string;
  lastSuccessAt: Date | null;
  holdingsCount: number | null;
  status: 'success' | 'failed' | 'never';
}

interface SyncHealthIndicatorProps {
  sourceStatuses: SourceStatus[];
  getTimeAgo: (date: Date | null) => string;
}

export function SyncHealthIndicator({ sourceStatuses, getTimeAgo }: SyncHealthIndicatorProps) {
  if (sourceStatuses.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {sourceStatuses.map((source, index) => {
          const timeAgo = getTimeAgo(source.lastSuccessAt);
          const isRecent = source.lastSuccessAt && 
            (Date.now() - source.lastSuccessAt.getTime()) < 3600000; // Less than 1 hour
          
          return (
            <Tooltip key={source.source}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-default",
                    isRecent
                      ? "bg-profit/10 text-profit"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isRecent ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : source.lastSuccessAt ? (
                    <Clock className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  <span>{source.source}</span>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <p className="font-medium">{source.source}</p>
                  <p>Last synced: {timeAgo}</p>
                  {source.holdingsCount !== null && (
                    <p>{source.holdingsCount} holdings</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
