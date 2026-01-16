import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  FilterFn,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, X, GripVertical } from 'lucide-react';
import { EnrichedHolding } from '@/types/portfolio';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface BaseAssetTableProps<T extends EnrichedHolding> {
  holdings: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  enableColumnResizing?: boolean;
  filterOptions?: {
    sectors?: string[];
    sources?: string[];
  };
}

type SortPreset = 'default' | 'returns_high' | 'returns_low' | 'invested_high' | 'invested_low' | 'pnl_high' | 'pnl_low';

const SORT_PRESETS: Record<SortPreset, { label: string; sorting: SortingState }> = {
  default: { label: 'Default', sorting: [] },
  returns_high: { label: 'Returns (High to Low)', sorting: [{ id: 'pnlPercent', desc: true }] },
  returns_low: { label: 'Returns (Low to High)', sorting: [{ id: 'pnlPercent', desc: false }] },
  invested_high: { label: 'Invested (High to Low)', sorting: [{ id: 'investedValue', desc: true }] },
  invested_low: { label: 'Invested (Low to High)', sorting: [{ id: 'investedValue', desc: false }] },
  pnl_high: { label: 'P&L (High to Low)', sorting: [{ id: 'pnl', desc: true }] },
  pnl_low: { label: 'P&L (Low to High)', sorting: [{ id: 'pnl', desc: false }] },
};

const MIN_COLUMN_WIDTH = 60;
const DEFAULT_COLUMN_WIDTH = 120;

const globalSearchFn: FilterFn<EnrichedHolding> = (row, _columnId, filterValue) => {
  const query = String(filterValue || '').trim().toLowerCase();
  if (!query) return true;

  try {
    const h = row.original;
    if (!h) return true;

    const text = [
      h.name,
      h.symbol,
      h.sector,
      h.type,
      h.source,
      h.exchange,
      h.isin,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return text.includes(query);
  } catch {
    return true;
  }
};

export function BaseAssetTable<T extends EnrichedHolding>({
  holdings,
  columns,
  searchPlaceholder = 'Search holdings...',
  emptyMessage = 'No holdings found',
  enableColumnResizing = true,
  filterOptions,
}: BaseAssetTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sortPreset, setSortPreset] = useState<SortPreset>('default');

  // Extract unique sectors and sources from data
  const { availableSectors, availableSources } = useMemo(() => {
    const sectors = new Set<string>();
    const sources = new Set<string>();
    holdings.forEach(h => {
      if (h.sector) sectors.add(h.sector as string);
      if (h.source) sources.add(h.source as string);
    });
    return {
      availableSectors: filterOptions?.sectors || Array.from(sectors).sort(),
      availableSources: filterOptions?.sources || Array.from(sources).sort(),
    };
  }, [holdings, filterOptions]);

  // Filter holdings based on selected filters
  const filteredHoldings = useMemo(() => {
    return holdings.filter(h => {
      if (selectedSectors.size > 0 && !selectedSectors.has(h.sector as string)) {
        return false;
      }
      if (selectedSources.size > 0 && !selectedSources.has(h.source as string)) {
        return false;
      }
      return true;
    });
  }, [holdings, selectedSectors, selectedSources]);

  // Apply sort preset
  const handleSortPresetChange = useCallback((preset: SortPreset) => {
    setSortPreset(preset);
    setSorting(SORT_PRESETS[preset].sorting);
  }, []);

  // Toggle sector filter
  const toggleSector = useCallback((sector: string) => {
    setSelectedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) {
        next.delete(sector);
      } else {
        next.add(sector);
      }
      return next;
    });
  }, []);

  // Toggle source filter
  const toggleSource = useCallback((source: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedSectors(new Set());
    setSelectedSources(new Set());
    setGlobalFilter('');
    setSortPreset('default');
    setSorting([]);
  }, []);

  const hasActiveFilters = selectedSectors.size > 0 || selectedSources.size > 0 || globalFilter.length > 0;

  // Enhanced columns with resizing
  const enhancedColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      minSize: MIN_COLUMN_WIDTH,
      size: columnSizing[(col as any).accessorKey || (col as any).id] || DEFAULT_COLUMN_WIDTH,
      enableResizing: enableColumnResizing,
    }));
  }, [columns, columnSizing, enableColumnResizing]);

  const table = useReactTable({
    data: filteredHoldings,
    columns: enhancedColumns,
    state: { sorting, globalFilter, columnFilters, columnSizing },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: globalSearchFn,
    enableColumnResizing,
    columnResizeMode: 'onChange',
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-9 text-sm bg-background/50"
          />
        </div>

        {/* Sort Preset */}
        <Select value={sortPreset} onValueChange={(v) => handleSortPresetChange(v as SortPreset)}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_PRESETS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sector Filter */}
        {availableSectors.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Sector
                {selectedSectors.size > 0 && (
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                    {selectedSectors.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-popover">
              <DropdownMenuLabel>Filter by Sector</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableSectors.map(sector => (
                <DropdownMenuCheckboxItem
                  key={sector}
                  checked={selectedSectors.has(sector)}
                  onCheckedChange={() => toggleSector(sector)}
                >
                  {sector}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Source Filter */}
        {availableSources.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Source
                {selectedSources.size > 0 && (
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                    {selectedSources.size}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40 bg-popover">
              <DropdownMenuLabel>Filter by Source</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableSources.map(source => (
                <DropdownMenuCheckboxItem
                  key={source}
                  checked={selectedSources.has(source)}
                  onCheckedChange={() => toggleSource(source)}
                >
                  {source}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from(selectedSectors).map(sector => (
            <Badge
              key={`sector-${sector}`}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/20"
              onClick={() => toggleSector(sector)}
            >
              {sector}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
          {Array.from(selectedSources).map(source => (
            <Badge
              key={`source-${source}`}
              variant="outline"
              className="cursor-pointer hover:bg-destructive/20"
              onClick={() => toggleSource(source)}
            >
              {source}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm" style={{ minWidth: table.getCenterTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-border bg-muted/30">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className={cn(
                      "px-3 py-2.5 text-left font-medium text-muted-foreground relative",
                      header.column.getCanSort() && "cursor-pointer hover:text-foreground select-none"
                    )}
                    style={{ width: header.getSize() }}
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
                    {/* Column Resize Handle */}
                    {enableColumnResizing && header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
                          "hover:bg-primary/50 active:bg-primary",
                          header.column.getIsResizing() && "bg-primary"
                        )}
                      />
                    )}
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
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                {row.getVisibleCells().map(cell => (
                  <td 
                    key={cell.id} 
                    className="px-3 py-2.5"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <span>
          Showing {table.getRowModel().rows.length} of {holdings.length} holdings
          {hasActiveFilters && ` (${holdings.length - filteredHoldings.length} filtered)`}
        </span>
        {enableColumnResizing && (
          <span className="text-muted-foreground/60">
            Drag column edges to resize
          </span>
        )}
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
