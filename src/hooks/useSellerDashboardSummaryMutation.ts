import { useCallback, useState } from 'react';

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

const FALLBACK_SUMMARY: SellerDashboardSummary = {
  range: {
    from: '2026-01-01',
    to: '2026-12-31',
  },
  salesAmountKrw: 2170000,
  salesQuantity: 326,
  refundAmountKrw: 184000,
  refundQuantity: 27,
  rebatePersonalAccruedKrw: 162000,
  rebatePersonalDeductedKrw: 23000,
  rebateTeamAccruedKrw: 97000,
  rebateTeamDeductedKrw: 12000,
  averageOrderValueKrw: 6656,
  refundRate: 8.2,
};

const FALLBACK_DIRECT_TEAM: SellerDirectTeamMember[] = [
  { sellerId: 'S001', name: 'John Kim', amount: 420000, count: 58, rebate: 19000 },
  { sellerId: 'S002', name: 'Alice Lee', amount: 360000, count: 51, rebate: 16000 },
  { sellerId: 'S003', name: 'David Park', amount: 520000, count: 74, rebate: 21000 },
  { sellerId: 'S004', name: 'Emma Choi', amount: 290000, count: 43, rebate: 12000 },
];

/**
 * Temporary local data source for seller dashboard summary.
 * Replace with API integration when backend endpoints are available.
 */
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
      setSummary(FALLBACK_SUMMARY);
      setDirectTeam(FALLBACK_DIRECT_TEAM);
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
