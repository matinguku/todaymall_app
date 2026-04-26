import { useState, useCallback, useRef } from 'react';
import { wishlistApi, WishlistResponse, GetWishlistParams } from '../services/wishlistApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

interface UseGetWishlistMutationOptions {
  onSuccess?: (data: WishlistResponse) => void;
  onError?: (error: string) => void;
}

interface UseGetWishlistMutationResult {
  mutate: (params?: GetWishlistParams) => Promise<void>;
  data: WishlistResponse | null;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

function collectWishlistExternalIds(data: WishlistResponse): string[] {
  const ids: string[] = [];
  if (Array.isArray(data.wishlist)) {
    for (const item of data.wishlist) {
      const id = item.externalId?.toString();
      if (id) ids.push(id);
    }
  }
  if (Array.isArray(data.wishlistByStore)) {
    for (const group of data.wishlistByStore) {
      for (const item of group.items || []) {
        const id = item.externalId?.toString();
        if (id) ids.push(id);
      }
    }
  }
  return [...new Set(ids)];
}

export const useGetWishlistMutation = (
  options?: UseGetWishlistMutationOptions
): UseGetWishlistMutationResult => {
  const [data, setData] = useState<WishlistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const latestRequestId = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutate = useCallback(async (params?: GetWishlistParams) => {
    const reqId = ++latestRequestId.current;
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      const response = await wishlistApi.getWishlist(params);
      if (reqId !== latestRequestId.current) {
        return;
      }

      if (response.success && response.data) {
        setData(response.data);
        setIsSuccess(true);

        const externalIds = collectWishlistExternalIds(response.data);
        await AsyncStorage.setItem(
          STORAGE_KEYS.WISHLIST_EXTERNAL_IDS,
          JSON.stringify(externalIds)
        );

        optionsRef.current?.onSuccess?.(response.data);
      } else {
        const errorMessage = response.message || 'Failed to fetch wishlist';
        setError(errorMessage);
        setIsError(true);
        optionsRef.current?.onError?.(errorMessage);
      }
    } catch (err: any) {
      if (reqId !== latestRequestId.current) {
        return;
      }
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
      setIsError(true);
      optionsRef.current?.onError?.(errorMessage);
    } finally {
      if (reqId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  return {
    mutate,
    data,
    error,
    isLoading,
    isSuccess,
    isError,
  };
};

