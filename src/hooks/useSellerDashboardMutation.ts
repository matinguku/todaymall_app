import { useCallback, useMemo, useState } from 'react';

export type SellerDashboardMode = 'profit' | 'refund';

type SellerDashboardRequest = {
  search?: string;
  from?: string;
  to?: string;
  mode?: SellerDashboardMode;
  page?: number;
  pageSize?: number;
};

type SellerDashboardItem = {
  firstTierPaidAt: string;
  orderNumber: string;
  orderId: string;
  productNumber: string;
  quantity: number;
  recipient: string;
  paidAmountKrw: number;
  rebateKrw: number;
  trackingNumber: string | null;
  liveCodeSnapshot: string;
};

type UseSellerDashboardMutationResult = {
  mutate: (request: SellerDashboardRequest) => Promise<void>;
  items: SellerDashboardItem[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  isError: boolean;
  error: string | null;
};

const BASE_DATA: SellerDashboardItem[] = Array.from({ length: 42 }).map((_, index) => {
  const seq = index + 1;
  const quantity = (seq % 5) + 1;
  const paidAmount = 12000 + seq * 860;
  return {
    firstTierPaidAt: new Date(2026, 0, (seq % 28) + 1).toISOString(),
    orderNumber: `TM-ORD-${String(10000 + seq)}`,
    orderId: `order-${seq}`,
    productNumber: `PRD-${String(3000 + seq)}`,
    quantity,
    recipient: `Buyer ${seq}`,
    paidAmountKrw: paidAmount,
    rebateKrw: Math.floor(paidAmount * 0.03),
    trackingNumber: seq % 3 === 0 ? null : `TRK${900000 + seq}`,
    liveCodeSnapshot: seq % 2 === 0 ? 'LIVE-SEOUL' : 'LIVE-BUSAN',
  };
});

/**
 * Local in-memory fallback for seller order/refund dashboard.
 * Keeps current screen functional until backend endpoints are wired.
 */
export const useSellerDashboardMutation = (): UseSellerDashboardMutationResult => {
  const [items, setItems] = useState<SellerDashboardItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (request: SellerDashboardRequest): Promise<void> => {
    const nextPage = request.page ?? 1;
    const nextPageSize = request.pageSize ?? 20;
    const keyword = request.search?.trim().toLowerCase() ?? '';

    if (nextPage > 1) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    setIsError(false);
    setError(null);

    try {
      const filtered = BASE_DATA.filter((row) => {
        if (!keyword) return true;
        return (
          row.orderNumber.toLowerCase().includes(keyword) ||
          row.productNumber.toLowerCase().includes(keyword) ||
          row.recipient.toLowerCase().includes(keyword)
        );
      });

      const start = (nextPage - 1) * nextPageSize;
      const end = start + nextPageSize;
      const paged = filtered.slice(start, end);

      setTotal(filtered.length);
      setPage(nextPage);
      setPageSize(nextPageSize);
      setItems((prev) => (nextPage > 1 ? [...prev, ...paged] : paged));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load seller dashboard data.';
      setIsError(true);
      setError(message);
      if (nextPage === 1) {
        setItems([]);
        setTotal(0);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  return useMemo(
    () => ({
      mutate,
      items,
      total,
      page,
      pageSize,
      isLoading,
      isLoadingMore,
      isError,
      error,
    }),
    [mutate, items, total, page, pageSize, isLoading, isLoadingMore, isError, error]
  );
};
