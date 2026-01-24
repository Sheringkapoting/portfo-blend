import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to generate Kite login URL
 * Falls back to client-side generation if Edge Function fails
 */
export function useKiteLoginUrl() {
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginUrlError, setLoginUrlError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateLoginUrl = useCallback(async () => {
    setIsLoading(true);
    setLoginUrlError(null);

    try {
      // First, verify user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setLoginUrlError('Please log in to your account first.');
        setIsLoading(false);
        return;
      }

      // Try to get API key from Edge Function first
      try {
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (!refreshError && session?.access_token) {
          const response = await supabase.functions.invoke('kite-login-url', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });

          if (!response.error && response.data?.loginUrl) {
            setLoginUrl(response.data.loginUrl);
            setIsLoading(false);
            return;
          }
        }
      } catch (edgeFunctionError) {
        console.warn('[useKiteLoginUrl] Edge Function failed, using fallback:', edgeFunctionError);
      }

      // Fallback: Generate login URL on client side
      // This requires KITE_API_KEY to be available in environment variables
      const apiKey = import.meta.env.VITE_KITE_API_KEY;
      
      if (!apiKey) {
        setLoginUrlError('Kite API key not configured. Please add VITE_KITE_API_KEY to your .env file or configure the Edge Function properly.');
        setIsLoading(false);
        return;
      }

      // Create state parameter with user_id for secure OAuth flow
      const stateData = {
        user_id: user.id,
        nonce: crypto.randomUUID(),
        timestamp: Date.now()
      };
      const state = btoa(JSON.stringify(stateData));
      
      const url = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}&state=${encodeURIComponent(state)}`;
      
      setLoginUrl(url);
      setIsLoading(false);
    } catch (error: any) {
      console.error('[useKiteLoginUrl] Error generating login URL:', error);
      setLoginUrlError('Failed to generate login URL. Please try again.');
      setIsLoading(false);
    }
  }, []);

  return {
    loginUrl,
    loginUrlError,
    isLoading,
    generateLoginUrl,
  };
}
