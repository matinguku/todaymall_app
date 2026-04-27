import { useState, useCallback } from 'react';
import { productsApi } from '../services/productsApi';
import { prefetchDefaultCategories, invalidateHomeCache, homePrefetchKeys } from '../utils/homePrefetch';

interface UseDefaultCategoriesMutationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface UseDefaultCategoriesMutationResult {
  mutate: (platform: string, skipCache?: boolean) => void;
  data: any;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export const useDefaultCategoriesMutation = (
  options?: UseDefaultCategoriesMutationOptions
): UseDefaultCategoriesMutationResult => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const mutate = useCallback(async (platform: string, skipCache: boolean = true) => {
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      // skipCache controls the API-side cache header. Reuse the in-memory
      // home prefetch only when the caller wants the same behavior the
      // splash-time prefetch already kicked off (skipCache=true).
      const response = skipCache
        ? await prefetchDefaultCategories(platform)
        : await productsApi.getDefaultCategories(platform, skipCache);
      
      if (response.success && response.data) {
        setData(response.data);
        setIsSuccess(true);
        options?.onSuccess?.(response.data);
      } else {
        const errorMessage = response.message || 'Failed to fetch default categories';
        setError(errorMessage);
        setIsError(true);
        options?.onError?.(errorMessage);
      }
    } catch (err: any) {
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
      setIsError(true);
      options?.onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  return {
    mutate,
    data,
    error,
    isLoading,
    isSuccess,
    isError,
  };
};


