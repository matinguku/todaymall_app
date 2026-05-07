import { useCallback, useMemo, useState } from 'react';
import { API_BASE_URL } from '../constants';
import { getStoredToken } from '../services/authApi';
import { buildSignatureHeaders } from '../services/signature';

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

export const useSellerDashboardMutation = (): UseSellerDashboardMutationResult => {
  const [items, setItems] = useState<SellerDashboardItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeItem = useCallback((raw: any, index: number): SellerDashboardItem => {
    const num = (value: any): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };
    const str = (value: any): string => (typeof value === 'string' ? value : '');

    return {
      firstTierPaidAt:
        str(raw?.firstTierPaidAt) ||
        str(raw?.paidAt) ||
        str(raw?.paymentDate) ||
        str(raw?.createdAt) ||
        new Date().toISOString(),
      orderNumber: str(raw?.orderNumber) || str(raw?.orderNo) || str(raw?.order_id) || '-',
      orderId: str(raw?.orderId) || str(raw?._id) || str(raw?.id) || `row-${Date.now()}-${index}`,
      productNumber:
        str(raw?.productNumber) ||
        str(raw?.productName) ||
        str(raw?.itemName) ||
        str(raw?.subject) ||
        '-',
      quantity: num(raw?.quantity ?? raw?.salesQuantity ?? raw?.refundQuantity),
      recipient: str(raw?.recipient) || str(raw?.receiverName) || str(raw?.userName) || '-',
      paidAmountKrw: num(raw?.paidAmountKrw ?? raw?.salesAmountKrw ?? raw?.teamSalesAmountKrw ?? raw?.amount),
      rebateKrw: num(raw?.rebateKrw ?? raw?.teamRebateNetKrw ?? raw?.rebateAmountKrw ?? raw?.rebate),
      trackingNumber:
        str(raw?.trackingNumber) ||
        str(raw?.trackingNo) ||
        str(raw?.waybillNo) ||
        null,
      liveCodeSnapshot:
        str(raw?.liveCodeSnapshot) ||
        str(raw?.liveCode) ||
        str(raw?.live_code) ||
        '-',
    };
  }, []);

  const parsePayload = useCallback((payload: any) => {
    const data = payload?.data ?? payload;
    const rows =
      data?.items ??
      data?.orders ??
      data?.list ??
      data?.results ??
      data?.liveOrders ??
      [];
    const arrayRows = Array.isArray(rows) ? rows : [];
    const parsedTotal =
      data?.pagination?.total ??
      data?.total ??
      data?.count ??
      arrayRows.length;
    return {
      rows: arrayRows,
      total: typeof parsedTotal === 'number' ? parsedTotal : Number(parsedTotal) || arrayRows.length,
    };
  }, []);

  const mutate = useCallback(async (request: SellerDashboardRequest): Promise<void> => {
    const nextPage = request.page ?? 1;
    const nextPageSize = request.pageSize ?? 20;
    const mode = request.mode ?? 'profit';

    if (nextPage > 1) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    setIsError(false);
    setError(null);

    try {
      const token = await getStoredToken();
      if (!token) {
        throw new Error('Please sign in again.');
      }

      const endpointCandidates = [
        `${API_BASE_URL}/users/seller/live-orders${mode === 'refund' ? '/refunds' : '/profits'}`,
        `${API_BASE_URL}/users/seller/live-orders`,
      ];

      const params = new URLSearchParams();
      if (request.search) params.set('search', request.search);
      if (request.from) params.set('from', request.from);
      if (request.to) params.set('to', request.to);
      params.set('mode', mode);
      params.set('page', String(nextPage));
      params.set('pageSize', String(nextPageSize));

      let parsedRows: any[] = [];
      let parsedTotal = 0;
      let lastErrorMessage = '';

      for (const endpoint of endpointCandidates) {
        const url = `${endpoint}?${params.toString()}`;
        try {
          const signatureHeaders = await buildSignatureHeaders('GET', url);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              ...signatureHeaders,
            },
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || payload?.status === 'error') {
            lastErrorMessage =
              payload?.message ||
              payload?.error ||
              `Request failed with status ${response.status}`;
            continue;
          }
          const parsed = parsePayload(payload);
          parsedRows = parsed.rows;
          parsedTotal = parsed.total;
          lastErrorMessage = '';
          break;
        } catch (err) {
          lastErrorMessage = err instanceof Error ? err.message : 'Failed to load seller dashboard data.';
        }
      }

      if (lastErrorMessage && parsedRows.length === 0) {
        throw new Error(lastErrorMessage);
      }

      const normalizedRows = parsedRows.map((row, index) => normalizeItem(row, index));

      setTotal(parsedTotal);
      setPage(nextPage);
      setPageSize(nextPageSize);
      setItems((prev) => (nextPage > 1 ? [...prev, ...normalizedRows] : normalizedRows));
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
  }, [normalizeItem, parsePayload]);

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
