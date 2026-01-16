import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { KiteSession } from './useKiteSession';

interface UseKiteOAuthHandlerOptions {
  onSessionReady: () => Promise<void>;
  onSwitchToHoldings: () => void;
  onSwitchToSources: () => void;
  refetchSession: () => Promise<KiteSession | null>;
  refetchHoldings: () => Promise<void>;
}

export function useKiteOAuthHandler({
  onSessionReady,
  onSwitchToHoldings,
  onSwitchToSources,
  refetchSession,
  refetchHoldings,
}: UseKiteOAuthHandlerOptions) {
  const hasHandledRef = useRef(false);

  const pollForSession = useCallback(async (): Promise<KiteSession | null> => {
    const maxAttempts = 20;
    const intervalMs = 1000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const session = await refetchSession();
      
      if (session?.is_valid) {
        return session;
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    return null;
  }, [refetchSession]);

  const pollForHoldings = useCallback(async (): Promise<boolean> => {
    const maxAttempts = 10;
    const intervalMs = 1500;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('source', 'Zerodha')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!error && data) {
        // Check if this sync is recent (within last 60 seconds)
        const syncTime = new Date(data.created_at).getTime();
        const now = Date.now();
        if (now - syncTime < 60000) {
          return true;
        }
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    return false;
  }, []);

  useEffect(() => {
    if (hasHandledRef.current) return;
    
    const params = new URLSearchParams(window.location.search);
    const kiteConnected = params.get('kite_connected');
    const kiteError = params.get('kite_error');
    
    if (kiteConnected === 'true') {
      hasHandledRef.current = true;
      
      // Clean up URL immediately
      window.history.replaceState({}, '', window.location.pathname);
      
      // Show initial toast
      toast.info('Connecting to Zerodha...', {
        description: 'Please wait while we sync your portfolio.',
        duration: 3000,
      });
      
      // Switch to Data Sources to show progress
      onSwitchToSources();
      
      const handleConnection = async () => {
        // Wait a bit for the callback to complete the token exchange
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Poll for valid session
        const session = await pollForSession();
        
        if (!session) {
          toast.error('Connection timeout', {
            description: 'Could not verify session. Please try again.',
            duration: 5000,
          });
          return;
        }
        
        toast.success('Zerodha connected!', {
          description: 'Session is active. Syncing holdings...',
          duration: 3000,
        });
        
        // The kite-callback already triggered zerodha-sync on the server
        // We just need to wait for it to complete and refresh our data
        const syncSuccess = await pollForHoldings();
        
        if (syncSuccess) {
          // Refresh holdings in the UI
          await refetchHoldings();
          
          toast.success('Portfolio synced!', {
            description: 'Your Zerodha holdings have been imported.',
            duration: 4000,
          });
          
          // Switch to Holdings tab
          onSwitchToHoldings();
        } else {
          // Try manual sync as fallback
          try {
            await onSessionReady();
            await refetchHoldings();
            toast.success('Portfolio synced!', {
              description: 'Your Zerodha holdings have been imported.',
              duration: 4000,
            });
            onSwitchToHoldings();
          } catch (err) {
            toast.warning('Sync may be pending', {
              description: 'Please click "Sync Holdings" to refresh.',
              duration: 5000,
            });
          }
        }
      };
      
      handleConnection();
    } else if (kiteError) {
      hasHandledRef.current = true;
      toast.error('Zerodha connection failed', {
        description: decodeURIComponent(kiteError),
        duration: 5000,
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [pollForSession, pollForHoldings, onSessionReady, onSwitchToHoldings, onSwitchToSources, refetchHoldings]);
}
