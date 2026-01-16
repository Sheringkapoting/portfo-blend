import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { EnrichedHolding } from '@/types/portfolio';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/portfolioUtils';
import { SourceBadge } from '../SourceBadge';
import { BaseAssetTable } from './BaseAssetTable';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Coins } from 'lucide-react';

interface SGBTableProps {
  holdings: EnrichedHolding[];
}

// Parse SGB series from name
function getSGBSeries(name: string): string {
  const match = name.match(/\d{4}-\d{2}/);
  return match ? match[0] : 'N/A';
}

export function SGBTable({ holdings }: SGBTableProps) {
  const columns = useMemo<ColumnDef<EnrichedHolding>[]>(() => [
    {
      accessorKey: 'symbol',
      header: 'Bond',
      cell: ({ row }) => {
        const series = getSGBSeries(row.original.name);
        return (
          <div className="flex flex-col min-w-[180px]">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold text-foreground">{row.original.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Badge variant="outline" className="text-xs px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                Series {series}
              </Badge>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'quantity',
      header: () => <span className="text-right block">Units (gm)</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatNumber(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'avgPrice',
      header: () => <span className="text-right block">Issue Price</span>,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'ltp',
      header: () => <span className="text-right block">Current Price</span>,
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
      header: () => <span className="text-right block">Capital Gain</span>,
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
      id: 'interestRate',
      header: () => <span className="text-right block">Interest</span>,
      cell: () => (
        <span className="font-mono text-sm text-right block text-yellow-600">
          2.50% p.a.
        </span>
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
      searchPlaceholder="Search SGBs..."
      emptyMessage="No Sovereign Gold Bond holdings found"
    />
  );
}
