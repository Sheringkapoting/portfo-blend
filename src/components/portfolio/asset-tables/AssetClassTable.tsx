import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { EnrichedHolding } from '@/types/portfolio';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/portfolioUtils';
import { SourceBadge } from '../SourceBadge';
import { RecommendationBadge } from '../RecommendationBadge';
import { BaseAssetTable } from './BaseAssetTable';
import { cn } from '@/lib/utils';

interface AssetClassTableProps {
  holdings: EnrichedHolding[];
  assetType: string;
}

export function AssetClassTable({ holdings, assetType }: AssetClassTableProps) {
  const columns = useMemo<ColumnDef<EnrichedHolding>[]>(() => [
    {
      accessorKey: 'symbol',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex flex-col min-w-[150px]">
          <span className="font-semibold text-foreground">{row.original.name}</span>
          <span className="text-xs text-muted-foreground font-mono">
            {row.original.symbol}
          </span>
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
      header: () => <span className="text-right block">Qty</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatNumber(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'avgPrice',
      header: () => <span className="text-right block">Avg Price</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'ltp',
      header: () => <span className="text-right block">LTP</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium text-right block">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'investedValue',
      header: () => <span className="text-right block">Invested Amount</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatCurrency(getValue() as number, true)}
        </span>
      ),
    },
    {
      accessorKey: 'currentValue',
      header: () => <span className="text-right block">Current Value</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium text-right block">
          {formatCurrency(getValue() as number, true)}
        </span>
      ),
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
      accessorKey: 'recommendation',
      header: 'Action',
      cell: ({ getValue }) => (
        <RecommendationBadge recommendation={getValue() as any} />
      ),
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
      searchPlaceholder={`Search ${assetType}...`}
      emptyMessage={`No ${assetType} holdings found`}
    />
  );
}
