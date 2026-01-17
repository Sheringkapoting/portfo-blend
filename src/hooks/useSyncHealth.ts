import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SourceSyncStatus {
  source: string;
  lastSuccessAt: Date | null;
  holdingsCount: number | null;
  status: 'success' | 'failed' | 'never';
}

export function useSyncHealth() {
  const [sourceStatuses, setSourceStatuses] = useState<SourceSyncStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSyncHealth = useCallback(async () => {
    try {
      // Get latest successful sync for each source
      const { data, error } = await supabase
        .from('sync_logs')
        .select('source, status, created_at, holdings_count')
        .eq('status', 'success')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by source and get the most recent
      const sourceMap = new Map<string, SourceSyncStatus>();
      
      (data || []).forEach((log) => {
        if (!sourceMap.has(log.source)) {
          sourceMap.set(log.source, {
            source: log.source,
            lastSuccessAt: new Date(log.created_at),
            holdingsCount: log.holdings_count,
            status: 'success',
          });
        }
      });

      setSourceStatuses(Array.from(sourceMap.values()));
    } catch (error) {
      console.error('Error fetching sync health:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncHealth();
  }, [fetchSyncHealth]);

  const getTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return {
    sourceStatuses,
    isLoading,
    refetch: fetchSyncHealth,
    getTimeAgo,
  };
}
