import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface KiteSession {
  id: string;
  access_token: string;
  expires_at: string;
  created_at: string;
}

interface UseKiteSessionReturn {
  session: KiteSession | null;
  isLoading: boolean;
  isSessionValid: boolean;
  loginUrl: string | null;
  loginUrlError: string | null;
  refetch: () => Promise<void>;
}

export function useKiteSession(): UseKiteSessionReturn {
  const [session, setSession] = useState<KiteSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginUrlError, setLoginUrlError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('kite_sessions')
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

  useEffect(() => {
    fetchSession();
    fetchLoginUrl();
  }, [fetchSession, fetchLoginUrl]);

  const isSessionValid = Boolean(session && new Date(session.expires_at) > new Date());

  return {
    session,
    isLoading,
    isSessionValid,
    loginUrl,
    loginUrlError,
    refetch: fetchSession,
  };
}
