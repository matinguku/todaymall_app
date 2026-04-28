/**
 * BillGate Payment Method Constants
 * Direct port of taoexpress-ui/lib/constants/billgate.ts so the mobile app's
 * payment-method picker stays in lockstep with the website's options.
 */

export interface BillgatePaymentOption {
  code: string;
  label: string;
  labelKo: string;
  labelEn: string;
  description: string;
  descriptionKo: string;
  descriptionEn: string;
}

/**
 * BillGate payment method options. Service codes per the BillGate
 * Integration Guide §5.1.1, plus simple-pay codes (KAKAOPAY/NAVERPAY/...)
 * that the backend maps to the right SERVICE_ID before signing.
 */
export const BILLGATE_PAYMENT_OPTIONS: BillgatePaymentOption[] = [
  {
    code: '0100',
    label: '도서상품권',
    labelKo: '도서상품권',
    labelEn: 'BookNLife Coupon',
    description: '도서상품권 결제',
    descriptionKo: '도서상품권 결제',
    descriptionEn: 'BookNLife coupon payment',
  },
  {
    code: '0200',
    label: '컬처랜드상품권',
    labelKo: '컬처랜드상품권',
    labelEn: 'Cultureland Coupon',
    description: '컬처랜드상품권 결제',
    descriptionKo: '컬처랜드상품권 결제',
    descriptionEn: 'Cultureland coupon payment',
  },
  {
    code: '0500',
    label: '해피머니상품권',
    labelKo: '해피머니상품권',
    labelEn: 'HappyMoney Coupon',
    description: '해피머니상품권 결제',
    descriptionKo: '해피머니상품권 결제',
    descriptionEn: 'HappyMoney coupon payment',
  },
  {
    code: '0700',
    label: '캐시게이트',
    labelKo: '캐시게이트',
    labelEn: 'Cashgate',
    description: '캐시게이트 결제',
    descriptionKo: '캐시게이트 결제',
    descriptionEn: 'Cashgate payment',
  },
  {
    code: '0900',
    label: '신용카드',
    labelKo: '신용카드',
    labelEn: 'Credit Card',
    description: '신용카드 결제',
    descriptionKo: '신용카드 결제',
    descriptionEn: 'Credit card payment',
  },
  {
    code: '1000',
    label: '무통장',
    labelKo: '무통장',
    labelEn: 'Bank Transfer',
    description: '무통장 결제',
    descriptionKo: '무통장 결제',
    descriptionEn: 'Direct bank transfer',
  },
  {
    code: '1100',
    label: '휴대폰',
    labelKo: '휴대폰',
    labelEn: 'Mobile',
    description: '휴대폰 결제',
    descriptionKo: '휴대폰 결제',
    descriptionEn: 'Mobile payment',
  },
  {
    code: '1800',
    label: '가상계좌',
    labelKo: '가상계좌',
    labelEn: 'Virtual Account',
    description: '가상계좌 결제',
    descriptionKo: '가상계좌 결제',
    descriptionEn: 'Virtual account (bank transfer)',
  },
  {
    code: '2500',
    label: '틴캐시',
    labelKo: '틴캐시',
    labelEn: 'T-Money',
    description: '틴캐시 결제',
    descriptionKo: '틴캐시 결제',
    descriptionEn: 'T-Money payment',
  },
  {
    code: '2600',
    label: '에그머니',
    labelKo: '에그머니',
    labelEn: 'EggMoney',
    description: '에그머니 결제',
    descriptionKo: '에그머니 결제',
    descriptionEn: 'EggMoney payment',
  },
  {
    code: '4100',
    label: '통합포인트',
    labelKo: '통합포인트',
    labelEn: 'Integrated Points',
    description: '통합포인트 결제',
    descriptionKo: '통합포인트 결제',
    descriptionEn: 'Integrated points payment',
  },
  // Simple-pay methods (간편결제) — backend maps to the right SERVICE_ID.
  {
    code: 'KAKAOPAY',
    label: '카카오페이',
    labelKo: '카카오페이',
    labelEn: 'Kakao Pay',
    description: '카카오페이 간편결제',
    descriptionKo: '카카오페이 간편결제',
    descriptionEn: 'Kakao Pay simple payment',
  },
  {
    code: 'NAVERPAY',
    label: '네이버페이',
    labelKo: '네이버페이',
    labelEn: 'Naver Pay',
    description: '네이버페이 간편결제',
    descriptionKo: '네이버페이 간편결제',
    descriptionEn: 'Naver Pay simple payment',
  },
  {
    code: 'SAMSUNGPAY',
    label: '삼성페이',
    labelKo: '삼성페이',
    labelEn: 'Samsung Pay',
    description: '삼성페이 간편결제',
    descriptionKo: '삼성페이 간편결제',
    descriptionEn: 'Samsung Pay simple payment',
  },
  {
    code: 'APPLEPAY',
    label: '애플페이',
    labelKo: '애플페이',
    labelEn: 'Apple Pay',
    description: '애플페이 간편결제',
    descriptionKo: '애플페이 간편결제',
    descriptionEn: 'Apple Pay simple payment',
  },
  // App-internal methods that DON'T go through BillGate.
  {
    code: 'DEPOSIT',
    label: '예치금',
    labelKo: '예치금',
    labelEn: 'Deposit',
    description: '예치금으로 결제',
    descriptionKo: '예치금으로 결제',
    descriptionEn: 'Pay with deposit',
  },
  {
    code: 'BANK',
    label: '무통장입금',
    labelKo: '무통장입금',
    labelEn: 'Bank Transfer (Deposit)',
    description: '입금 안내에 따라 무통장 후 자동 확인',
    descriptionKo: '입금 안내에 따라 무통장 후 자동 확인',
    descriptionEn: 'Transfer to the given account; payment is confirmed automatically',
  },
];

export function getBillgatePaymentOption(code: string): BillgatePaymentOption | undefined {
  return BILLGATE_PAYMENT_OPTIONS.find((option) => option.code === code);
}

export function isSimplePaymentCode(serviceCode: string): boolean {
  return ['KAKAOPAY', 'NAVERPAY', 'SAMSUNGPAY', 'APPLEPAY'].includes(serviceCode);
}

/**
 * Same shape as taoexpress-ui's `getBillgatePaymentOptionsWithSimplePayments`
 * — extra options unlocked for specific QA accounts. Mirrored verbatim.
 */
export function getBillgatePaymentOptionsWithSimplePayments(email: string): BillgatePaymentOption[] {
  const withExtras = ['0900', '1100', '1800', '1000', 'KAKAOPAY', 'NAVERPAY', 'SAMSUNGPAY', 'APPLEPAY', 'DEPOSIT', 'BANK'];
  const standard = ['0900', '1100', '1800', '1000', 'KAKAOPAY', 'NAVERPAY', 'SAMSUNGPAY', 'APPLEPAY', 'BANK'];
  const isExtraUser = [
    'stylistdire68@gmail.com',
    'royhensley0727@gmail.com',
    'aifanatic0105@gmail.com',
    '1156405531@qq.com',
    'taoexpress6663@naver.com',
  ].includes(email);
  const codes = isExtraUser ? withExtras : standard;
  return BILLGATE_PAYMENT_OPTIONS.filter((option) => codes.includes(option.code));
}
