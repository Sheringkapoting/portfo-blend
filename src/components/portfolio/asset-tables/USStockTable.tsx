import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { EnrichedHolding } from '@/types/portfolio';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/portfolioUtils';
import { SourceBadge } from '../SourceBadge';
import { BaseAssetTable } from './BaseAssetTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Globe, RefreshCw, AlertCircle } from 'lucide-react';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface USStockTableProps {
  holdings: EnrichedHolding[];
}

// Format USD value
function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function USStockTable({ holdings }: USStockTableProps) {
  const { rate, isLoading, lastUpdated, source, refresh, error } = useExchangeRate('USD', 'INR');
  
  // Convert INR to USD using the fetched rate
  const convertToUSD = (inrValue: number): number => {
    if (!rate || rate === 0) return inrValue / 83.5; // Fallback
    return inrValue / rate;
  };

  const columns = useMemo<ColumnDef<EnrichedHolding>[]>(() => [
    {
      accessorKey: 'symbol',
      header: 'Stock',
      size: 200,
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
      size: 120,
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'quantity',
      header: () => <span className="text-right block">Shares</span>,
      size: 90,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-right block">
          {formatNumber(getValue() as number, 4)}
        </span>
      ),
    },
    {
      accessorKey: 'avgPrice',
      header: () => <span className="text-right block">Avg Price</span>,
      size: 130,
      cell: ({ getValue }) => {
        const inrValue = getValue() as number;
        const usdValue = convertToUSD(inrValue);
        return (
          <div className="text-right">
            <span className="font-mono text-sm block">
              {formatCurrency(inrValue)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatUSD(usdValue)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'ltp',
      header: () => <span className="text-right block">LTP</span>,
      size: 130,
      cell: ({ getValue }) => {
        const inrValue = getValue() as number;
        const usdValue = convertToUSD(inrValue);
        return (
          <div className="text-right">
            <span className="font-mono text-sm font-medium block">
              {formatCurrency(inrValue)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatUSD(usdValue)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'investedValue',
      header: () => <span className="text-right block">Invested Amount</span>,
      size: 140,
      cell: ({ getValue }) => {
        const inrValue = getValue() as number;
        const usdValue = convertToUSD(inrValue);
        return (
          <div className="text-right">
            <span className="font-mono text-sm block">
              {formatCurrency(inrValue, true)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatUSD(usdValue)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'currentValue',
      header: () => <span className="text-right block">Current Value</span>,
      size: 140,
      cell: ({ getValue }) => {
        const inrValue = getValue() as number;
        const usdValue = convertToUSD(inrValue);
        return (
          <div className="text-right">
            <span className="font-mono text-sm font-medium block">
              {formatCurrency(inrValue, true)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatUSD(usdValue)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'pnl',
      header: () => <span className="text-right block">P&L</span>,
      size: 130,
      cell: ({ row }) => {
        const pnl = row.original.pnl;
        const pnlUsd = convertToUSD(pnl);
        const isProfit = pnl >= 0;
        return (
          <div className="text-right">
            <span className={cn(
              "font-mono text-sm font-semibold block",
              isProfit ? "text-profit" : "text-loss"
            )}>
              {isProfit ? '+' : ''}{formatCurrency(pnl, true)}
            </span>
            <span className={cn(
              "font-mono text-xs",
              isProfit ? "text-profit/70" : "text-loss/70"
            )}>
              {isProfit ? '+' : ''}{formatUSD(pnlUsd)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'pnlPercent',
      header: () => <span className="text-right block">Returns</span>,
      size: 100,
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
      size: 100,
      cell: ({ getValue }) => (
        <SourceBadge source={getValue() as any} />
      ),
    },
  ], [rate]);

  return (
    <div className="space-y-3">
      {/* Exchange Rate Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>USD/INR:</span>
          <span className="font-mono font-medium text-foreground">
            {isLoading ? '...' : rate?.toFixed(2) || '83.50'}
          </span>
          {source && source !== 'api' && source !== 'cache' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Using {source === 'fallback' ? 'fallback' : 'cached'} rate</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {lastUpdated && (
            <span className="text-xs text-muted-foreground/70">
              (Updated: {lastUpdated.toLocaleTimeString()})
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isLoading}
          className="h-7 px-2 text-xs"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isLoading && "animate-spin")} />
          Refresh Rate
        </Button>
      </div>

      <BaseAssetTable
        holdings={holdings}
        columns={columns}
        searchPlaceholder="Search US stocks..."
        emptyMessage="No US stock holdings found"
        enableColumnResizing={true}
      />
    </div>
  );
}
