import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/portfolioUtils';

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  percentChange?: number;
  icon: LucideIcon;
  variant?: 'default' | 'profit' | 'loss' | 'neutral';
  delay?: number;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  percentChange, 
  icon: Icon, 
  variant = 'default',
  delay = 0 
}: StatCardProps) {
  const isProfit = variant === 'profit' || (variant === 'default' && percentChange && percentChange > 0);
  const isLoss = variant === 'loss' || (variant === 'default' && percentChange && percentChange < 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-6",
        "transition-all duration-300 hover:border-primary/30",
        isProfit && "glow-profit",
        isLoss && "glow-loss"
      )}
    >
      {/* Background gradient */}
      <div 
        className={cn(
          "absolute inset-0 opacity-10",
          isProfit && "bg-gradient-to-br from-profit/20 to-transparent",
          isLoss && "bg-gradient-to-br from-loss/20 to-transparent",
          !isProfit && !isLoss && "bg-gradient-to-br from-primary/10 to-transparent"
        )}
      />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <div className={cn(
            "p-2 rounded-lg",
            isProfit && "bg-profit/10",
            isLoss && "bg-loss/10",
            !isProfit && !isLoss && "bg-primary/10"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              isProfit && "text-profit",
              isLoss && "text-loss",
              !isProfit && !isLoss && "text-primary"
            )} />
          </div>
        </div>
        
        <div className="space-y-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: delay + 0.2 }}
            className="font-mono-numbers text-3xl font-bold tracking-tight"
          >
            {formatCurrency(value, true)}
          </motion.div>
          
          {percentChange !== undefined && (
            <div className={cn(
              "flex items-center gap-2 text-sm font-medium font-mono-numbers",
              isProfit && "text-profit",
              isLoss && "text-loss",
              !isProfit && !isLoss && "text-muted-foreground"
            )}>
              <span>{formatPercent(percentChange)}</span>
              {subtitle && (
                <span className="text-muted-foreground font-normal">{subtitle}</span>
              )}
            </div>
          )}
          
          {!percentChange && subtitle && (
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
