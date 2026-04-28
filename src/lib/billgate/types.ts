/**
 * BillGate type declarations.
 * Direct port of taoexpress-ui's hook + global type, sized for RN.
 */

/**
 * Form payload returned by:
 *   1. POST /v1/orders                  → response.data.billgatePaymentData
 *   2. POST /v1/payments/billgate/prepare → response.data.paymentData
 *
 * The mobile WebView forwards this verbatim into the BillGate certify form
 * and lets `window.GX_pay()` submit it.
 */
export interface BillgatePaymentData {
  SERVICE_ID: string;
  SERVICE_TYPE: string;
  SERVICE_CODE: string;
  AMOUNT: string;
  ITEM_NAME: string;
  ITEM_CODE: string;
  USER_ID: string;
  USER_NAME: string;
  USER_EMAIL: string;
  ORDER_ID: string;
  ORDER_DATE: string;
  RETURN_URL: string;
  CANCEL_URL: string;
  CHECK_SUM?: string;
  WEBAPI_FLAG?: string;
  HASH_KEY?: string;
  CANCEL_FLAG: string;
  CHARSET: string;          // EUC-KR per BillGate manual
  RESERVED1: string;
  RESERVED2: string;
  RESERVED3: string;
  INSTALLMENT_PERIOD?: string;
  [key: string]: string | undefined;
}

/** Result handed back to the screen that opened BillgatePaymentScreen. */
export type BillgateResultStatus = 'success' | 'cancel' | 'failed';

export interface BillgateResult {
  status: BillgateResultStatus;
  /** ORDER_ID (= merchant orderNumber) when known. */
  orderId?: string;
  /** BillGate transaction id, when the success page surfaces it. */
  transactionId?: string;
  /** Free-form message (RESPONSE_MESSAGE / detailMessage / error). */
  message?: string;
}
