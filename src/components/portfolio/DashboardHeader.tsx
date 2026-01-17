import { motion } from 'framer-motion';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UserMenu } from './UserMenu';
import { SyncHealthIndicator } from './SyncHealthIndicator';

interface SourceStatus {
  source: string;
  lastSuccessAt: Date | null;
  holdingsCount: number | null;
  status: 'success' | 'failed' | 'never';
}

interface DashboardHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  sourceStatuses?: SourceStatus[];
  getTimeAgo?: (date: Date | null) => string;
}

export function DashboardHeader({ 
  onRefresh,
  isRefreshing = false,
  sourceStatuses = [],
  getTimeAgo = () => 'Never',
}: DashboardHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full"
    >
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Portfolio Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Consolidated view of your investments
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Sync Health Indicators */}
        <SyncHealthIndicator 
          sourceStatuses={sourceStatuses} 
          getTimeAgo={getTimeAgo} 
        />
        
        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCcw className={cn(
            "h-4 w-4",
            isRefreshing && "animate-spin"
          )} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        {/* User Menu */}
        <UserMenu />
      </div>
    </motion.div>
  );
}
