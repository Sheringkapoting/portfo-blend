import { useState, useCallback, useRef, useEffect } from 'react';

interface UseInfiniteScrollOptions {
  initialPageSize?: number;
  threshold?: number;
}

interface UseInfiniteScrollReturn<T> {
  displayedItems: T[];
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function useInfiniteScroll<T>(
  items: T[],
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn<T> {
  const { initialPageSize = 15, threshold = 100 } = options;
  
  const [displayCount, setDisplayCount] = useState(initialPageSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hasMore = displayCount < items.length;
  const displayedItems = items.slice(0, displayCount);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    
    // Simulate smooth loading with small delay for animation
    loadTimeoutRef.current = setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + initialPageSize, items.length));
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMore, initialPageSize, items.length]);

  const reset = useCallback(() => {
    setDisplayCount(initialPageSize);
    setIsLoadingMore(false);
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
  }, [initialPageSize]);

  // Reset when items change (e.g., filter change)
  useEffect(() => {
    reset();
  }, [items.length, reset]);

  // Handle scroll event
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < threshold && hasMore && !isLoadingMore) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, loadMore, threshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  return {
    displayedItems,
    isLoadingMore,
    hasMore,
    loadMore,
    reset,
    containerRef,
  };
}
