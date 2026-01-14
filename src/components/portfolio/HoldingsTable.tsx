import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, ChevronRight, Layers, X, GripVertical, Maximize2, Minimize2, Loader2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTableGrouping } from '@/hooks/useTableGrouping';

const ITEMS_PER_PAGE = 15;

interface HoldingsTableProps {
  holdings: EnrichedHolding[];
}

// Column labels for display
const COLUMN_LABELS: Record<string, string> = {
  symbol: 'Investment',
  type: 'Type',
  sector: 'Sector',
  quantity: 'Qty',
  avgPrice: 'Avg Price',
  ltp: 'LTP',
  investedValue: 'Invested',
  currentValue: 'Current',
  pnl: 'P&L',
  pnlPercent: 'P&L %',
  recommendation: 'Action',
  source: 'Source',
};

// Groupable columns
const GROUPABLE_COLUMNS = ['type', 'sector', 'source', 'recommendation'];

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  
  // Infinite scroll state
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    groupBy,
    expandedGroups,
    addGrouping,
    removeGrouping,
    clearGrouping,
    toggleGroup,
    expandAll,
    collapseAll,
  } = useTableGrouping();

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

  // Infinite scroll: items to display
  const hasMore = displayCount < filteredData.length;
  const displayedData = useMemo(() => {
    if (groupBy.length > 0) return filteredData; // No pagination when grouped
    return filteredData.slice(0, displayCount);
  }, [filteredData, displayCount, groupBy.length]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [typeFilter, sourceFilter, globalFilter]);

  // Load more handler
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || groupBy.length > 0) return;
    
    setIsLoadingMore(true);
    loadTimeoutRef.current = setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredData.length));
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMore, filteredData.length, groupBy.length]);

  // Scroll handler for infinite scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < 100 && hasMore && !isLoadingMore && groupBy.length === 0) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, loadMore, groupBy.length]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  // Group data hierarchically
  const groupedData = useMemo(() => {
    if (groupBy.length === 0) return null;

    interface GroupNode {
      key: string;
      value: string;
      level: number;
      holdings: EnrichedHolding[];
      children: Map<string, GroupNode>;
      summary: {
        count: number;
        investedValue: number;
        currentValue: number;
        pnl: number;
        pnlPercent: number;
      };
    }

    const buildGroups = (
      items: EnrichedHolding[],
      groupKeys: string[],
      level: number = 0,
      parentKey: string = ''
    ): Map<string, GroupNode> => {
      if (groupKeys.length === 0) return new Map();

      const [currentGroupKey, ...remainingKeys] = groupKeys;
      const groups = new Map<string, GroupNode>();

      items.forEach(item => {
        const value = String((item as any)[currentGroupKey] || 'Unknown');
        const key = parentKey ? `${parentKey}|${value}` : value;

        if (!groups.has(value)) {
          groups.set(value, {
            key,
            value,
            level,
            holdings: [],
            children: new Map(),
            summary: { count: 0, investedValue: 0, currentValue: 0, pnl: 0, pnlPercent: 0 },
          });
        }

        const group = groups.get(value)!;
        group.holdings.push(item);
      });

      // Build children and calculate summaries
      groups.forEach(group => {
        group.children = buildGroups(group.holdings, remainingKeys, level + 1, group.key);
        group.summary = {
          count: group.holdings.length,
          investedValue: group.holdings.reduce((sum, h) => sum + h.investedValue, 0),
          currentValue: group.holdings.reduce((sum, h) => sum + h.currentValue, 0),
          pnl: group.holdings.reduce((sum, h) => sum + h.pnl, 0),
          pnlPercent: 0,
        };
        group.summary.pnlPercent = group.summary.investedValue > 0
          ? (group.summary.pnl / group.summary.investedValue) * 100
          : 0;
      });

      return groups;
    };

    return buildGroups(filteredData, groupBy);
  }, [filteredData, groupBy]);

  // Get all group keys for expand/collapse all
  const allGroupKeys = useMemo(() => {
    if (!groupedData) return [];
    const keys: string[] = [];
    
    const collectKeys = (groups: Map<string, any>) => {
      groups.forEach(group => {
        keys.push(group.key);
        if (group.children.size > 0) {
          collectKeys(group.children);
        }
      });
    };
    
    collectKeys(groupedData);
    return keys;
  }, [groupedData]);

  const columns = useMemo<ColumnDef<EnrichedHolding>[]>(() => [
    {
      accessorKey: 'symbol',
      header: ({ column }) => (
        <DraggableHeader
          column={column}
          label="Investment"
          columnId="symbol"
          isGroupable={false}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.original.name}</span>
          <span className="text-xs text-muted-foreground font-mono">
            {row.original.symbol}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <DraggableHeader
          column={column}
          label="Type"
          columnId="type"
          isGroupable={true}
          isGrouped={groupBy.includes('type')}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
        />
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'sector',
      header: ({ column }) => (
        <DraggableHeader
          column={column}
          label="Sector"
          columnId="sector"
          isGroupable={true}
          isGrouped={groupBy.includes('sector')}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
        />
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DraggableHeader
          column={column}
          label="Qty"
          columnId="quantity"
          isGroupable={false}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
          className="justify-end"
        />
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
        <DraggableHeader
          column={column}
          label="Avg Price"
          columnId="avgPrice"
          isGroupable={false}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
          className="justify-end"
        />
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
        <DraggableHeader
          column={column}
          label="LTP"
          columnId="ltp"
          isGroupable={false}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
          className="justify-end"
        />
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
        <DraggableHeader
          column={column}
          label="Invested"
          columnId="investedValue"
          isGroupable={false}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
          className="justify-end"
        />
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
        <DraggableHeader
          column={column}
          label="Current"
          columnId="currentValue"
          isGroupable={false}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
          className="justify-end"
        />
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
        <DraggableHeader
          column={column}
          label="P&L"
          columnId="pnl"
          isGroupable={false}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
          className="justify-end"
        />
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
        <DraggableHeader
          column={column}
          label="P&L %"
          columnId="pnlPercent"
          isGroupable={false}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
          className="justify-end"
        />
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
      header: ({ column }) => (
        <DraggableHeader
          column={column}
          label="Action"
          columnId="recommendation"
          isGroupable={true}
          isGrouped={groupBy.includes('recommendation')}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
        />
      ),
      cell: ({ getValue }) => (
        <RecommendationBadge recommendation={getValue() as any} />
      ),
    },
    {
      accessorKey: 'source',
      header: ({ column }) => (
        <DraggableHeader
          column={column}
          label="Source"
          columnId="source"
          isGroupable={true}
          isGrouped={groupBy.includes('source')}
          onDragStart={setDraggedColumn}
          onDragEnd={() => setDraggedColumn(null)}
        />
      ),
      cell: ({ getValue }) => (
        <SourceBadge source={getValue() as any} />
      ),
    },
  ], [groupBy]);

  const table = useReactTable({
    data: displayedData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const uniqueTypes = useMemo(() => 
    [...new Set(holdings.map(h => h.type))].sort(), 
    [holdings]
  );
  
  const uniqueSources = useMemo(() => 
    [...new Set(holdings.map(h => h.source))].sort(), 
    [holdings]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedColumn && GROUPABLE_COLUMNS.includes(draggedColumn) && !groupBy.includes(draggedColumn)) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const columnId = e.dataTransfer.getData('text/plain');
    if (columnId && GROUPABLE_COLUMNS.includes(columnId) && !groupBy.includes(columnId)) {
      addGrouping(columnId);
    }
    setDraggedColumn(null);
  };

  // Render grouped rows recursively
  const renderGroupedRows = useCallback((
    groups: Map<string, any>,
    level: number = 0
  ): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];

    groups.forEach((group) => {
      const isExpanded = expandedGroups.has(group.key);
      const isProfit = group.summary.pnl >= 0;
      const isLeafGroup = group.children.size === 0;

      rows.push(
        <motion.tr
          key={group.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "border-b border-border/50 cursor-pointer transition-colors",
            "bg-muted/40 hover:bg-muted/60",
            level > 0 && "bg-muted/20"
          )}
          onClick={() => toggleGroup(group.key)}
        >
          <td colSpan={columns.length} className="px-4 py-3">
            <div
              className="flex items-center gap-3"
              style={{ paddingLeft: `${level * 20}px` }}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="text-muted-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </motion.div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{group.value}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {group.summary.count} {group.summary.count === 1 ? 'holding' : 'holdings'}
                </span>
              </div>

              <div className="flex-1" />

              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <span className="text-muted-foreground text-xs">Invested</span>
                  <p className="font-mono-numbers font-medium">
                    {formatCurrency(group.summary.investedValue, true)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground text-xs">Current</span>
                  <p className="font-mono-numbers font-medium">
                    {formatCurrency(group.summary.currentValue, true)}
                  </p>
                </div>
                <div className="text-right min-w-[100px]">
                  <span className="text-muted-foreground text-xs">P&L</span>
                  <p className={cn(
                    "font-mono-numbers font-semibold",
                    isProfit ? "text-profit" : "text-loss"
                  )}>
                    {isProfit ? '+' : ''}{formatCurrency(group.summary.pnl, true)}
                    <span className="text-xs ml-1">
                      ({formatPercent(group.summary.pnlPercent)})
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </td>
        </motion.tr>
      );

      if (isExpanded) {
        if (isLeafGroup) {
          // Render actual holdings
          group.holdings.forEach((holding: EnrichedHolding, index: number) => {
            rows.push(
              <motion.tr
                key={holding.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                className="border-b border-border/50 table-row-hover"
                style={{ paddingLeft: `${(level + 1) * 20}px` }}
              >
                {table.getRowModel().rows.find(r => r.original.id === holding.id)?.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )) || (
                  // Fallback rendering if row not found in table model
                  <>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{holding.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{holding.symbol}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-sm text-muted-foreground">{holding.type}</span></td>
                    <td className="px-4 py-3"><span className="text-sm text-muted-foreground">{holding.sector}</span></td>
                    <td className="px-4 py-3"><span className="font-mono-numbers text-sm text-right block">{formatNumber(holding.quantity)}</span></td>
                    <td className="px-4 py-3"><span className="font-mono-numbers text-sm text-right block">{formatCurrency(holding.avgPrice)}</span></td>
                    <td className="px-4 py-3"><span className="font-mono-numbers text-sm font-medium text-right block">{formatCurrency(holding.ltp)}</span></td>
                    <td className="px-4 py-3"><span className="font-mono-numbers text-sm text-right block">{formatCurrency(holding.investedValue, true)}</span></td>
                    <td className="px-4 py-3"><span className="font-mono-numbers text-sm font-medium text-right block">{formatCurrency(holding.currentValue, true)}</span></td>
                    <td className="px-4 py-3">
                      <span className={cn("font-mono-numbers text-sm font-semibold text-right block", holding.pnl >= 0 ? "text-profit" : "text-loss")}>
                        {holding.pnl >= 0 ? '+' : ''}{formatCurrency(holding.pnl, true)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("font-mono-numbers text-sm font-semibold text-right block", holding.pnlPercent >= 0 ? "text-profit" : "text-loss")}>
                        {formatPercent(holding.pnlPercent)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><RecommendationBadge recommendation={holding.recommendation} /></td>
                    <td className="px-4 py-3"><SourceBadge source={holding.source} /></td>
                  </>
                )}
              </motion.tr>
            );
          });
        } else {
          // Render child groups
          rows.push(...renderGroupedRows(group.children, level + 1));
        }
      }
    });

    return rows;
  }, [expandedGroups, toggleGroup, columns.length, table]);

  const canDrop = draggedColumn && GROUPABLE_COLUMNS.includes(draggedColumn) && !groupBy.includes(draggedColumn);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {/* Grouping Drop Zone */}
      <div
        className={cn(
          "px-4 py-3 border-b border-border transition-colors duration-200",
          draggedColumn && canDrop && "bg-primary/5 border-primary/30",
          draggedColumn && !canDrop && groupBy.includes(draggedColumn) && "bg-muted/50"
        )}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Group by</span>
          </div>

          <div className="flex-1 flex items-center gap-2 flex-wrap min-h-[32px]">
            <AnimatePresence mode="popLayout">
              {groupBy.length > 0 ? (
                groupBy.map((columnId, index) => (
                  <motion.div
                    key={columnId}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    layout
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-sm"
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                    <span className="text-foreground font-medium">
                      {COLUMN_LABELS[columnId] || columnId}
                    </span>
                    {index < groupBy.length - 1 && (
                      <span className="text-muted-foreground mx-1">→</span>
                    )}
                    <button
                      onClick={() => removeGrouping(columnId)}
                      className="ml-1 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))
              ) : (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "text-sm text-muted-foreground italic",
                    draggedColumn && canDrop && "text-primary font-medium not-italic"
                  )}
                >
                  {draggedColumn && canDrop
                    ? "Drop column here to group"
                    : "Drag column headers here to group"}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {groupBy.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => expandAll(allGroupKeys)}
                className="h-7 px-2 text-xs"
              >
                <Maximize2 className="h-3 w-3 mr-1" />
                Expand
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="h-7 px-2 text-xs"
              >
                <Minimize2 className="h-3 w-3 mr-1" />
                Collapse
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearGrouping}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </div>

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

      {/* Table with scrollable container */}
      <div 
        ref={scrollContainerRef}
        className="overflow-auto max-h-[600px]"
      >
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-card">
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
            {groupedData ? (
              renderGroupedRows(groupedData)
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.3) }}
                  className="border-b border-border/50 table-row-hover"
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>

        {/* Loading indicator */}
        {isLoadingMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-4 gap-2 text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading more...</span>
          </motion.div>
        )}
      </div>
      
      {/* Table Footer */}
      <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {displayedData.length} of {filteredData.length} holdings
          {groupBy.length > 0 && ` (grouped by ${groupBy.map(g => COLUMN_LABELS[g]).join(' → ')})`}
        </span>
        {hasMore && groupBy.length === 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMore}
            disabled={isLoadingMore}
            className="text-xs"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Loading...
              </>
            ) : (
              `Load more (${filteredData.length - displayedData.length} remaining)`
            )}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// Draggable Sortable Header Component
function DraggableHeader({ 
  column, 
  label, 
  columnId,
  isGroupable,
  isGrouped,
  onDragStart,
  onDragEnd,
  className 
}: { 
  column: any; 
  label: string;
  columnId: string;
  isGroupable: boolean;
  isGrouped?: boolean;
  onDragStart: (columnId: string) => void;
  onDragEnd: () => void;
  className?: string;
}) {
  const isSorted = column.getIsSorted();
  
  const handleDragStart = (e: React.DragEvent) => {
    if (isGroupable) {
      e.dataTransfer.setData('text/plain', columnId);
      e.dataTransfer.effectAllowed = 'move';
      onDragStart(columnId);
    }
  };

  return (
    <div
      draggable={isGroupable}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-1",
        isGroupable && "cursor-grab active:cursor-grabbing",
        isGrouped && "opacity-50",
        className
      )}
    >
      {isGroupable && (
        <GripVertical className="h-3 w-3 text-muted-foreground/50" />
      )}
      <button
        onClick={() => column.toggleSorting()}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
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
    </div>
  );
}
