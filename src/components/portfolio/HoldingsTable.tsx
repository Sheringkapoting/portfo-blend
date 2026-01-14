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
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter } from 'lucide-react';
import { EnrichedHolding } from '@/types/portfolio';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/portfolioUtils';
import { SourceBadge } from './SourceBadge';
import { RecommendationBadge } from './RecommendationBadge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface HoldingsTableProps {
  holdings: EnrichedHolding[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const filteredData = useMemo(() => {
    let data = holdings;
    if (typeFilter !== 'all') {
      data = data.filter(h => h.type === typeFilter);
    }
    if (sourceFilter !== 'all') {
      data = data.filter(h => h.source === sourceFilter);
    }
    return data;
  }, [holdings, typeFilter, sourceFilter]);

  const columns = useMemo<ColumnDef<EnrichedHolding>[]>(() => [
    {
      accessorKey: 'symbol',
      header: ({ column }) => (
        <SortableHeader column={column} label="Symbol" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.original.symbol}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {row.original.name}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <SortableHeader column={column} label="Type" />
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'sector',
      header: ({ column }) => (
        <SortableHeader column={column} label="Sector" />
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <SortableHeader column={column} label="Qty" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono-numbers text-sm text-right block">
          {formatNumber(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'avgPrice',
      header: ({ column }) => (
        <SortableHeader column={column} label="Avg Price" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono-numbers text-sm text-right block">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'ltp',
      header: ({ column }) => (
        <SortableHeader column={column} label="LTP" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono-numbers text-sm font-medium text-right block">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'investedValue',
      header: ({ column }) => (
        <SortableHeader column={column} label="Invested" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono-numbers text-sm text-right block">
          {formatCurrency(getValue() as number, true)}
        </span>
      ),
    },
    {
      accessorKey: 'currentValue',
      header: ({ column }) => (
        <SortableHeader column={column} label="Current" className="justify-end" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono-numbers text-sm font-medium text-right block">
          {formatCurrency(getValue() as number, true)}
        </span>
      ),
    },
    {
      accessorKey: 'pnl',
      header: ({ column }) => (
        <SortableHeader column={column} label="P&L" className="justify-end" />
      ),
      cell: ({ row }) => {
        const pnl = row.original.pnl;
        const isProfit = pnl >= 0;
        return (
          <span className={cn(
            "font-mono-numbers text-sm font-semibold text-right block",
            isProfit ? "text-profit" : "text-loss"
          )}>
            {isProfit ? '+' : ''}{formatCurrency(pnl, true)}
          </span>
        );
      },
    },
    {
      accessorKey: 'pnlPercent',
      header: ({ column }) => (
        <SortableHeader column={column} label="P&L %" className="justify-end" />
      ),
      cell: ({ getValue }) => {
        const percent = getValue() as number;
        const isProfit = percent >= 0;
        return (
          <span className={cn(
            "font-mono-numbers text-sm font-semibold text-right block",
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

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const uniqueTypes = useMemo(() => 
    [...new Set(holdings.map(h => h.type))].sort(), 
    [holdings]
  );
  
  const uniqueSources = useMemo(() => 
    [...new Set(holdings.map(h => h.source))].sort(), 
    [holdings]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {/* Table Header with Filters */}
      <div className="p-4 border-b border-border bg-card/50">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search holdings..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 bg-muted/50 border-border focus:border-primary"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] bg-muted/50 border-border">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px] bg-muted/50 border-border">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-border bg-muted/30">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                className="border-b border-border/50 table-row-hover"
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Table Footer */}
      <div className="p-4 border-t border-border bg-muted/20">
        <span className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {holdings.length} holdings
        </span>
      </div>
    </motion.div>
  );
}

// Sortable Header Component
function SortableHeader({ 
  column, 
  label, 
  className 
}: { 
  column: any; 
  label: string; 
  className?: string;
}) {
  const isSorted = column.getIsSorted();
  
  return (
    <button
      onClick={() => column.toggleSorting()}
      className={cn(
        "flex items-center gap-1 hover:text-foreground transition-colors",
        className
      )}
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
