import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { EnrichedHolding } from '@/types/portfolio';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/portfolioUtils';
import { SourceBadge } from '../SourceBadge';
import { RecommendationBadge } from '../RecommendationBadge';
import { BaseAssetTable } from './BaseAssetTable';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Globe } from 'lucide-react';

interface USStockTableProps {
  holdings: EnrichedHolding[];
}

// Format USD (for display purposes, assuming INR conversion already done)
function formatUSD(value: number): string {
  // Assuming 1 USD = 83 INR approximately
  const usdValue = value / 83;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdValue);
}

export function USStockTable({ holdings }: USStockTableProps) {
  const columns = useMemo<ColumnDef<EnrichedHolding>[]>(() => [
    {
      accessorKey: 'symbol',
      header: 'Stock',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[180px]">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{row.original.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="font-mono">{row.original.symbol}</span>
            <Badge variant="outline" className="text-xs px-1 py-0">
              {row.original.exchange || 'US'}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'sector',
      header: 'Sector',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'quantity',
      header: () => <span className="text-right block">Shares</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatNumber(getValue() as number, 4)}
        </span>
      ),
    },
    {
      accessorKey: 'avgPrice',
      header: () => <span className="text-right block">Avg (₹)</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'ltp',
      header: () => <span className="text-right block">LTP (₹)</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium text-right block">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'investedValue',
      header: () => <span className="text-right block">Invested</span>,
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return (
          <div className="text-right">
            <span className="font-mono text-sm block">
              {formatCurrency(value, true)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatUSD(value)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'currentValue',
      header: () => <span className="text-right block">Current</span>,
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return (
          <div className="text-right">
            <span className="font-mono text-sm font-medium block">
              {formatCurrency(value, true)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatUSD(value)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'pnl',
      header: () => <span className="text-right block">P&L</span>,
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
      header: () => <span className="text-right block">Returns</span>,
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
      searchPlaceholder="Search US stocks..."
      emptyMessage="No US stock holdings found"
    />
  );
}
