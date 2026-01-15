import { useMemo, useState } from 'react';
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
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { EnrichedHolding } from '@/types/portfolio';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface BaseAssetTableProps<T extends EnrichedHolding> {
  holdings: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export function BaseAssetTable<T extends EnrichedHolding>({
  holdings,
  columns,
  searchPlaceholder = 'Search holdings...',
  emptyMessage = 'No holdings found',
}: BaseAssetTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

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

  if (holdings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-9 h-9 text-sm bg-background/50"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className={cn(
                      "px-3 py-2 text-left font-medium text-muted-foreground",
                      header.column.getCanSort() && "cursor-pointer hover:text-foreground select-none"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="ml-1">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-2.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-right pt-2">
        Showing {table.getRowModel().rows.length} of {holdings.length} holdings
      </div>
    </div>
  );
}

// Reusable column helper for P&L display
export function createPnLCell(pnl: number, showSign = true) {
  const isProfit = pnl >= 0;
  return (
    <span className={cn(
      "font-mono text-sm font-semibold",
      isProfit ? "text-profit" : "text-loss"
    )}>
      {showSign && isProfit ? '+' : ''}{pnl.toFixed(2)}
    </span>
  );
}

export function createPercentCell(percent: number) {
  const isProfit = percent >= 0;
  return (
    <span className={cn(
      "font-mono text-sm font-semibold",
      isProfit ? "text-profit" : "text-loss"
    )}>
      {isProfit ? '+' : ''}{percent.toFixed(2)}%
    </span>
  );
}
