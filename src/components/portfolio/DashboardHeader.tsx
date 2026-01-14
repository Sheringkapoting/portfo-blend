import { motion } from 'framer-motion';
import { RefreshCcw, Clock, Wifi, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UserMenu } from './UserMenu';

interface DashboardHeaderProps {
  lastUpdated?: Date;
  isLive?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DashboardHeader({ 
  lastUpdated, 
  isLive = false, 
  onRefresh,
  isRefreshing = false 
}: DashboardHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
    >
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Portfolio Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Consolidated view of your investments
        </p>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
          isLive 
            ? "bg-profit/10 text-profit" 
            : "bg-muted text-muted-foreground"
        )}>
          {isLive ? (
            <>
              <Wifi className="h-4 w-4" />
              <span className="hidden sm:inline">Live</span>
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Cached</span>
            </>
          )}
        </div>
        
        {/* Last Updated */}
        {lastUpdated && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Updated:</span>
            <span className="font-mono-numbers">
              {lastUpdated.toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        )}
        
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
