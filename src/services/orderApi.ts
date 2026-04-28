import { getStoredToken } from './authApi';

import { API_BASE_URL } from '../constants';
import { buildSignatureHeaders } from './signature';
import { logDevApiFailure } from '../utils/devLog';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface DesignatedShootingItem {
  note: string;
  photo: string;
}

export interface ItemDetails {
  notes?: string;
  designatedShooting?: DesignatedShootingItem[];
}

export interface CreateOrderRequest {
  cartItems: string[];
  quantities: Record<string, number>;
  estimatedShippingCostBySeller?: Record<string, number>;
  netExpectedTotalKRW: number;
  userCouponUsageId?: string;
  userShippingCouponUsageId?: string;
  pointsToUse?: number;
  orderType: 'General' | 'VVIC' | 'Rocket';
  transferMethod: 'air' | 'ship';
  flow: 'general';
  paymentMethod: 'deposit' | 'bank' | 'billgate';
  /** BillGate service code (e.g. '0900' credit, '1100' mobile, '1800' VA,
   *  '1000' bank transfer, or 'KAKAOPAY' / 'NAVERPAY' / 'SAMSUNGPAY' /
   *  'APPLEPAY' for simple-pay routes). Required when paymentMethod is
   *  'billgate'; backend uses it to sign the billgatePaymentData payload.
   *  An empty string means "show all methods on the BillGate window". */
  serviceCode?: string;
  /** Used by depositAmountKRW field in some flows (kept optional). */
  depositAmountKRW?: number;
  itemDetails?: Record<string, ItemDetails>;
  addressId: string;
  notes?: string;
  /**
   * Live-commerce code carried over from cart items. Normally the
   * backend reads this from the cart item itself (set at addToCart
   * time), but we forward it here too as a safety net so the order is
   * tagged with `LS` prefix even if cart item state somehow drops it.
   */
  liveCode?: string;
}

/** Item shape for POST /orders/direct-purchase (from checkout selectedItems) */
export interface DirectPurchaseOrderItem {
  offerId: number;
  source: string;
  originalSource?: string;
  subject: string;
  subjectTrans?: string;
  imageUrl: string;
  promotionUrl?: string;
  skuInfo: any;
  companyName: string | Record<string, string>;
  sellerOpenId: string;
  quantity: number;
  minOrderQuantity?: number;
  addedAt?: string;
  categoryName?: Record<string, string>;
  categoryId?: number;
  previewFinalUnitPriceKRW?: number;
  designatedShooting?: DesignatedShootingItem[];
  [key: string]: any;
}

export interface CreateOrderDirectPurchaseRequest {
  items: DirectPurchaseOrderItem[];
  designatedShootingImageCount?: number;
  estimatedShippingCostBySeller?: Record<string, number>;
  addressId: string;
  paymentMethod: 'deposit' | 'bank' | 'billgate';
  serviceCode?: string;
  transferMethod: 'air' | 'ship';
  flow: 'general';
  userCouponUsageId?: string;
  userShippingCouponUsageId?: string;
  pointsToUse?: number;
  netExpectedTotalKRW: number;
  depositAmountKRW?: number;
  /** Same purpose as CreateOrderRequest.liveCode — see that field's docs. */
  liveCode?: string;
}

