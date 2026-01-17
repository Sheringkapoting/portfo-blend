import { useEffect, useCallback, useRef } from 'react';

interface UseAutoRefreshOptions {
  onRefresh: () => void | Promise<void>;
  minInactiveTime?: number; // Minimum time away before refresh (ms)
  enabled?: boolean;
}

export function useAutoRefresh({
  onRefresh,
  minInactiveTime = 30000, // 30 seconds default
  enabled = true,
}: UseAutoRefreshOptions) {
  const lastActiveRef = useRef(Date.now());
  const hasRefreshedRef = useRef(false);

  const handleVisibilityChange = useCallback(() => {
    if (!enabled) return;

    if (document.visibilityState === 'visible') {
      const inactiveTime = Date.now() - lastActiveRef.current;
      
      // Only refresh if user was away for minimum time and hasn't already refreshed
      if (inactiveTime >= minInactiveTime && !hasRefreshedRef.current) {
        hasRefreshedRef.current = true;
        onRefresh();
        
        // Reset the flag after a short delay
        setTimeout(() => {
          hasRefreshedRef.current = false;
        }, 1000);
      }
    } else {
      // User is leaving - record the time
      lastActiveRef.current = Date.now();
    }
  }, [onRefresh, minInactiveTime, enabled]);

  const handleFocus = useCallback(() => {
    if (!enabled) return;

    const inactiveTime = Date.now() - lastActiveRef.current;
    
    if (inactiveTime >= minInactiveTime && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true;
      onRefresh();
      
      setTimeout(() => {
        hasRefreshedRef.current = false;
      }, 1000);
    }
  }, [onRefresh, minInactiveTime, enabled]);

  const handleBlur = useCallback(() => {
    lastActiveRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleVisibilityChange, handleFocus, handleBlur, enabled]);
}
