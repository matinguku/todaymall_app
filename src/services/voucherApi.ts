import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { getStoredToken } from './authApi';
import { buildSignatureHeaders } from './signature';

export interface Coupon {
  id: string;
  usageId: string;
  couponId: string;
  name: string;
  type: string;
  amount: number;
  minPurchaseAmount: number;
  validFrom: string;
  validUntil: string;
  receivedAt: string;
  status: 'received' | 'used' | 'expired';
}

export interface PointTransaction {
  id: string;
  type: 'earn' | 'spend';
  amount: number;
  description: string;
  date: string;
  orderId?: string;
}

export interface VoucherWalletData {
  availableCoupons: Coupon[];
  usedCoupons: Coupon[];
  expiredCoupons: Coupon[];
  points: {
    balance: number;
    recentTransactions: PointTransaction[];
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/** Stable id for one coupon usage row (dedupe across API buckets). */
export function couponUsageStableKey(c: Partial<Coupon>): string {
  const u = c.usageId ?? c.id ?? '';
  if (u !== '' && u != null) return String(u).trim();
  const cid = c.couponId ?? '';
  const recv = c.receivedAt ?? '';
  if (cid !== '' || recv !== '') return `${String(cid)}|${String(recv)}`;
  return '';
}

export type CouponBucket = 'available' | 'used' | 'expired';

/** Classify a single coupon for wallet tabs — matches what we render per tab. */
export function classifyCouponBucket(c: Partial<Coupon>, nowMs: number = Date.now()): CouponBucket {
  const s = String(c.status ?? '')
    .trim()
    .toLowerCase();
  if (s === 'used' || s === 'redeemed' || s === 'consumed' || s === 'applied') return 'used';
  if (s === 'expired') return 'expired';
  const vuRaw = c.validUntil ?? (c as { valid_until?: string }).valid_until;
  if (vuRaw) {
    const vu = new Date(String(vuRaw)).getTime();
    if (!Number.isNaN(vu) && vu < nowMs) return 'expired';
  }
  // received, pending, empty → unused list
  return 'available';
}

function pickDominantCouponDuplicate(a: Coupon, b: Coupon, nowMs: number): Coupon {
  const rank = (x: Coupon) => {
    const k = classifyCouponBucket(x, nowMs);
    return k === 'used' ? 3 : k === 'expired' ? 2 : 1;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (rb > ra) return { ...a, ...b };
  if (ra > rb) return { ...b, ...a };
  return { ...a, ...b };
}

/**
 * Rebuild available / used / expired arrays from all coupon rows so tab counts
 * match the rendered lists (handles duplicate ids across buckets or mis-tagged items).
 */
/** Sum `amount` fields — same numbers rendered as red face values on coupon cards (before `formatPriceKRW`). */
export function sumCouponFaceValues(coupons: Coupon[]): number {
  if (!Array.isArray(coupons)) return 0;
  return coupons.reduce((sum, c) => {
    const raw = c.amount;
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export function normalizeVoucherWalletData(data: VoucherWalletData): VoucherWalletData {
  const now = Date.now();
  const merged = [
    ...(data.availableCoupons || []),
    ...(data.usedCoupons || []),
    ...(data.expiredCoupons || []),
  ];
  const byKey = new Map<string, Coupon>();
  for (const c of merged) {
    const key = couponUsageStableKey(c);
    if (!key) continue;
    const prev = byKey.get(key);
    byKey.set(key, prev ? pickDominantCouponDuplicate(prev, c, now) : c);
  }
  const unique = Array.from(byKey.values());
  const availableCoupons: Coupon[] = [];
  const usedCoupons: Coupon[] = [];
  const expiredCoupons: Coupon[] = [];
  for (const c of unique) {
    const bucket = classifyCouponBucket(c, now);
    if (bucket === 'used') usedCoupons.push(c);
    else if (bucket === 'expired') expiredCoupons.push(c);
    else availableCoupons.push(c);
  }
  return {
    ...data,
    availableCoupons,
    usedCoupons,
    expiredCoupons,
  };
}

export const voucherApi = {
  // Get voucher wallet data (coupons and points)
  getVoucherWallet: async (): Promise<ApiResponse<VoucherWalletData>> => {
    try {
      const token = await getStoredToken();
      const url = `${API_BASE_URL}/voucher-wallet`;
      const signatureHeaders = await buildSignatureHeaders('GET', url);
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...signatureHeaders,
        },
      });
      console.log('🎟️ [Voucher Wallet API] Response:', response.data);
      if (response.data && response.data.status === 'success' && response.data.data) {
        return {
          success: true,
          data: response.data.data,
        };
      }

      return {
        success: false,
        message: 'Failed to fetch voucher wallet data',
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch voucher wallet';
      return {
        success: false,
        message: errorMessage,
      };
    }
  },

  // Apply coupon code (receive coupon)
  applyCouponCode: async (couponCode: string): Promise<ApiResponse<Coupon>> => {
    try {
      const token = await getStoredToken();
      const url = `${API_BASE_URL}/coupons/receive`;
      const signatureHeaders = await buildSignatureHeaders('POST', url, {
        code: couponCode,
      });
      const response = await axios.post(url, {
        code: couponCode,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...signatureHeaders,
        },
      });

      if (response.data && response.data.status === 'success') {
        // Map the response to our Coupon interface
        const usage = response.data.data.usage;
        const coupon = response.data.data.coupon;
        
        const mappedCoupon: Coupon = {
          id: usage._id,
          usageId: usage._id,
          couponId: coupon._id,
          name: coupon.name,
          type: coupon.type,
          amount: coupon.amount,
          minPurchaseAmount: coupon.minPurchaseAmount,
          validFrom: usage.validFrom,
          validUntil: usage.validUntil,
          receivedAt: usage.receivedAt,
          status: usage.status,
        };
        
        return {
          success: true,
          data: mappedCoupon,
          message: response.data.message || 'Coupon received successfully',
        };
      }

      return {
        success: false,
        message: 'Failed to receive coupon',
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to receive coupon';
      return {
        success: false,
        message: errorMessage,
      };
    }
  },
};
