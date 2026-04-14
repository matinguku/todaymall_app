import { useCallback, useState } from 'react';
import { sellerApi, SellerDashboardResponse } from '../services/sellerApi';

interface UseSellerDashboardMutationOptions {
  onSuccess?: (data: SellerDashboardResponse) => void;
  onError?: (error: string) => void;
}

interface UseSellerDashboardMutationResult {
  mutate: () => Promise<void>;
  data: SellerDashboardResponse | null;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export const useSellerDashboardMutation = (
  options?: UseSellerDashboardMutationOptions
): UseSellerDashboardMutationResult => {
  const [data, setData] = useState<SellerDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const mutate = useCallback(async () => {
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      const response = await sellerApi.getSellerDashboard();

      if (response.success && response.data) {
        setData(response.data);
        setIsSuccess(true);
        options?.onSuccess?.(response.data);
      } else {
        const errorMessage = response.message || 'Failed to load seller dashboard.';
        setError(errorMessage);
        setIsError(true);
        options?.onError?.(errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'An unexpected error occurred while loading the seller dashboard.';
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