export interface OrderResponse {
  order: {
    _id: string;
    orderNumber: string;
    user: string;
    items: any[];
    addressId: string;
    shippingAddress: any;
    subtotal: number;
    shippingCost: number;
    tax: number;
    discount: number;
    totalAmount: number;
    currency: string;
    paymentMethod: string;
    paymentStatus: string;
    orderStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  /** Present when paymentMethod === 'billgate'. Forward verbatim to the
   *  BillGate WebView (matches taoexpress-ui's `paymentData` field name on
   *  prepareBillgatePayment). */
  billgatePaymentData?: import('../lib/billgate/types').BillgatePaymentData;
}

export interface OrderItemSkuAttribute {
  attributeId: number;
  attributeName: string;
  attributeNameTrans?: string;
  attributeNameMultiLang?: Record<string, string>;
  value: string;
  valueTrans?: string;
  valueMultiLang?: Record<string, string>;
  skuImageUrl?: string;
}

export interface OrderItem {
  id: string;
  itemUniqueNo?: number;
  offerId: string;
  specId: string;
  skuId: string;
  subject: string;
  subjectTrans?: string;
  subjectMultiLang?: Record<string, string>;
  imageUrl: string;
  promotionUrl?: string;
  price: number;
  userPrice?: number;
  quantity: number;
  subtotal: number;
  userShippingFee?: number;
  skuAttributes?: OrderItemSkuAttribute[];
  companyName: string | Record<string, string>;
  categoryName?: Record<string, string>;
  sellerOpenId: string;
  notes?: string;
  designatedShooting?: DesignatedShootingItem[];
  externalOrderId?: string;
  source?: string;
}

export interface FirstTierCost {
  productTotalKRW?: number;
  chinaShippingKRW?: number;
  baseInternationalShippingKRW?: number;
  serviceFee?: number;
  serviceFeeAmountKRW?: number;
  totalKRW?: number;
  addOnAtCreation?: any[];
  _id?: string;
}

export interface OrderPayment {
  tier: string;
  amountKRW: number;
  status: string;
  paidAt?: string;
  paymentMethod?: string;
  depositTransactionId?: string;
  couponIds?: string[];
  userCouponUsageIds?: string[];
  _id?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  progressStatus: string;
  orderStatus: string;
  shippingStatus: string;
  warehouseStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  firstTierCost?: FirstTierCost;
  secondTierCost?: any;
  orderPayments?: OrderPayment[];
  paidAmount?: number;
  totalAmount?: number;
  currency: string;
  items: OrderItem[];
  shippingAddress: any;
  transferMethod: string;
  warehouseCode?: string;
  trackingNumber?: string;
  childOrders: any[];
  isParentOrder: boolean;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    note?: string;
    changedBy?: string;
    actionType?: string;
    content?: string;
    detail?: string;
    _id: string;
  }>;
  customerReturnRequest?: any;
  refundStatus?: string;
  isRefundProcessing?: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface GetOrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  platformCounts?: Record<string, number>;
  viewFilterCounts?: Record<string, number>;
}

/** Query params for GET /orders */
export type ViewFilterType = 'all' | 'unpaid' | 'to_be_shipped' | 'shipped' | 'processed';
export interface GetOrdersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  datePeriod?: string;
  platform?: string;
  viewFilter?: ViewFilterType;
  progressStatus?: string;
  hasSimplifiedClearance?: boolean;
  transferMethod?: 'air' | 'ship';
  periodFrom?: string;
  periodTo?: string;
  /**
   * Country/locale filter. Required by the backend for live-orders
   * pages — the live-order list endpoint returns nothing without it
   * (e.g. `orders?page=1&pageSize=10&country=ko&progressStatus=BUY_PAY_WAIT`).
   */
  country?: string;
}

/** Order preview (POST /orders/preview) - for detail order */
export interface OrderPreviewCargo {
  amount: number;
  finalUnitPrice: number;
  specId: string;
  skuId: number;
  offerId: number;
  openOfferId?: string;
  cargoPromotionList?: any[];
}
export interface OrderPreviewItem {
  tradeModeNameList?: string[];
  status: boolean;
  taoSampleSinglePromotion?: boolean;
  sumPayment: number;
  sumCarriage: number;
  sumPaymentNoCarriage: number;
  flowFlag: string;
  cargoList: OrderPreviewCargo[];
  shopPromotionList?: any[];
  tradeModelList?: any[];
  payChannelInfos?: any[];
  tradeServiceList?: any[];
  canUseOfficialSolution?: boolean;
}
export interface OrderPreviewResponse {
  preview: OrderPreviewItem[];
  warehouse: { id: string; code: string; name: string };
}

