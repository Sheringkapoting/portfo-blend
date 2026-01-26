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
  fetchLoginUrl: () => Promise<string | null>;
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

  const fetchLoginUrl = useCallback(async (): Promise<string | null> => {
    try {
      // First, verify the user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('[useKiteSession] User not authenticated, cannot fetch login URL');
        setLoginUrlError('Please log in to your account first.');
        return null;
      }

      // Refresh the session to get a fresh JWT token
      // This ensures the token is valid and not expired
      console.log('[useKiteSession] Refreshing session to get fresh JWT token...');
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !session || !session.access_token) {
        console.error('[useKiteSession] Failed to refresh session:', refreshError);
        setLoginUrlError('Session expired. Please log out and log in again.');
        return null;
      }

      console.log('[useKiteSession] Session refreshed successfully. Fetching login URL for user:', user.id);

      const response = await supabase.functions.invoke('kite-login-url', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      console.log('[useKiteSession] Edge Function response:', response);
      
      if (response.error) {
        console.error('[useKiteSession] Error fetching login URL:', response.error);
        
        // Check if it's an authentication error
        if (response.error.message?.includes('401') || response.error.message?.includes('JWT')) {
          console.error('[useKiteSession] Authentication failed with token:', session.access_token.substring(0, 20) + '...');
          setLoginUrlError('Authentication failed. Please log out and log in again.');
        } else if (response.error.message?.includes('FunctionsHttpError')) {
          // Edge Function returned an error response
          console.error('[useKiteSession] Edge Function error:', response.error.message);
          setLoginUrlError('Failed to get login URL. Check API key configuration.');
        } else {
          setLoginUrlError('Failed to get login URL. Check API key configuration.');
        }
        return null;
      }
      
      if (response.data?.loginUrl) {
        setLoginUrl(response.data.loginUrl);
        setLoginUrlError(null);
        console.log('[useKiteSession] Login URL fetched successfully');
        return response.data.loginUrl;
      } else if (response.data?.error) {
        console.error('[useKiteSession] Edge Function returned error:', response.data.error);
        setLoginUrlError(response.data.error);
      } else {
        console.error('[useKiteSession] Unexpected response format:', response.data);
        setLoginUrlError('Unexpected response from server.');
      }
      return null;
    } catch (e: any) {
      console.error('[useKiteSession] Exception fetching login URL:', e);
      if (e.message?.includes('401') || e.message?.includes('JWT')) {
        setLoginUrlError('Authentication failed. Please log out and log in again.');
      } else {
        setLoginUrlError('Failed to connect to server.');
      }
      return null;
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
    // Don't fetch login URL on mount to avoid 401 errors
    // It will be fetched when the user is authenticated and tries to connect
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
