import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiResponse } from '../services/api';

interface UseApiOptions<T> {
  initialData?: T;
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

interface UseApiReturn<T, P extends any[]> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  execute: (...args: P) => Promise<T | null>;
  refetch: () => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
}

export function useApi<T, P extends any[] = []>(
  apiFunction: (...args: P) => Promise<ApiResponse<T>>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T, P> {
  const { initialData = null, immediate = false, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const argsRef = useRef<P | null>(null);

  const execute = useCallback(async (...args: P): Promise<T | null> => {
    argsRef.current = args;
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFunction(...args);
      
      if (response.success && response.data !== undefined) {
        setData(response.data);
        onSuccess?.(response.data);
        return response.data;
      } else {
        const errorMessage = response.error || 'Request failed';
        setError(errorMessage);
        onError?.(errorMessage);
        return null;
      }
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiFunction, onSuccess, onError]);

  const refetch = useCallback(async (): Promise<T | null> => {
    if (argsRef.current) {
      return execute(...argsRef.current);
    }
    return execute(...([] as unknown as P));
  }, [execute]);

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setIsLoading(false);
  }, [initialData]);

  useEffect(() => {
    if (immediate) {
      execute(...([] as unknown as P));
    }
  }, []);

  return {
    data,
    isLoading,
    error,
    execute,
    refetch,
    reset,
    setData,
  };
}

// Hook for paginated data
interface UsePaginatedApiOptions<T> extends UseApiOptions<T[]> {
  pageSize?: number;
}

interface UsePaginatedApiReturn<T, P extends Record<string, any> = Record<string, any>> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  total: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  execute: (...args: any[]) => Promise<void>;
}

export function usePaginatedApi<T, P extends Record<string, any> = Record<string, any>>(
  apiFunction: (params: P & { page: number; limit: number }) => Promise<ApiResponse<T[]>>,
  options: UsePaginatedApiOptions<T> = {}
): UsePaginatedApiReturn<T, P> {
  const { initialData = [], pageSize = 20, onSuccess, onError } = options;
  
  const [data, setData] = useState<T[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const paramsRef = useRef<P | null>(null);

  const execute = useCallback(async (...args: any[]): Promise<void> => {
    const params = (args[0] as P) || ({} as P);
    paramsRef.current = params;
    setIsLoading(true);
    setError(null);
    setPage(1);

    try {
      const response = await apiFunction({ ...params, page: 1, limit: pageSize });
      
      if (response.success && response.data) {
        setData(response.data);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setTotal(response.pagination.total);
        }
        onSuccess?.(response.data);
      } else {
        setError(response.error || 'Request failed');
        onError?.(response.error || 'Request failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      onError?.(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiFunction, pageSize, onSuccess, onError]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (isLoading || page >= totalPages) return;

    const nextPage = page + 1;
    setIsLoading(true);

    try {
      const params = paramsRef.current || ({} as P);
      const response = await apiFunction({ ...params, page: nextPage, limit: pageSize });
      
      if (response.success && response.data) {
        setData((prev: T[]) => [...prev, ...response.data!]);
        setPage(nextPage);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiFunction, pageSize, page, totalPages, isLoading]);

  const refresh = useCallback(async (): Promise<void> => {
    const params = paramsRef.current || ({} as P);
    await execute(params);
  }, [execute]);

  return {
    data,
    isLoading,
    error,
    page,
    totalPages,
    total,
    hasMore: page < totalPages,
    loadMore,
    refresh,
    execute,
  };
}

export default useApi;