export const orderApi = {
  /**
   * Pay an existing unpaid order. Mirrors `apiClient.payOrder` in the web's
   * `lib/api/client.ts` — POST /orders/:id/pay with body { paymentMethod }.
   * Backend updates the order's payment method (e.g. 'billgate', 'deposit',
   * 'bank') and, for non-billgate flows, settles the payment internally.
   */
  payOrder: async (
    orderId: string,
    body: { paymentMethod: string },
  ): Promise<ApiResponse<any>> => {
    try {
      const token = await getStoredToken();
      if (!token) {
        return { success: false, error: 'Authentication required. Please log in again.' };
      }
      const url = `${API_BASE_URL}/orders/${orderId}/pay`;
      const signatureHeaders = await buildSignatureHeaders('POST', url, body);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { success: false, error: 'Invalid response from server.' };
      }
      if (!response.ok || parsed?.status !== 'success') {
        return { success: false, error: parsed?.message || `Request failed with status ${response.status}` };
      }
      return { success: true, data: parsed.data };
    } catch (error: any) {
      logDevApiFailure('payOrder', error);
      return { success: false, error: error?.message || 'Failed to pay order.' };
    }
  },

  /**
   * Prepare a BillGate payment payload for an existing order. Used when the
   * create-order response did not include `billgatePaymentData` (e.g. the
   * "Pay" button on an already-created BUY_PAY_WAIT order). Mirrors the
   * web's `apiClient.prepareBillgatePayment`:
   *   POST /payments/billgate/prepare with body { orderId, serviceCode? }.
   */
  prepareBillgatePayment: async (
    orderId: string,
    serviceCode: string = '0900',
  ): Promise<ApiResponse<{ paymentData: import('../lib/billgate/types').BillgatePaymentData }>> => {
    try {
      const token = await getStoredToken();
      if (!token) {
        return { success: false, error: 'Authentication required. Please log in again.' };
      }
      const url = `${API_BASE_URL}/payments/billgate/prepare`;
      const body = { orderId, serviceCode };
      const signatureHeaders = await buildSignatureHeaders('POST', url, body);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { success: false, error: 'Invalid response from server.' };
      }
      if (!response.ok || parsed?.status !== 'success') {
        return { success: false, error: parsed?.message || `Request failed with status ${response.status}` };
      }
      return { success: true, data: parsed.data };
    } catch (error: any) {
      logDevApiFailure('prepareBillgatePayment', error);
      return { success: false, error: error?.message || 'Failed to prepare BillGate payment.' };
    }
  },

  /**
   * Backward-compatible alias used by some mobile screens.
   * Returns the payload under `billgatePaymentData`, matching create-order.
   */
  initiateBillGatePayment: async (
    orderId: string,
    serviceCode: string = '0900',
  ): Promise<ApiResponse<{ billgatePaymentData: import('../lib/billgate/types').BillgatePaymentData }>> => {
    const response = await orderApi.prepareBillgatePayment(orderId, serviceCode);
    if (!response.success || !response.data?.paymentData) {
      return { success: false, error: response.error || response.message || 'Failed to prepare BillGate payment.' };
    }

    return {
      success: true,
      data: {
        billgatePaymentData: response.data.paymentData,
      },
    };
  },

  /**
   * Existing unpaid-order BillGate flow:
   *   1. Tell backend this order is being paid via BillGate
   *   2. Ask backend to sign and return BillGate paymentData
   */
  startBillgateOrderPayment: async (
    orderId: string,
    serviceCode: string = '0900',
  ): Promise<ApiResponse<{ billgatePaymentData: import('../lib/billgate/types').BillgatePaymentData }>> => {
    const payResponse = await orderApi.payOrder(orderId, { paymentMethod: 'billgate' });
    if (!payResponse.success) {
      return {
        success: false,
        error: payResponse.error || payResponse.message || 'Failed to set payment method to BillGate.',
      };
    }

    return orderApi.initiateBillGatePayment(orderId, serviceCode);
  },

  getOrders: async (params?: GetOrdersParams | number, pageSize?: number): Promise<ApiResponse<GetOrdersResponse>> => {
    try {
      let token = await getStoredToken();
      if (!token) {
        // Retry once after a short delay — token may not be in AsyncStorage yet on first mount
        await new Promise(resolve => setTimeout(resolve, 500));
        token = await getStoredToken();
        if (!token) {
          return {
            success: false,
            error: 'Authentication required. Please log in again.',
          };
        }
      }
      const p: GetOrdersParams =
        typeof params === 'number'
          ? { page: params, pageSize: pageSize ?? 10 }
          : { page: 1, pageSize: 10, ...params };
      const searchParams = new URLSearchParams();
      if (p.page != null) searchParams.set('page', String(p.page));
      if (p.pageSize != null) searchParams.set('pageSize', String(p.pageSize));
      if (p.search) searchParams.set('search', p.search);
      if (p.datePeriod) searchParams.set('datePeriod', p.datePeriod);
      if (p.platform) searchParams.set('platform', p.platform);
      if (p.viewFilter) searchParams.set('viewFilter', p.viewFilter);
      if (p.progressStatus) searchParams.set('progressStatus', p.progressStatus);
      if (p.hasSimplifiedClearance !== undefined) searchParams.set('hasSimplifiedClearance', String(p.hasSimplifiedClearance));
      if (p.transferMethod) searchParams.set('transferMethod', p.transferMethod);
      if (p.periodFrom) searchParams.set('periodFrom', p.periodFrom);
      if (p.periodTo) searchParams.set('periodTo', p.periodTo);
      if (p.country) searchParams.set('country', p.country);
      const query = searchParams.toString();
      const url = `${API_BASE_URL}/orders${query ? `?${query}` : ''}`;
      const signatureHeaders = await buildSignatureHeaders('GET', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        return {
          success: false,
          error: 'Invalid response from server. Please try again.',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: responseData?.message || `Request failed with status ${response.status}`,
        };
      }

      if (responseData.status !== 'success') {
        return {
          success: false,
          error: responseData?.message || 'Failed to get orders',
        };
      }

      return {
        success: true,
        message: responseData.message || 'Orders retrieved successfully',
        data: responseData.data,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  getOrderPreview: async (body?: Record<string, any>): Promise<ApiResponse<OrderPreviewResponse>> => {
    try {
      const token = await getStoredToken();
      if (!token) {
        return {
          success: false,
          error: 'No authentication token found. Please log in again.',
        };
      }
      const url = `${API_BASE_URL}/orders/preview`;
      const payload = body ?? {};
      const signatureHeaders = await buildSignatureHeaders('POST', url, payload);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        return {
          success: false,
          error: 'Invalid response from server. Please try again.',
        };
      }
      if (!response.ok) {
        return {
          success: false,
          error: responseData?.message || `Request failed with status ${response.status}`,
        };
      }
      if (responseData.status !== 'success') {
        return {
          success: false,
          error: responseData?.message || 'Failed to get order preview',
        };
      }
      return {
        success: true,
        message: responseData.message || 'Order preview retrieved successfully',
        data: responseData.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An unexpected error occurred. Please try again.',
      };
    }
  },

  cancelOrder: async (orderId: string): Promise<ApiResponse<{ order?: any }>> => {
    try {
      const token = await getStoredToken();
      if (!token) {
        return {
          success: false,
          error: 'No authentication token found. Please log in again.',
        };
      }
      const url = `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/cancel`;
      const signatureHeaders = await buildSignatureHeaders('PUT', url);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
      });
      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        return {
          success: false,
          error: 'Invalid response from server. Please try again.',
        };
      }
      if (!response.ok) {
        return {
          success: false,
          error: responseData?.message || `Request failed with status ${response.status}`,
        };
      }
      if (responseData.status !== 'success') {
        return {
          success: false,
          error: responseData?.message || 'Failed to cancel order',
        };
      }
      return {
        success: true,
        message: responseData.message || 'Order cancelled successfully',
        data: responseData.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An unexpected error occurred. Please try again.',
      };
    }
  },

  confirmReceived: async (orderId: string): Promise<ApiResponse<{ order?: any }>> => {
    try {
      const token = await getStoredToken();
      if (!token) {
        return { success: false, error: 'No authentication token found. Please log in again.' };
      }
      const url = `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/received`;
      const signatureHeaders = await buildSignatureHeaders('PUT', url);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
      });
      const responseText = await response.text();
      let responseData: any;
      try { responseData = JSON.parse(responseText); } catch {
        return { success: false, error: 'Invalid response from server.' };
      }
      if (!response.ok) {
        return { success: false, error: responseData?.message || `Request failed with status ${response.status}` };
      }
      if (responseData.status !== 'success') {
        return { success: false, error: responseData?.message || 'Failed to confirm receipt' };
      }
      return { success: true, message: responseData.message || 'Order marked as received', data: responseData.data };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred.' };
    }
  },

  getOrderById: async (orderId: string): Promise<ApiResponse<any>> => {
    try {
      const token = await getStoredToken();
      if (!token) return { success: false, error: 'No authentication token found.' };
      const url = `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}`;
      const signatureHeaders = await buildSignatureHeaders('GET', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
      });
      const responseText = await response.text();
      let responseData: any;
      try { responseData = JSON.parse(responseText); } catch {
        return { success: false, error: 'Invalid response from server.' };
      }
      if (!response.ok) return { success: false, error: responseData?.message || `Status ${response.status}` };
      if (responseData.status !== 'success') return { success: false, error: responseData?.message || 'Failed to get order' };
      return { success: true, data: responseData.data };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred.' };
    }
  },

  updateShippingAddress: async (orderId: string, shippingAddress: {
    recipient: string;
    contact: string;
    detailedAddress: string;
    zipCode: string;
    customerClearanceType?: string;
    personalCustomsCode?: string;
    note?: string;
    country?: string;
    province?: string;
    city?: string;
    district?: string;
  }): Promise<ApiResponse<any>> => {
    try {
      const token = await getStoredToken();
      if (!token) return { success: false, error: 'No authentication token found.' };
      const url = `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/shipping-address`;
      const body = { shippingAddress };
      const signatureHeaders = await buildSignatureHeaders('PUT', url, body);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
        body: JSON.stringify(body),
      });
      const responseText = await response.text();
      let responseData: any;
      try { responseData = JSON.parse(responseText); } catch {
        return { success: false, error: 'Invalid response from server.' };
      }
      if (!response.ok) return { success: false, error: responseData?.message || `Status ${response.status}` };
      if (responseData.status !== 'success') return { success: false, error: responseData?.message || 'Failed to update address' };
      return { success: true, data: responseData.data, message: responseData.message };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred.' };
    }
  },

  getRefundAmount: async (orderId: string, items: { itemId: string; quantity: number }[]): Promise<ApiResponse<any>> => {
    try {
      const token = await getStoredToken();
      if (!token) return { success: false, error: 'No authentication token found.' };
      const url = `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/refund-amount`;
      const body = { items };
      const signatureHeaders = await buildSignatureHeaders('POST', url, body);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
        body: JSON.stringify(body),
      });
      const responseText = await response.text();
      let responseData: any;
      try { responseData = JSON.parse(responseText); } catch {
        return { success: false, error: 'Invalid response from server.' };
      }
      if (!response.ok) return { success: false, error: responseData?.message || `Status ${response.status}` };
      if (responseData.status !== 'success') return { success: false, error: responseData?.message || 'Failed to get refund amount' };
      return { success: true, data: responseData.data };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred.' };
    }
  },

  /**
   * Submit a refund request (reason + line items). Evidence images are optional local URIs for future upload support.
   * Backend route is expected alongside GET refund-amount: POST /orders/:orderId/refund-request
   */
  submitRefundRequest: async (
    orderId: string,
    body: {
      reason: string;
      items: { itemId: string; quantity: number }[];
      evidenceImageUris?: string[];
    },
  ): Promise<ApiResponse<any>> => {
    try {
      const token = await getStoredToken();
      if (!token) return { success: false, error: 'No authentication token found.' };
      const url = `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/refund-request`;
      const signatureHeaders = await buildSignatureHeaders('POST', url, body);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
        body: JSON.stringify(body),
      });
      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        return { success: false, error: 'Invalid response from server.' };
      }
      if (!response.ok) {
        return { success: false, error: responseData?.message || `Status ${response.status}` };
      }
      if (responseData.status !== 'success') {
        return { success: false, error: responseData?.message || 'Failed to submit refund request' };
      }
      return { success: true, data: responseData.data, message: responseData.message };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred.' };
    }
  },

  createOrder: async (request: CreateOrderRequest): Promise<ApiResponse<OrderResponse>> => {
    try {
      const token = await getStoredToken();
      // console.log('🛒 CREATE ORDER - ACCESS TOKEN:', token);

      if (!token) {
        return {
          success: false,
          error: 'No authentication token found. Please log in again.',
        };
      }

      const url = `${API_BASE_URL}/orders`;
      console.log('🛒 CREATE ORDER REQUEST URL:', url);
      console.log('🛒 CREATE ORDER REQUEST BODY:', JSON.stringify(request, null, 2));
      const signatureHeaders = await buildSignatureHeaders('POST', url, request);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
        body: JSON.stringify(request),
      });

      console.log('🛒 CREATE ORDER RESPONSE STATUS:', response.status);

      const responseText = await response.text();
      console.log('🛒 CREATE ORDER RESPONSE TEXT:', responseText);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log('🛒 CREATE ORDER RESPONSE DATA:', JSON.stringify(responseData, null, 2));
      } catch (parseError) {
        logDevApiFailure('orderApi.createOrder.parse', parseError);
        return {
          success: false,
          error: 'Invalid response from server. Please try again.',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: responseData?.message || `Request failed with status ${response.status}`,
        };
      }

      if (responseData.status !== 'success') {
        return {
          success: false,
          error: responseData?.message || 'Failed to create order',
        };
      }

      return {
        success: true,
        message: responseData.message || 'Order created successfully',
        data: responseData.data,
      };
    } catch (error: any) {
      console.error('🛒 CREATE ORDER ERROR:', error);
      const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  createOrderDirectPurchase: async (request: CreateOrderDirectPurchaseRequest): Promise<ApiResponse<OrderResponse>> => {
    try {
      const token = await getStoredToken();
      if (!token) {
        return {
          success: false,
          error: 'No authentication token found. Please log in again.',
        };
      }
      const url = `${API_BASE_URL}/orders/direct-purchase`;
      const signatureHeaders = await buildSignatureHeaders('POST', url, request);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...signatureHeaders,
        },
        body: JSON.stringify(request),
      });
      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        return {
          success: false,
          error: 'Invalid response from server. Please try again.',
        };
      }
      if (!response.ok) {
        return {
          success: false,
          error: responseData?.message || `Request failed with status ${response.status}`,
        };
      }
      if (responseData.status !== 'success') {
        return {
          success: false,
          error: responseData?.message || 'Failed to create order',
        };
      }
      return {
        success: true,
        message: responseData.message || 'Order created successfully',
        data: responseData.data,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};


