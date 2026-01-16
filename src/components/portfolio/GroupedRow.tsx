import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/portfolioUtils';

interface GroupSummary {
  count: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

interface GroupedRowProps {
  groupKey: string;
  groupValue: string;
  level: number;
  isExpanded: boolean;
  onToggle: () => void;
  summary: GroupSummary;
  columnCount: number;
  children?: ReactNode;
}

export function GroupedRow({
  groupKey,
  groupValue,
  level,
  isExpanded,
  onToggle,
  summary,
  columnCount,
  children,
}: GroupedRowProps) {
  const isProfit = summary.pnl >= 0;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "border-b border-border/50 cursor-pointer transition-colors",
          "bg-muted/40 hover:bg-muted/60",
          level > 0 && "bg-muted/20"
        )}
        onClick={onToggle}
      >
        <td
          colSpan={columnCount}
          className="px-4 py-3"
        >
          <div
            className="flex items-center gap-3"
            style={{ paddingLeft: `${level * 20}px` }}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              className="text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </motion.div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{groupValue}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {summary.count} {summary.count === 1 ? 'holding' : 'holdings'}
              </span>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <span className="text-muted-foreground text-xs">Invested Amount</span>
                <p className="font-mono-numbers font-medium">
                  {formatCurrency(summary.investedValue, true)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground text-xs">Current Value</span>
                <p className="font-mono-numbers font-medium">
                  {formatCurrency(summary.currentValue, true)}
                </p>
              </div>
              <div className="text-right min-w-[80px]">
                <span className="text-muted-foreground text-xs">P&L</span>
                <p className={cn(
                  "font-mono-numbers font-semibold",
                  isProfit ? "text-profit" : "text-loss"
                )}>
                  {isProfit ? '+' : ''}{formatCurrency(summary.pnl, true)}
                  <span className="text-xs ml-1">
                    ({formatPercent(summary.pnlPercent)})
                  </span>
                </p>
              </div>
            </div>
          </div>
        </td>
      </motion.tr>

      <AnimatePresence>
        {isExpanded && children}
      </AnimatePresence>
    </>
  );
}
