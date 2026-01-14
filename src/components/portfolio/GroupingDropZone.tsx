import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GripVertical, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupingDropZoneProps {
  groupBy: string[];
  columnLabels: Record<string, string>;
  onRemove: (columnId: string) => void;
  onClear: () => void;
  onDrop: (columnId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  isDragging: boolean;
  draggedColumn: string | null;
}

export function GroupingDropZone({
  groupBy,
  columnLabels,
  onRemove,
  onClear,
  onDrop,
  isDragging,
  draggedColumn,
}: GroupingDropZoneProps) {
  const canDrop = useMemo(() => {
    if (!draggedColumn) return false;
    return !groupBy.includes(draggedColumn);
  }, [draggedColumn, groupBy]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canDrop) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const columnId = e.dataTransfer.getData('text/plain');
    if (columnId && !groupBy.includes(columnId)) {
      onDrop(columnId);
    }
  };

  const hasGroups = groupBy.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className={cn(
        "px-4 py-3 border-b border-border transition-colors duration-200",
        isDragging && canDrop && "bg-primary/5 border-primary/30",
        isDragging && !canDrop && groupBy.includes(draggedColumn || '') && "bg-muted/50"
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
            {hasGroups ? (
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
                    {columnLabels[columnId] || columnId}
                  </span>
                  {index < groupBy.length - 1 && (
                    <span className="text-muted-foreground mx-1">→</span>
                  )}
                  <button
                    onClick={() => onRemove(columnId)}
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
                  isDragging && canDrop && "text-primary font-medium not-italic"
                )}
              >
                {isDragging && canDrop
                  ? "Drop column here to group"
                  : "Drag column headers here to group"}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {hasGroups && (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          >
            Clear all
          </button>
        )}
      </div>
    </motion.div>
  );
}
