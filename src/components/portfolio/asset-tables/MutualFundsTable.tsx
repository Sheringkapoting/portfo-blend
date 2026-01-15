import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { EnrichedHolding } from '@/types/portfolio';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/portfolioUtils';
import { SourceBadge } from '../SourceBadge';
import { Badge } from '@/components/ui/badge';
import { BaseAssetTable } from './BaseAssetTable';
import { cn } from '@/lib/utils';

interface MutualFundsTableProps {
  holdings: EnrichedHolding[];
}

// Calculate estimated XIRR (simplified - actual XIRR requires date-based calculation)
function calculateEstimatedXIRR(holding: EnrichedHolding): number {
  // Simplified XIRR estimation based on absolute returns and assumed holding period
  // In a real scenario, this would need purchase dates
  const absoluteReturn = holding.pnlPercent / 100;
  const assumedYears = 1; // Assume 1 year holding for estimation
  const xirr = (Math.pow(1 + absoluteReturn, 1 / assumedYears) - 1) * 100;
  return xirr;
}

// Get MF category from type or name
function getMFCategory(holding: EnrichedHolding): string {
  const type = holding.type as string;
  const name = holding.name.toLowerCase();
  
  if (type.includes('Debt') || name.includes('debt') || name.includes('liquid') || name.includes('money market')) {
    return 'Debt';
  }
  if (type.includes('Equity') || name.includes('equity') || name.includes('flexi cap') || name.includes('large cap') || name.includes('mid cap') || name.includes('small cap')) {
    return 'Equity';
  }
  if (type.includes('Hybrid') || name.includes('hybrid') || name.includes('balanced')) {
    return 'Hybrid';
  }
  if (type.includes('Index') || name.includes('index') || name.includes('nifty') || name.includes('sensex')) {
    return 'Index';
  }
  if (type.includes('Commodity') || name.includes('gold') || name.includes('silver')) {
    return 'Commodity';
  }
  return 'Other';
}

export function MutualFundsTable({ holdings }: MutualFundsTableProps) {
  const columns = useMemo<ColumnDef<EnrichedHolding>[]>(() => [
    {
      accessorKey: 'symbol',
      header: 'Fund Name',
      cell: ({ row }) => {
        const category = getMFCategory(row.original);
        return (
          <div className="flex flex-col min-w-[200px]">
            <span className="font-semibold text-foreground line-clamp-2">{row.original.name}</span>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {category}
              </Badge>
              {row.original.isin && (
                <span className="text-xs text-muted-foreground font-mono">{row.original.isin}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'quantity',
      header: () => <span className="text-right block">Units</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatNumber(getValue() as number, 3)}
        </span>
      ),
    },
    {
      accessorKey: 'avgPrice',
      header: () => <span className="text-right block">Avg NAV</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          ₹{(getValue() as number).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'ltp',
      header: () => <span className="text-right block">Current NAV</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium text-right block">
          ₹{(getValue() as number).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'investedValue',
      header: () => <span className="text-right block">Invested</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatCurrency(getValue() as number, true)}
        </span>
      ),
    },
    {
      accessorKey: 'currentValue',
      header: () => <span className="text-right block">Current</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium text-right block">
          {formatCurrency(getValue() as number, true)}
        </span>
      ),
    },
    {
      accessorKey: 'pnl',
      header: () => <span className="text-right block">Gain/Loss</span>,
      cell: ({ row }) => {
        const pnl = row.original.pnl;
        const isProfit = pnl >= 0;
        return (
          <span className={cn(
            "font-mono text-sm font-semibold text-right block",
            isProfit ? "text-profit" : "text-loss"
          )}>
            {isProfit ? '+' : ''}{formatCurrency(pnl, true)}
          </span>
        );
      },
    },
    {
      accessorKey: 'pnlPercent',
      header: () => <span className="text-right block">Absolute</span>,
      cell: ({ getValue }) => {
        const percent = getValue() as number;
        const isProfit = percent >= 0;
        return (
          <span className={cn(
            "font-mono text-sm font-semibold text-right block",
            isProfit ? "text-profit" : "text-loss"
          )}>
            {formatPercent(percent)}
          </span>
        );
      },
    },
    {
      id: 'xirr',
      header: () => <span className="text-right block">XIRR (Est.)</span>,
      cell: ({ row }) => {
        const xirr = calculateEstimatedXIRR(row.original);
        const isProfit = xirr >= 0;
        return (
          <span className={cn(
            "font-mono text-sm font-semibold text-right block",
            isProfit ? "text-profit" : "text-loss"
          )}>
            {isProfit ? '+' : ''}{xirr.toFixed(2)}%
          </span>
        );
      },
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ getValue }) => (
        <SourceBadge source={getValue() as any} />
      ),
    },
  ], []);

  return (
    <BaseAssetTable
      holdings={holdings}
      columns={columns}
      searchPlaceholder="Search mutual funds..."
      emptyMessage="No mutual fund holdings found"
    />
  );
}
