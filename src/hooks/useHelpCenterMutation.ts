import { useState, useCallback } from 'react';
import { getHelpCenter } from '../services/authApi';

interface HelpCenterData {
  columns: any[];
  guides: any[];
  faqsByCategory: any[];
  footerInfo: any;
  paymentMethods: any[];
  socialLinks: any[];
  viewHelp: any;
}

interface UseHelpCenterMutationOptions {
  onSuccess?: (data: HelpCenterData) => void;
  onError?: (error: string) => void;
}

interface UseHelpCenterMutationResult {
  mutate: () => Promise<void>;
  data: HelpCenterData | null;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export const useHelpCenterMutation = (
  options?: UseHelpCenterMutationOptions
): UseHelpCenterMutationResult => {
  const [data, setData] = useState<HelpCenterData | null>(null);
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
      const response = await getHelpCenter();

      if (response.success && response.data) {
        setData(response.data);
        setIsSuccess(true);
        options?.onSuccess?.(response.data);
      } else {
        const errorMessage = response.error || 'Failed to fetch help center data';
        setError(errorMessage);
        setIsError(true);
        options?.onError?.(errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'An unexpected error occurred. Please try again.';
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

