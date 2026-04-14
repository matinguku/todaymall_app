import axios from 'axios';
import { getStoredToken } from './authApi';
import { API_BASE_URL } from '../constants';
import { ApiResponse } from '../types';

export interface SellerDashboardResponse {
  salesAmount?: number;
  orderCount?: number;
  rebateAmount?: number;
  pendingSettlement?: number;
  monthlySales?: number;
  monthlyOrders?: number;
  monthlyRebate?: number;
  averageOrderValue?: number;
  activeSellers?: number;
  rebateRate?: number;
  chart?: {
    donut?: Array<{ label: string; value: number; color: string }>;
    bar1?: Array<{ label: string; value: number; color: string }>;
    bar2?: Array<{ label: string; value: number; color: string }>;
  };
}

export interface SellerDirectTeamMember {
  sellerId: string;
  name: string;
  amount: number;
  count: number;
  rebate: number;
}

export interface SellerDirectTeamResponse {
  team?: SellerDirectTeamMember[];
  members?: SellerDirectTeamMember[];
  totalSales?: number;
  totalOrders?: number;
  totalRebate?: number;
}

const getAuthHeaders = async () => {
  const token = await getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const sellerApi = {
  getSellerDashboard: async (): Promise<ApiResponse<SellerDashboardResponse | null>> => {
    try {
      const url = `${API_BASE_URL}/v1/users/seller/dashboard`;
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      };
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to load seller dashboard.';
      return {
        success: false,
        message,
        data: null,
      };
    }
  },

  getSellerDirectTeam: async (): Promise<ApiResponse<SellerDirectTeamResponse | null>> => {
    try {
      const url = `${API_BASE_URL}/v1/users/seller/direct-team`;
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      };
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to load seller direct team.';
      return {
        success: false,
        message,
        data: null,
      };
    }
  },
};
