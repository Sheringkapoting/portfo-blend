import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { EnrichedHolding, AssetType } from '@/types/portfolio';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/portfolioUtils';
import { SourceBadge } from './SourceBadge';
import { RecommendationBadge } from './RecommendationBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  Building2, 
  Coins, 
  BarChart3, 
  Globe, 
  Landmark, 
  CircleDollarSign,
  Home
} from 'lucide-react';

interface AssetClassTableProps {
  assetType: AssetType;
  holdings: EnrichedHolding[];
  delay?: number;
}

// Asset type icons and colors
const ASSET_CONFIG: Record<AssetType, { icon: any; color: string; bgColor: string }> = {
  'Equity': { icon: TrendingUp, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  'Mutual Fund': { icon: BarChart3, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  'ETF': { icon: Building2, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  'SGB': { icon: Coins, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  'Commodity': { icon: CircleDollarSign, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  'Index': { icon: BarChart3, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  'US Stock': { icon: Globe, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  'Bond': { icon: Landmark, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  'REIT': { icon: Home, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
};

// Columns that are specific to certain asset types
const ASSET_SPECIFIC_COLUMNS: Record<AssetType, string[]> = {
  'Equity': ['symbol', 'sector', 'quantity', 'avgPrice', 'ltp', 'investedValue', 'currentValue', 'pnl', 'pnlPercent', 'recommendation'],
  'Mutual Fund': ['symbol', 'quantity', 'avgPrice', 'ltp', 'investedValue', 'currentValue', 'pnl', 'pnlPercent'],
  'ETF': ['symbol', 'sector', 'quantity', 'avgPrice', 'ltp', 'investedValue', 'currentValue', 'pnl', 'pnlPercent'],
  'SGB': ['symbol', 'quantity', 'avgPrice', 'ltp', 'investedValue', 'currentValue', 'pnl', 'pnlPercent'],
  'Commodity': ['symbol', 'quantity', 'avgPrice', 'ltp', 'investedValue', 'currentValue', 'pnl', 'pnlPercent'],
  'Index': ['symbol', 'quantity', 'avgPrice', 'ltp', 'investedValue', 'currentValue', 'pnl', 'pnlPercent'],
  'US Stock': ['symbol', 'quantity', 'avgPrice', 'ltp', 'investedValue', 'currentValue', 'pnl', 'pnlPercent'],
  'Bond': ['symbol', 'quantity', 'avgPrice', 'ltp', 'investedValue', 'currentValue', 'pnl', 'pnlPercent'],
  'REIT': ['symbol', 'sector', 'quantity', 'avgPrice', 'ltp', 'investedValue', 'currentValue', 'pnl', 'pnlPercent'],
};

export function AssetClassTable({ assetType, holdings, delay = 0 }: AssetClassTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'currentValue', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const config = ASSET_CONFIG[assetType] || { icon: BarChart3, color: 'text-muted-foreground', bgColor: 'bg-muted' };
  const Icon = config.icon;
  const visibleColumns = ASSET_SPECIFIC_COLUMNS[assetType] || ['symbol', 'quantity', 'avgPrice', 'ltp', 'currentValue', 'pnl'];

  // Summary calculations
  const summary = useMemo(() => {
    const totalInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
    const totalCurrent = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalPnl = totalCurrent - totalInvested;
    const pnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    return { totalInvested, totalCurrent, totalPnl, pnlPercent, count: holdings.length };
  }, [holdings]);

  const columns = useMemo<ColumnDef<EnrichedHolding>[]>(() => {
    const allColumns: Record<string, ColumnDef<EnrichedHolding>> = {
      symbol: {
        accessorKey: 'symbol',
        header: ({ column }) => <SortableHeader column={column} label="Investment" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{row.original.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{row.original.symbol}</span>
          </div>
        ),
      },
      sector: {
        accessorKey: 'sector',
        header: ({ column }) => <SortableHeader column={column} label="Sector" />,
        cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() as string}</span>,
      },
      quantity: {
        accessorKey: 'quantity',
        header: ({ column }) => <SortableHeader column={column} label="Qty" className="justify-end" />,
        cell: ({ getValue }) => <span className="font-mono-numbers text-sm text-right block">{formatNumber(getValue() as number)}</span>,
      },
      avgPrice: {
        accessorKey: 'avgPrice',
        header: ({ column }) => <SortableHeader column={column} label="Avg Price" className="justify-end" />,
        cell: ({ getValue }) => <span className="font-mono-numbers text-sm text-right block">{formatCurrency(getValue() as number)}</span>,
      },
      ltp: {
        accessorKey: 'ltp',
        header: ({ column }) => <SortableHeader column={column} label="LTP" className="justify-end" />,
        cell: ({ getValue }) => <span className="font-mono-numbers text-sm font-medium text-right block">{formatCurrency(getValue() as number)}</span>,
      },
      investedValue: {
        accessorKey: 'investedValue',
        header: ({ column }) => <SortableHeader column={column} label="Invested" className="justify-end" />,
        cell: ({ getValue }) => <span className="font-mono-numbers text-sm text-right block">{formatCurrency(getValue() as number, true)}</span>,
      },
      currentValue: {
        accessorKey: 'currentValue',
        header: ({ column }) => <SortableHeader column={column} label="Current" className="justify-end" />,
        cell: ({ getValue }) => <span className="font-mono-numbers text-sm font-medium text-right block">{formatCurrency(getValue() as number, true)}</span>,
      },
      pnl: {
        accessorKey: 'pnl',
        header: ({ column }) => <SortableHeader column={column} label="P&L" className="justify-end" />,
        cell: ({ row }) => {
          const pnl = row.original.pnl;
          const isProfit = pnl >= 0;
          return (
            <span className={cn("font-mono-numbers text-sm font-semibold text-right block", isProfit ? "text-profit" : "text-loss")}>
              {isProfit ? '+' : ''}{formatCurrency(pnl, true)}
            </span>
          );
        },
      },
      pnlPercent: {
        accessorKey: 'pnlPercent',
        header: ({ column }) => <SortableHeader column={column} label="P&L %" className="justify-end" />,
        cell: ({ getValue }) => {
          const percent = getValue() as number;
          const isProfit = percent >= 0;
          return (
            <span className={cn("font-mono-numbers text-sm font-semibold text-right block", isProfit ? "text-profit" : "text-loss")}>
              {formatPercent(percent)}
            </span>
          );
        },
      },
      recommendation: {
        accessorKey: 'recommendation',
        header: ({ column }) => <SortableHeader column={column} label="Action" />,
        cell: ({ getValue }) => <RecommendationBadge recommendation={getValue() as any} />,
      },
      source: {
        accessorKey: 'source',
        header: ({ column }) => <SortableHeader column={column} label="Source" />,
        cell: ({ getValue }) => <SourceBadge source={getValue() as any} />,
      },
    };

    return visibleColumns.map(col => allColumns[col]).filter(Boolean);
  }, [visibleColumns]);

  const table = useReactTable({
    data: holdings,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const isProfit = summary.totalPnl >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {/* Header */}
      <div
        className="p-4 border-b border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{assetType}</h3>
              <p className="text-xs text-muted-foreground">{summary.count} holdings</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-muted-foreground">Invested</span>
              <p className="font-mono-numbers font-medium">{formatCurrency(summary.totalInvested, true)}</p>
            </div>
            <div className="text-right hidden md:block">
              <span className="text-xs text-muted-foreground">Current</span>
              <p className="font-mono-numbers font-medium">{formatCurrency(summary.totalCurrent, true)}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">P&L</span>
              <p className={cn("font-mono-numbers font-semibold", isProfit ? "text-profit" : "text-loss")}>
                {isProfit ? '+' : ''}{formatCurrency(summary.totalPnl, true)}
                <span className="text-xs ml-1">({formatPercent(summary.pnlPercent)})</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible content */}
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${assetType.toLowerCase()}...`}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-8 text-sm bg-muted/50 border-border"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/20">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b border-border/50">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="border-b border-border/30 table-row-hover"
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Sortable header component
function SortableHeader({ column, label, className }: { column: any; label: string; className?: string }) {
  const isSorted = column.getIsSorted();
  
  return (
    <button
      onClick={() => column.toggleSorting()}
      className={cn("flex items-center gap-1 hover:text-foreground transition-colors", className)}
    >
      {label}
      {isSorted === 'asc' ? (
        <ArrowUp className="h-3 w-3" />
      ) : isSorted === 'desc' ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}
