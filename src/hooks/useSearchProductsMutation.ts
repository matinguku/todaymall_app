import { useState, useCallback } from 'react';
import { prefetchSearch } from '../utils/searchPrefetch';

interface UseSearchProductsMutationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface UseSearchProductsMutationResult {
  mutate: (
    keyword: string,
    source?: string,
    country?: string,
    page?: number,
    pageSize?: number,
    sort?: string,
    priceStart?: number,
    priceEnd?: number,
    filter?: string,
    requireAuth?: boolean,
    sellerOpenId?: string,
  ) => Promise<void>;
  data: any;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export const useSearchProductsMutation = (
  options?: UseSearchProductsMutationOptions
): UseSearchProductsMutationResult => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const mutate = useCallback(async (
    keyword: string,
    source: string = '1688',
    country: string = 'en',
    page: number = 1,
    pageSize: number = 20,
    sort?: string,
    priceStart?: number,
    priceEnd?: number,
    filter?: string,
    requireAuth: boolean = true,
    sellerOpenId?: string,
  ) => {
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      // Route every search through the shared in-memory cache so consumers
      // can pre-warm the next page (page N+1) the moment page N arrives.
      // Cache key includes every parameter, so different filters/pages get
      // their own slot.
      const response = await prefetchSearch({
        keyword,
        source,
        country,
        page,
        pageSize,
        sort,
        priceStart,
        priceEnd,
        filter,
        requireAuth,
        sellerOpenId,
      });
      
      if (response.success && response.data) {
        setData(response.data);
        setIsSuccess(true);
        options?.onSuccess?.(response.data);
      } else {
        const errorMessage = response.message || 'Failed to search products';
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

