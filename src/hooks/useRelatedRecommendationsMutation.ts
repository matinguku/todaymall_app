import { useState, useCallback } from 'react';
import { prefetchRelated } from '../utils/relatedPrefetch';

interface UseRelatedRecommendationsMutationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface UseRelatedRecommendationsMutationResult {
  mutate: (
    productId: string,
    pageNo?: number,
    pageSize?: number,
    language?: string,
    source?: string
  ) => Promise<void>;
  data: any;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export const useRelatedRecommendationsMutation = (
  options?: UseRelatedRecommendationsMutationOptions
): UseRelatedRecommendationsMutationResult => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const mutate = useCallback(async (
    productId: string,
    pageNo: number = 1,
    pageSize: number = 10,
    language: string = 'en',
    source: string = '1688'
  ) => {
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      // Route through the cache so callers can pre-warm the next page in
      // the background. The cache key includes pageNo, so different pages
      // get their own slot and never collide.
      const response = await prefetchRelated({
        productId,
        pageNo,
        pageSize,
        language,
        source,
      });

      if (response.success && response.data) {
        setData(response.data);
        setIsSuccess(true);
        options?.onSuccess?.(response.data);
      } else {
        const errorMessage = response.message || 'Failed to fetch related recommendations';
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

