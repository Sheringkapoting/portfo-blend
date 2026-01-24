import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KiteSession {
  id: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  token_type: string | null;
  is_valid: boolean;
}

interface UseKiteSessionReturn {
  session: KiteSession | null;
  isLoading: boolean;
  isSessionValid: boolean;
  loginUrl: string | null;
  loginUrlError: string | null;
  refetch: () => Promise<KiteSession | null>;
  fetchLoginUrl: () => Promise<void>;
  disconnectSession: () => Promise<boolean>;
  isDisconnecting: boolean;
  sessionExpiresIn: string | null;
}

export function useKiteSession(): UseKiteSessionReturn {
  const [session, setSession] = useState<KiteSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginUrlError, setLoginUrlError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchSession = useCallback(async (): Promise<KiteSession | null> => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      // First try to find user's own session
      if (userId) {
        const { data, error } = await supabase
          .from('kite_sessions_status')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const sessionData = data as KiteSession;
          setSession(sessionData);
          setIsLoading(false);
          return sessionData;
        }
      }
      
      // Fallback: Check for orphan sessions (for OAuth callback that hasn't associated yet)
      const { data: orphanData, error: orphanError } = await supabase
        .from('kite_sessions_status')
        .select('*')
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!orphanError && orphanData) {
        const sessionData = orphanData as KiteSession;
        setSession(sessionData);
        setIsLoading(false);
        return sessionData;
      }
      
      setSession(null);
      setIsLoading(false);
      return null;
    } catch (e) {
      console.error('[useKiteSession] Exception:', e);
      setSession(null);
      setIsLoading(false);
      return null;
    }
  }, []);

  const fetchLoginUrl = useCallback(async () => {
    try {
      // Get the current session to ensure we have a valid JWT
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found');
        setLoginUrlError('Please log in to connect Zerodha.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('kite-login-url', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) {
        console.error('Error fetching login URL:', error);
        setLoginUrlError('Failed to get login URL. Check API key configuration.');
        return;
      }
      if (data?.loginUrl) {
        setLoginUrl(data.loginUrl);
        setLoginUrlError(null);
      } else if (data?.error) {
        setLoginUrlError(data.error);
      }
    } catch (e) {
      console.error('Error fetching login URL:', e);
      setLoginUrlError('Failed to connect to server.');
    }
  }, []);

  const disconnectSession = useCallback(async (): Promise<boolean> => {
    setIsDisconnecting(true);
    try {
      // Get the current session to ensure we have a valid JWT
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found');
        toast.error('Authentication required', {
          description: 'Please log in to disconnect Zerodha.',
        });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('kite-disconnect', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data?.success) {
        setSession(null);
        toast.success('Zerodha disconnected', {
          description: 'Your Zerodha session has been terminated.',
        });
        return true;
      } else {
        throw new Error(data?.error || 'Failed to disconnect');
      }
    } catch (e) {
      console.error('Error disconnecting Kite session:', e);
      toast.error('Failed to disconnect', {
        description: 'Please try again.',
      });
      return false;
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
    // Don't fetch login URL on mount - it will be fetched when needed
    // This prevents 401 errors when user is not yet authenticated
  }, [fetchSession]);

  // Calculate time until session expires
  const sessionExpiresIn = session?.expires_at
    ? (() => {
        const expiresAt = new Date(session.expires_at);
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        
        if (diffMs <= 0) return null;
        
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
          return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
      })()
    : null;

  const isSessionValid = Boolean(session?.is_valid);

  return {
    session,
    isLoading,
    isSessionValid,
    loginUrl,
    loginUrlError,
    refetch: fetchSession,
    fetchLoginUrl,
    disconnectSession,
    isDisconnecting,
    sessionExpiresIn,
  };
}
