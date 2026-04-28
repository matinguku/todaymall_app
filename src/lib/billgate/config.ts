/**
 * BillGate Payment Configuration
 *
 * Direct port of taoexpress-ui/lib/config/billgate.ts. The mobile WebView
 * loads `scriptUrl` and calls `window.GX_pay(formName, viewType, protocolType)`
 * exactly as the website does.
 */

export interface BillgateConfig {
  scriptUrl: string;
  protocolType: string;
}

export const billgateConfig = {
  test: {
    scriptUrl: 'https://tpay.billgate.net/paygate/plugin/gx_web_client.js',
    protocolType: 'https_tpay',
  },
  production: {
    scriptUrl: 'https://pay.billgate.net/paygate/plugin/gx_web_client.js',
    protocolType: 'https_pay',
  },
} as const;

/**
 * Get BillGate configuration based on environment. Mirrors the web codebase
 * — currently always returns production. Flip to `billgateConfig.test` for
 * sandbox testing once a test SERVICE_ID is wired up.
 */
export const getBillgateConfig = (): BillgateConfig => {
  return billgateConfig.production;
};
