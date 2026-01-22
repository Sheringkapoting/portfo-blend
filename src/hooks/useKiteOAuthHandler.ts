import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Define the shape we need - matches kite_sessions_status view
interface KiteSessionData {
  id: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  token_type: string | null;
  is_valid: boolean;
}

interface UseKiteOAuthHandlerOptions {
  onSessionReady: () => Promise<void>;
  onSwitchToHoldings: () => void;
  onSwitchToSources: () => void;
  refetchSession: () => Promise<unknown>;
  refetchHoldings: () => Promise<void>;
}

export interface OAuthProgress {
  step: 'idle' | 'connecting' | 'verifying' | 'syncing' | 'complete' | 'error';
  message: string;
}

export function useKiteOAuthHandler({
  onSessionReady,
  onSwitchToHoldings,
  onSwitchToSources,
  refetchSession,
  refetchHoldings,
}: UseKiteOAuthHandlerOptions) {
  const hasHandledRef = useRef(false);
  const [progress, setProgress] = useState<OAuthProgress>({ step: 'idle', message: '' });

  const pollForSession = useCallback(async (): Promise<KiteSessionData | null> => {
    const maxAttempts = 30;
    const intervalMs = 1000;
    
    console.log('[OAuth] Starting session polling...');
    
    // Get current user ID for filtering
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[OAuth] Poll attempt ${attempt}/${maxAttempts}`);
      
      try {
        // First try to find user's own session
        let query = supabase
          .from('kite_sessions_status')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (userId) {
          query = query.eq('user_id', userId);
        }
        
        const { data, error } = await query;
        
        if (!error && data && data.length > 0) {
          const session = data[0] as KiteSessionData;
          if (session.is_valid) {
            console.log('[OAuth] Valid session found for user!');
            return session;
          }
        }
        
        // Fallback: Check for orphan sessions (user_id is null) that might belong to this user
        // This handles the case where OAuth callback created session before user association
        if (userId && attempt >= 5) {
          const { data: orphanData } = await supabase
            .from('kite_sessions_status')
            .select('*')
            .is('user_id', null)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (orphanData && orphanData.length > 0) {
            const orphanSession = orphanData[0] as KiteSessionData;
            if (orphanSession.is_valid) {
              console.log('[OAuth] Found orphan session, will be associated on first sync');
              return orphanSession;
            }
          }
        }
      } catch (e) {
        console.error('[OAuth] Poll error:', e);
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    console.log('[OAuth] Session polling timed out');
    return null;
  }, []);

  const pollForHoldings = useCallback(async (): Promise<boolean> => {
    const maxAttempts = 15;
    const intervalMs = 2000;
    
    console.log('[OAuth] Starting holdings polling...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[OAuth] Holdings poll attempt ${attempt}/${maxAttempts}`);
      
      try {
        const { data, error } = await supabase
          .from('sync_logs')
          .select('*')
          .eq('source', 'Zerodha')
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!error && data) {
          const syncTime = new Date(data.created_at).getTime();
          const now = Date.now();
          // Check if sync was within last 2 minutes
          if (now - syncTime < 120000) {
            console.log('[OAuth] Recent successful sync found!');
            return true;
          }
        }
      } catch (e) {
        console.error('[OAuth] Holdings poll error:', e);
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    console.log('[OAuth] Holdings polling timed out');
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
      
      const handleConnection = async () => {
        console.log('[OAuth] Starting connection flow...');
        
        // Step 1: Show connecting message
        setProgress({ step: 'connecting', message: 'Connecting to Zerodha...' });
        toast.info('Connecting to Zerodha...', {
          description: 'Please wait while we verify your session.',
          duration: 3000,
        });
        
        // Switch to Data Sources to show progress
        onSwitchToSources();
        
        // Wait for callback to complete token exchange
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Step 2: Verify session
        setProgress({ step: 'verifying', message: 'Verifying session...' });
        const session = await pollForSession();
        
        if (!session) {
          setProgress({ step: 'error', message: 'Session verification failed' });
          toast.error('Connection timeout', {
            description: 'Could not verify session. Please try again.',
            duration: 5000,
          });
          return;
        }
        
        // Step 3: Sync holdings
        setProgress({ step: 'syncing', message: 'Syncing portfolio...' });
        toast.success('Zerodha connected!', {
          description: 'Now syncing your holdings...',
          duration: 3000,
        });
        
        // Update session state in the hook
        await refetchSession();
        
        // Check if holdings were synced by the callback
        const syncSuccess = await pollForHoldings();
        
        if (syncSuccess) {
          await refetchHoldings();
          setProgress({ step: 'complete', message: 'Sync complete!' });
          toast.success('Portfolio synced!', {
            description: 'Your Zerodha holdings have been imported.',
            duration: 4000,
          });
          onSwitchToHoldings();
        } else {
          // Try manual sync as fallback
          try {
            setProgress({ step: 'syncing', message: 'Running manual sync...' });
            await onSessionReady();
            await refetchHoldings();
            setProgress({ step: 'complete', message: 'Sync complete!' });
            toast.success('Portfolio synced!', {
              description: 'Your Zerodha holdings have been imported.',
              duration: 4000,
            });
            onSwitchToHoldings();
          } catch (err) {
            console.error('[OAuth] Manual sync failed:', err);
            setProgress({ step: 'error', message: 'Sync failed' });
            toast.warning('Sync pending', {
              description: 'Session is active. Click "Sync Holdings" to import.',
              duration: 5000,
            });
          }
        }
        
        // Reset progress after a delay
        setTimeout(() => {
          setProgress({ step: 'idle', message: '' });
        }, 3000);
      };
      
      handleConnection();
    } else if (kiteError) {
      hasHandledRef.current = true;
      setProgress({ step: 'error', message: decodeURIComponent(kiteError) });
      toast.error('Zerodha connection failed', {
        description: decodeURIComponent(kiteError),
        duration: 5000,
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [pollForSession, pollForHoldings, onSessionReady, onSwitchToHoldings, onSwitchToSources, refetchSession, refetchHoldings]);

  return { progress };
}
