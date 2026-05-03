import { API_BASE_URL } from '../constants';
import { buildSignatureHeaders } from './signature';

export interface GuestRequestCodeData {
  expiresInSeconds: number;
}

export interface GuestApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 15000;

const postUnauthenticated = async <T>(
  path: string,
  body: Record<string, any>,
): Promise<GuestApiResponse<T>> => {
  const url = `${API_BASE_URL}/${path.replace(/^\//, '')}`;
  // Explicitly stringify the body once so we (a) print the same bytes that
  // get sent over the wire and (b) avoid RN's noisy object dump.
  const bodyString = JSON.stringify(body);
  console.log('[guestOrderApi] POST URL  :', url);
  console.log('[guestOrderApi] POST BODY :', bodyString);
  const signatureHeaders = await buildSignatureHeaders('POST', url, body);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...signatureHeaders,
      },
      body: bodyString,
      signal: controller.signal,
    });

    //console.log('[guestOrderApi] fetch completed', response?.message);
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.log('[guestOrderApi] fetch threw', err?.name, err?.message);
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Request timed out. Please try again.' };
    }
    return { success: false, error: 'Cannot reach the server. Please check your network.' };
  }
  clearTimeout(timeoutId);

  console.log('[guestOrderApi] response', response.status, url);
  const text = await response.text();
  // Truncate long bodies so the log line stays readable; full payloads
  // (e.g. the lookupOrders response) can be many kilobytes.
  console.log('[guestOrderApi] response BODY:', text.slice(0, 800));
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    console.log('[guestOrderApi] non-JSON body:', text.slice(0, 200));
    return { success: false, error: 'Invalid response from server.' };
  }

  if (!response.ok) {
    return { success: false, error: data?.message || `Request failed with status ${response.status}` };
  }
  if (data?.status && data.status !== 'success') {
    return { success: false, error: data?.message || 'Request failed' };
  }

  return { success: true, message: data?.message, data: data?.data };
};

export interface GuestLookupOrdersBody {
  quantity: number;
  price: number;
  paymentMethod: string;
  netExpectedTotalKRW: number;
  estimatedShippingCostBySeller: Record<string, any>;
  userName: string;
  phone: string;
  recipient: string;
  contact: string;
  personalCustomsCode: string;
  mainAddress: string;
  detailedAddress: string;
  zipCode: string;
}

export const guestOrderApi = {
  /**
   * POST guest-checkout/orders/lookup/request-code
   * body: { phone }
   * Server replies whether the code was sent (the response wording is
   * deliberately vague — it does not confirm whether the phone has any
   * guest orders, to avoid leaking that signal).
   */
  requestCode: (phone: string) =>
    postUnauthenticated<GuestRequestCodeData>(
      'guest-checkout/orders/lookup/request-code',
      { phone },
    ),

  /**
   * Auto-verify the 6-digit code once it's fully entered.
   * NOTE: endpoint and request shape are placeholders — confirm with the
   * service spec before relying on this. Likely shape: POST
   * guest-checkout/orders/lookup/verify-code  body: { phone, code }.
   * The token returned in `data.token` is what `lookupOrders` consumes.
   */
  verifyCode: (phone: string, code: string, recipient: string) =>
    postUnauthenticated<{ verified?: boolean; token?: string }>(
      'guest-checkout/orders/lookup/verify-code',
      { phone, code, recipient },
    ),

  /**
   * POST guest-checkout/{token}/orders
   * Fired after the code is verified, when the user taps "Order Inquiry".
   * The token is interpolated into the path; the body is the checkout
   * payload (most fields currently sourced from the modal + hardcoded
   * defaults — see LoginScreen.handleNonMemberOrderInquiry).
   */
  lookupOrders: (token: string, body: GuestLookupOrdersBody) =>
    postUnauthenticated<any>(
      `guest-checkout/${encodeURIComponent(token)}/orders`,
      body as unknown as Record<string, any>,
    ),
};
