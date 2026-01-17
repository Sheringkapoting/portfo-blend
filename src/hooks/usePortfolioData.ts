import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Holding, EnrichedHolding } from '@/types/portfolio';
import { enrichHolding } from '@/lib/portfolioUtils';
import { toast } from 'sonner';
import { useExcelUploadProgress, UploadProgress } from './useExcelUploadProgress';

interface SyncStatus {
  source: string;
  status: string;
  holdings_count: number | null;
  error_message: string | null;
  created_at: string;
}

const MAX_EXCEL_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_EXTENSIONS = ['.xlsx', '.xls'];

export function usePortfolioData() {
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([]);
  
  // Excel upload progress tracking
  const uploadProgress = useExcelUploadProgress();

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

  const validateExcelFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > MAX_EXCEL_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return { valid: false, error: `File is too large (${sizeMb} MB). Maximum allowed size is 10 MB.` };
    }

    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    // Check extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = VALID_EXTENSIONS.some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
      return { valid: false, error: `Invalid file type. Supported formats: ${VALID_EXTENSIONS.join(', ')}` };
    }

    return { valid: true };
  }, []);

  const uploadINDMoneyExcel = useCallback(async (file: File) => {
    // Reset and start progress tracking
    uploadProgress.reset();
    
    // Step 1: Validate file
    uploadProgress.updateStep('validating', { 
      message: `Validating ${file.name}...`,
      details: { source: 'INDMoney' }
    });
    
    const validation = validateExcelFile(file);
    if (!validation.valid) {
      uploadProgress.setError(validation.error!);
      toast.error(validation.error);
      return;
    }

    setIsSyncing(true);
    
    try {
      // Step 2: Upload file
      uploadProgress.updateStep('uploading', {
        message: `Uploading ${file.name}...`,
        details: { source: 'INDMoney' }
      });
      
      const formData = new FormData();
      formData.append('file', file);

      // Step 3: Process on server
      uploadProgress.updateStep('parsing', {
        message: 'Parsing Excel data...',
        details: { source: 'INDMoney' }
      });

      const { data, error } = await supabase.functions.invoke('parse-indmoney', {
        body: formData,
      });
      
      if (error) throw error;
      
      if (data.success) {
        // Step 4: Processing complete
        uploadProgress.updateStep('processing', {
          message: 'Processing holdings...',
          details: {
            totalRows: data.summary?.total_rows,
            processedRows: data.summary?.valid_holdings,
            source: 'INDMoney'
          }
        });

        // Brief delay to show processing step
        await new Promise(resolve => setTimeout(resolve, 300));

        // Step 5: Syncing
        uploadProgress.updateStep('syncing', {
          message: 'Syncing to database...',
          details: {
            insertedCount: data.holdings_count,
            skippedCount: data.skipped_count,
            source: 'INDMoney'
          }
        });

        await fetchHoldings();
        await fetchSyncStatus();

        // Collect warnings
        const warnings: string[] = [];
        if (data.data_integrity?.warnings) {
          warnings.push(...data.data_integrity.warnings);
        }
        if (data.reconciliation?.messages && data.reconciliation.hasAnalyticsSheet && !data.reconciliation.isConsistent) {
          warnings.push(...data.reconciliation.messages);
        }
        if (data.skipped_count > 0) {
          warnings.push(`${data.skipped_count} entries were skipped during import`);
        }

        // Determine final status
        const isPartial = data.sync_status === 'partial' || warnings.length > 0;
        
        if (isPartial) {
          uploadProgress.updateStep('partial', {
            message: 'Import completed with warnings',
            warnings,
            details: {
              insertedCount: data.holdings_count,
              skippedCount: data.skipped_count,
              source: 'INDMoney'
            }
          });
          toast.warning('Imported with warnings', {
            description: warnings[0] || data.message,
            duration: 6000,
          });
        } else {
          uploadProgress.updateStep('complete', {
            message: `Successfully imported ${data.holdings_count} holdings`,
            details: {
              insertedCount: data.holdings_count,
              source: 'INDMoney'
            }
          });
          toast.success(data.message);
        }
      } else {
        const errorMessage = data.error || 'Failed to parse INDMoney file';
        uploadProgress.setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('INDMoney upload error:', error);
      const errorMessage = error.message || 'Failed to upload INDMoney file';
      uploadProgress.setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchHoldings, fetchSyncStatus, uploadProgress, validateExcelFile]);

  // Retry function for failed uploads
  const retryUpload = useCallback(async (file: File) => {
    await uploadINDMoneyExcel(file);
  }, [uploadINDMoneyExcel]);

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
    uploadProgress: uploadProgress.progress,
    resetUploadProgress: uploadProgress.reset,
    retryUpload,
    refetch: fetchHoldings,
  };
}
