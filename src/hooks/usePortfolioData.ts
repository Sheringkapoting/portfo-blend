import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Holding, EnrichedHolding } from '@/types/portfolio';
import { enrichHolding } from '@/lib/portfolioUtils';
import { toast } from 'sonner';

interface SyncStatus {
  source: string;
  status: string;
  holdings_count: number | null;
  error_message: string | null;
  created_at: string;
}

export function usePortfolioData() {
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([]);

  const fetchHoldings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('holdings')
        .select('*')
        .order('source', { ascending: true })
        .order('symbol', { ascending: true });

      if (error) throw error;

      // Get latest quotes from cache
      const { data: quotes } = await supabase
        .from('quotes_cache')
        .select('*');

      const quotesMap = new Map(quotes?.map(q => [q.symbol, q.ltp]) || []);

      // Transform database holdings to our format
      const transformed: Holding[] = (data || []).map(h => {
        const broker = (h as any).broker as string | undefined;
        const source = String(h.source || '').trim() || 'Unknown';

        return {
          id: h.id,
          symbol: h.symbol,
          name: h.name,
          type: h.type as any,
          sector: h.sector as any,
          quantity: Number(h.quantity),
          avgPrice: Number(h.avg_price),
          ltp: quotesMap.get(h.symbol) || Number(h.ltp),
          exchange: h.exchange,
          source: broker || source,
          isin: h.isin || undefined,
          xirr: h.xirr !== null ? Number(h.xirr) : undefined,
        };
      });

      setHoldings(transformed.map(enrichHolding));
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching holdings:', error);
      setIsLoading(false);
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    const { data } = await supabase
      .from('sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setSyncStatus(data);
      if (data.length > 0) {
        setLastSync(new Date(data[0].created_at));
      }
    }
  }, []);

  const syncZerodha = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('zerodha-sync');
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(data.message);
        await fetchHoldings();
        await fetchSyncStatus();
      } else {
        toast.error(data.error || 'Failed to sync Zerodha');
      }
    } catch (error: any) {
      console.error('Zerodha sync error:', error);
      toast.error(error.message || 'Failed to sync Zerodha');
    } finally {
      setIsSyncing(false);
    }
  }, [fetchHoldings, fetchSyncStatus]);

  const syncZerodhaWithRetry = useCallback(async (maxAttempts = 5, baseDelayMs = 1000) => {
    let attempt = 0;
    let delay = baseDelayMs;
    while (attempt < maxAttempts) {
      attempt++;
      setIsSyncing(true);
      try {
        const { data, error } = await supabase.functions.invoke('zerodha-sync');
        if (error) throw error;
        if (data.success) {
          toast.success(data.message);
          await fetchHoldings();
          await fetchSyncStatus();
          return true;
        } else {
          throw new Error(data.error || 'Failed to sync Zerodha');
        }
      } catch (err: any) {
        console.error(`Zerodha sync attempt ${attempt} failed:`, err);
        if (attempt >= maxAttempts) {
          toast.error(err.message || 'Failed to sync Zerodha');
          return false;
        }
        await new Promise(res => setTimeout(res, delay));
        delay = Math.min(delay * 2, 10000);
      } finally {
        setIsSyncing(false);
      }
    }
    return false;
  }, [fetchHoldings, fetchSyncStatus]);

  const uploadINDMoneyExcel = useCallback(async (file: File): Promise<{ success: boolean; holdings_count?: number; error?: string }> => {
    setIsSyncing(true);
    try {
      // Get the current session to include the auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('You must be logged in to upload files');
      }

      const formData = new FormData();
      formData.append('file', file);

      // Use fetch directly to have full control over headers with FormData
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-indmoney`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error: ${response.status}`);
      }
      
      if (data.success) {
        toast.success(data.message);
        await fetchHoldings();
        await fetchSyncStatus();
        return { success: true, holdings_count: data.holdings_count };
      } else {
        toast.error(data.error || 'Failed to parse INDMoney file');
        return { success: false, error: data.error || 'Failed to parse INDMoney file' };
      }
    } catch (error: any) {
      console.error('INDMoney upload error:', error);
      toast.error(error.message || 'Failed to upload INDMoney file');
      return { success: false, error: error.message || 'Failed to upload INDMoney file' };
    } finally {
      setIsSyncing(false);
    }
  }, [fetchHoldings, fetchSyncStatus]);

  useEffect(() => {
    fetchHoldings();
    fetchSyncStatus();
  }, [fetchHoldings, fetchSyncStatus]);

  return {
    holdings,
    isLoading,
    isSyncing,
    lastSync,
    syncStatus,
    syncZerodha,
    syncZerodhaWithRetry,
    uploadINDMoneyExcel,
    refetch: fetchHoldings,
  };
}
