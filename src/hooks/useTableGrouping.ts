import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'holdings-table-grouping';

export interface GroupingConfig {
  groupBy: string[];
  expandedGroups: Set<string>;
}

interface StoredConfig {
  groupBy: string[];
  expandedGroups: string[];
}

export function useTableGrouping() {
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredConfig = JSON.parse(stored);
        setGroupBy(parsed.groupBy || []);
        setExpandedGroups(new Set(parsed.expandedGroups || []));
      }
    } catch (e) {
      console.warn('Failed to load grouping preferences:', e);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    try {
      const config: StoredConfig = {
        groupBy,
        expandedGroups: Array.from(expandedGroups),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to save grouping preferences:', e);
    }
  }, [groupBy, expandedGroups]);

  const addGrouping = useCallback((columnId: string) => {
    setGroupBy(prev => {
      if (prev.includes(columnId)) return prev;
      return [...prev, columnId];
    });
  }, []);

  const removeGrouping = useCallback((columnId: string) => {
    setGroupBy(prev => prev.filter(id => id !== columnId));
  }, []);

  const clearGrouping = useCallback(() => {
    setGroupBy([]);
    setExpandedGroups(new Set());
  }, []);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback((keys: string[]) => {
    setExpandedGroups(new Set(keys));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const reorderGrouping = useCallback((fromIndex: number, toIndex: number) => {
    setGroupBy(prev => {
      const updated = [...prev];
      const [removed] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, removed);
      return updated;
    });
  }, []);

  return {
    groupBy,
    expandedGroups,
    addGrouping,
    removeGrouping,
    clearGrouping,
    toggleGroup,
    expandAll,
    collapseAll,
    reorderGrouping,
    setGroupBy,
  };
}
