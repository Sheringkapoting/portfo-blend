import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CachedSnapshot {
  id: string;
  snapshot_date: string;
  total_investment: number;
  current_value: number;
  total_pnl: number;
  pnl_percent: number;
  holdings_count: number;
  created_at: string;
}

interface CacheData {
  snapshot: CachedSnapshot | null;
  timestamp: Date | null;
  version: string;
}

const CACHE_KEY = 'portfolio_cache';
const CACHE_VERSION = '1.0';
const CACHE_TTL_HOURS = 24;

export function usePortfolioCache() {
  const { user } = useAuth();
  const [cachedSnapshot, setCachedSnapshot] = useState<CachedSnapshot | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<Date | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(true);
  const [isUsingCache, setIsUsingCache] = useState(false);

  // Load from localStorage first, then validate with server
  const loadFromLocalStorage = useCallback((): CacheData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached) as CacheData;
      
      // Check version and TTL
      if (data.version !== CACHE_VERSION) return null;
      if (!data.timestamp) return null;

      const cacheAge = Date.now() - new Date(data.timestamp).getTime();
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);

      if (cacheAgeHours > CACHE_TTL_HOURS) return null;

      return data;
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return null;
    }
  }, []);

  // Save to localStorage
  const saveToLocalStorage = useCallback((snapshot: CachedSnapshot) => {
    try {
      const data: CacheData = {
        snapshot,
        timestamp: new Date(),
        version: CACHE_VERSION,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }, []);

  // Fetch latest snapshot from server
  const fetchLatestSnapshot = useCallback(async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        return data[0] as CachedSnapshot;
      }
      return null;
    } catch (e) {
      console.error('Error fetching snapshot:', e);
      return null;
    }
  }, [user]);

  // Initialize cache
  useEffect(() => {
    const initCache = async () => {
      setIsLoadingCache(true);

      // Try localStorage first
      const localCache = loadFromLocalStorage();
      if (localCache?.snapshot) {
        setCachedSnapshot(localCache.snapshot);
        setCacheTimestamp(new Date(localCache.timestamp!));
        setIsUsingCache(true);
        setIsLoadingCache(false);
      }

      // Then fetch fresh from server
      const serverSnapshot = await fetchLatestSnapshot();
      if (serverSnapshot) {
        setCachedSnapshot(serverSnapshot);
        setCacheTimestamp(new Date(serverSnapshot.created_at));
        saveToLocalStorage(serverSnapshot);
        setIsUsingCache(true);
      }

      setIsLoadingCache(false);
    };

    if (user) {
      initCache();
    } else {
      setIsLoadingCache(false);
    }
  }, [user, loadFromLocalStorage, saveToLocalStorage, fetchLatestSnapshot]);

  // Refresh cache
  const refreshCache = useCallback(async () => {
    setIsLoadingCache(true);
    const snapshot = await fetchLatestSnapshot();
    if (snapshot) {
      setCachedSnapshot(snapshot);
      setCacheTimestamp(new Date(snapshot.created_at));
      saveToLocalStorage(snapshot);
    }
    setIsLoadingCache(false);
  }, [fetchLatestSnapshot, saveToLocalStorage]);

  // Clear cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setCachedSnapshot(null);
    setCacheTimestamp(null);
    setIsUsingCache(false);
  }, []);

  // Get cache age in human-readable format
  const getCacheAge = useCallback(() => {
    if (!cacheTimestamp) return null;

    const diffMs = Date.now() - cacheTimestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }, [cacheTimestamp]);

  return {
    cachedSnapshot,
    cacheTimestamp,
    isLoadingCache,
    isUsingCache,
    refreshCache,
    clearCache,
    getCacheAge,
  };
}
