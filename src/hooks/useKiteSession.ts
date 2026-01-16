import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface KiteSession {
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
  refetch: () => Promise<void>;
  disconnectSession: () => Promise<void>;
  isDisconnecting: boolean;
  sessionExpiresIn: string | null;
}

export function useKiteSession(): UseKiteSessionReturn {
  const [session, setSession] = useState<KiteSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginUrlError, setLoginUrlError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      // Use the kite_sessions_status view which doesn't expose access_token
      const { data, error } = await supabase
        .from('kite_sessions_status')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setSession(data[0]);
      } else {
        setSession(null);
      }
    } catch (e) {
      console.error('Error fetching Kite session:', e);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLoginUrl = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('kite-login-url');
      if (error) {
        console.error('Error fetching login URL:', error);
        setLoginUrlError('Failed to get login URL. Check API key configuration.');
        return;
      }
      if (data?.loginUrl) {
        setLoginUrl(data.loginUrl);
      } else if (data?.error) {
        setLoginUrlError(data.error);
      }
    } catch (e) {
      console.error('Error fetching login URL:', e);
      setLoginUrlError('Failed to connect to server.');
    }
  }, []);

  // Disconnect/invalidate the current Kite session
  const disconnectSession = useCallback(async () => {
    if (!session) return;
    
    setIsDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('kite-disconnect');
      
      if (error) {
        throw new Error(error.message);
      }
      
      setSession(null);
      toast.success('Zerodha disconnected', {
        description: 'Your Zerodha session has been terminated.',
      });
    } catch (e) {
      console.error('Error disconnecting Kite session:', e);
      toast.error('Failed to disconnect', {
        description: 'Please try again.',
      });
    } finally {
      setIsDisconnecting(false);
    }
  }, [session]);

  useEffect(() => {
    fetchSession();
    fetchLoginUrl();
  }, [fetchSession, fetchLoginUrl]);

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

  // Use the is_valid field from the view, fallback to date comparison
  const isSessionValid = Boolean(session?.is_valid ?? (session && new Date(session.expires_at) > new Date()));

  return {
    session,
    isLoading,
    isSessionValid,
    loginUrl,
    loginUrlError,
    refetch: fetchSession,
    disconnectSession,
    isDisconnecting,
    sessionExpiresIn,
  };
}
