import { useState, useCallback, useRef } from 'react';
import { productsApi } from '../services/productsApi';

/** Identifies which PDP request produced a callback (avoids stale overwrites). */
export type ProductDetailRequestContext = {
  productId: string;
  source: string;
  country: string;
};

interface UseProductDetailMutationOptions {
  onSuccess?: (data: any, ctx: ProductDetailRequestContext) => void;
  onError?: (error: string, ctx: ProductDetailRequestContext) => void;
}

interface UseProductDetailMutationResult {
  mutate: (
    productId: string,
    source?: string,
    country?: string
  ) => Promise<void>;
  data: any;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export const useProductDetailMutation = (
  options?: UseProductDetailMutationOptions
): UseProductDetailMutationResult => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const inFlightRef = useRef(0);

  const mutate = useCallback(async (
    productId: string,
    source: string = '1688',
    country: string = 'en'
  ) => {
    const rawSrc = String(source ?? '1688').trim();
    const detailSource = rawSrc.toLowerCase() === 'taobao' ? 'taobao' : rawSrc || '1688';
    const ctx: ProductDetailRequestContext = { productId, source: detailSource, country };
    const seq = ++inFlightRef.current;
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      const response = await productsApi.getProductDetail(productId, detailSource, country);

      if (seq !== inFlightRef.current) {
        return;
      }

      if (response.success && response.data) {
        setData(response.data);
        setIsSuccess(true);
        options?.onSuccess?.(response.data, ctx);
      } else {
        const errorMessage = response.message || 'Failed to fetch product detail';
        console.log('Product detail error:', errorMessage);
        setError(errorMessage);
        setIsError(true);
        options?.onError?.(errorMessage, ctx);
      }
    } catch (err: any) {
      if (seq !== inFlightRef.current) {
        return;
      }
      const errorMessage = 'An unexpected error occurred. Please try again.';
      console.error('Product detail error2:', err);
      setError(errorMessage);
      setIsError(true);
      options?.onError?.(errorMessage, ctx);
    } finally {
      if (seq === inFlightRef.current) {
        setIsLoading(false);
      }
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

