import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { EnrichedHolding, Source } from '@/types/portfolio';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/portfolioUtils';
import { SourceBadge } from '../SourceBadge';
import { Badge } from '@/components/ui/badge';
import { BaseAssetTable } from './BaseAssetTable';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface MutualFundsTableProps {
  holdings: EnrichedHolding[];
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
      size: 250,
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
      size: 100,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatNumber(getValue() as number, 3)}
        </span>
      ),
    },
    {
      accessorKey: 'avgPrice',
      header: () => <span className="text-right block">Avg NAV</span>,
      size: 100,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          ₹{(getValue() as number).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'ltp',
      header: () => <span className="text-right block">Current NAV</span>,
      size: 110,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium text-right block">
          ₹{(getValue() as number).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'investedValue',
      header: () => <span className="text-right block">Invested Amount</span>,
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatCurrency(getValue() as number, true)}
        </span>
      ),
    },
    {
      accessorKey: 'currentValue',
      header: () => <span className="text-right block">Current Value</span>,
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium text-right block">
          {formatCurrency(getValue() as number, true)}
        </span>
      ),
    },
    {
      accessorKey: 'pnl',
      header: () => <span className="text-right block">Gain/Loss</span>,
      size: 120,
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
      size: 100,
      cell: ({ row }) => {
        const actualXirr = row.original.xirr;
        const hasActualXirr = actualXirr !== undefined && actualXirr !== null;

        if (!hasActualXirr) {
          return (
            <span className="font-mono text-sm font-semibold text-right block text-muted-foreground">
              -
            </span>
          );
        }

        const isProfit = actualXirr >= 0;
        const isFromExcel = row.original.source === 'INDMoney';

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "font-mono text-sm font-semibold text-right block cursor-help",
                    isProfit ? "text-profit" : "text-loss"
                  )}
                >
                  {isProfit ? '+' : ''}{actualXirr.toFixed(2)}%
                  {isFromExcel && (
                    <span className="ml-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                      IND
                    </span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-[220px]">
                  {isFromExcel
                    ? 'XIRR imported from your INDMoney Excel file'
                    : 'XIRR value from portfolio data'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: 'xirr',
      header: () => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-right block flex items-center justify-end gap-1 cursor-help">
                XIRR
                <Info className="h-3 w-3 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-[200px]">
                XIRR (Extended Internal Rate of Return) is the annualized return considering all cash flows.
                Values from your portfolio data are shown when available.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      size: 100,
      cell: ({ row }) => {
        const actualXirr = row.original.xirr;
        const hasActualXirr = actualXirr !== undefined && actualXirr !== null;

        if (!hasActualXirr) {
          return (
            <span className="font-mono text-sm font-semibold text-right block text-muted-foreground">
              -
            </span>
          );
        }

        const isProfit = actualXirr >= 0;
        const isFromExcel = row.original.source === 'INDMoney';
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(
                  "font-mono text-sm font-semibold text-right block cursor-help",
                  isProfit ? "text-profit" : "text-loss"
                )}>
                  {isProfit ? '+' : ''}{actualXirr.toFixed(2)}%
                  {isFromExcel && (
                    <span className="ml-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                      IND
                    </span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {isFromExcel
                    ? 'XIRR imported from your INDMoney Excel file'
                    : 'XIRR value from portfolio data'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: 'source',
      header: 'Source',
      size: 100,
      cell: ({ getValue }) => (
        <SourceBadge source={getValue() as Source} />
      ),
    },
  ], []);

  return (
    <BaseAssetTable
      holdings={holdings}
      columns={columns}
      searchPlaceholder="Search mutual funds..."
      emptyMessage="No mutual fund holdings found"
      enableColumnResizing={true}
    />
  );
}
