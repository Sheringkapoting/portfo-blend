import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EnrichedHolding } from '@/types/portfolio';
import { toast } from 'sonner';

interface SmartSearchResult {
  matchedSymbols: string[];
  filterDescription: string;
  sortBy: 'pnlPercent' | 'currentValue' | 'investedValue' | 'name' | null;
  sortOrder: 'asc' | 'desc';
}

export function useSmartSearch(allHoldings: EnrichedHolding[]) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SmartSearchResult | null>(null);
  const [filteredHoldings, setFilteredHoldings] = useState<EnrichedHolding[]>([]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResult(null);
      setFilteredHoldings([]);
      return;
    }

    setIsSearching(true);

    try {
      // Prepare holdings data for AI
      const holdingsData = allHoldings.map(h => ({
        symbol: h.symbol,
        name: h.name,
        sector: h.sector,
        type: h.type,
        source: h.source,
        investedValue: h.investedValue,
        currentValue: h.currentValue,
        pnlPercent: h.pnlPercent,
      }));

      const { data, error } = await supabase.functions.invoke('smart-search', {
        body: { query, holdings: holdingsData },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const result: SmartSearchResult = {
        matchedSymbols: data.matchedSymbols || [],
        filterDescription: data.filterDescription || '',
        sortBy: data.sortBy || null,
        sortOrder: data.sortOrder || 'desc',
      };

      setSearchResult(result);

      // Filter holdings based on matched symbols
      let matched = allHoldings.filter(h => 
        result.matchedSymbols.includes(h.symbol)
      );

      // Apply sorting if specified
      if (result.sortBy) {
        matched = [...matched].sort((a, b) => {
          const aVal = a[result.sortBy!] as number;
          const bVal = b[result.sortBy!] as number;
          return result.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
      }

      setFilteredHoldings(matched);

      if (matched.length === 0) {
        toast.info('No holdings match your search criteria');
      } else {
        toast.success(`Found ${matched.length} matching holdings`);
      }
    } catch (err) {
      console.error('Smart search error:', err);
      toast.error(err instanceof Error ? err.message : 'Search failed');
      setSearchResult(null);
      setFilteredHoldings([]);
    } finally {
      setIsSearching(false);
    }
  }, [allHoldings]);

  const clearSearch = useCallback(() => {
    setSearchResult(null);
    setFilteredHoldings([]);
  }, []);

  return {
    search,
    clearSearch,
    isSearching,
    searchResult,
    filteredHoldings,
    hasActiveSearch: searchResult !== null,
  };
}
