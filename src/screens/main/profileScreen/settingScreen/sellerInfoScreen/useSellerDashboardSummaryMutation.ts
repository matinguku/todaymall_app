import { useCallback, useState } from 'react';
import { API_BASE_URL } from '../../../../../constants';
import { getStoredToken } from '../../../../../services/authApi';
import { buildSignatureHeaders } from '../../../../../services/signature';

type SummaryRange = {
  from: string;
  to: string;
};

export type SellerDashboardSummary = {
  range: SummaryRange;
  salesAmountKrw: number;
  salesQuantity: number;
  refundAmountKrw: number;
  refundQuantity: number;
  rebatePersonalAccruedKrw: number;
  rebatePersonalDeductedKrw: number;
  rebateTeamAccruedKrw: number;
  rebateTeamDeductedKrw: number;
  averageOrderValueKrw: number;
  refundRate: number;
};

export type SellerDirectTeamMember = {
  sellerId: string;
  name: string;
  amount: number;
  count: number;
  rebate: number;
};

type UseSellerDashboardSummaryMutationResult = {
  mutate: () => Promise<void>;
  summary: SellerDashboardSummary | null;
  directTeam: SellerDirectTeamMember[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
};

const normalizeSummary = (summary: Partial<SellerDashboardSummary> | null | undefined): SellerDashboardSummary => ({
  range: {
    from: summary?.range?.from || '',
    to: summary?.range?.to || '',
  },
  salesAmountKrw: Number(summary?.salesAmountKrw || 0),
  salesQuantity: Number(summary?.salesQuantity || 0),
  refundAmountKrw: Number(summary?.refundAmountKrw || 0),
  refundQuantity: Number(summary?.refundQuantity || 0),
  rebatePersonalAccruedKrw: Number(summary?.rebatePersonalAccruedKrw || 0),
  rebatePersonalDeductedKrw: Number(summary?.rebatePersonalDeductedKrw || 0),
  rebateTeamAccruedKrw: Number(summary?.rebateTeamAccruedKrw || 0),
  rebateTeamDeductedKrw: Number(summary?.rebateTeamDeductedKrw || 0),
  averageOrderValueKrw: Number(summary?.averageOrderValueKrw || 0),
  refundRate: Number(summary?.refundRate || 0),
});

const normalizeDirectTeam = (members: unknown): SellerDirectTeamMember[] => {
  if (!Array.isArray(members)) {
    return [];
  }

  return members.map((member: any, index: number) => ({
    sellerId: String(member?.sellerId || member?.memberId || member?.id || `TEAM-${index + 1}`),
    name: String(member?.name || member?.memberName || '-'),
    amount: Number(member?.amount || member?.salesAmountKrw || 0),
    count: Number(member?.count || member?.salesQuantity || 0),
    rebate: Number(member?.rebate || member?.rebateAccruedKrw || 0),
  }));
};

export const useSellerDashboardSummaryMutation = (): UseSellerDashboardSummaryMutationResult => {
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [directTeam, setDirectTeam] = useState<SellerDirectTeamMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);

  const mutate = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setIsError(false);

    try {
      const token = await getStoredToken();
      if (!token) {
        throw new Error('Please sign in again.');
      }

      const url = `${API_BASE_URL}/users/seller/dashboard`;
      const signatureHeaders = await buildSignatureHeaders('GET', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...signatureHeaders,
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
        throw new Error(message);
      }

      const data = payload?.data || {};
      setSummary(normalizeSummary(data.summary));
      setDirectTeam(normalizeDirectTeam(data.directTeam));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load seller dashboard summary.';
      setError(message);
      setIsError(true);
      setSummary(null);
      setDirectTeam([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    mutate,
    summary,
    directTeam,
    isLoading,
    isError,
    error,
  };
};
