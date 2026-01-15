import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExchangeRateResult {
  rate: number;
  fromCurrency: string;
  toCurrency: string;
  fetchedAt: string;
  source: string;
  warning?: string;
}

export function useExchangeRate(from = 'USD', to = 'INR') {
  const [rate, setRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [source, setSource] = useState<string>('');

  const fetchRate = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('exchange-rates', {
        body: null,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Edge function returns data directly, need to parse URL params differently
      // Use a custom fetch for GET with query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-rates?from=${from}&to=${to}${forceRefresh ? '&refresh=true' : ''}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rate: ${response.status}`);
      }

      const result: ExchangeRateResult = await response.json();

      if (result.rate) {
        setRate(result.rate);
        setLastUpdated(new Date(result.fetchedAt));
        setSource(result.source);
        if (result.warning) {
          console.warn('Exchange rate warning:', result.warning);
        }
      }
    } catch (err) {
      console.error('Failed to fetch exchange rate:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange rate');
      // Use fallback rate
      setRate(83.5);
      setSource('fallback');
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  const refresh = useCallback(() => {
    return fetchRate(true);
  }, [fetchRate]);

  return {
    rate,
    isLoading,
    error,
    lastUpdated,
    source,
    refresh,
  };
}
