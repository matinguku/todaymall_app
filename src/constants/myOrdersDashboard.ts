/**
 * Profile "My Orders" card buckets + BuyList deep-link filters.
 * Aligns with BuyListScreen STATUS_GROUPS / PROGRESS_STATUS_META where applicable.
 */

/** Purchase payment completed (excludes pending payment + problem purchase). */
export const MY_ORDERS_PAYMENT_COMPLETED_STATUSES: readonly string[] = [
  'BUY_PAY_DONE',
  'BUYING_MANUAL',
  'BUYING_FINANCIAL_SETTLEMENT',
  'BUY_FINAL_DONE',
];

/**
 * Awaiting shipment / warehouse stage (local inbound–outbound + outbound payment).
 * Includes statuses mapped to warehouse in PROGRESS_STATUS_META, including
 * WH_IN_EXPECTED / WH_PAY_DONE omitted from STATUS_GROUPS chip list but valid API values.
 */
export const MY_ORDERS_WAREHOUSE_STATUSES: readonly string[] = [
  'WH_ARRIVE_EXPECTED',
  'WH_IN_EXPECTED',
  'DELIVERY_EXCEPTION',
  'WH_IN_PROGRESS',
  'WH_IN_DONE',
  'WH_PICK_DONE',
  'WH_PAY_WAIT',
  'WH_PAY_DONE',
  'WH_SHIPPED',
];

/** International shipping group (same scope as BuyList "국제운송" tab). */
export const MY_ORDERS_INTERNATIONAL_SHIPPING_STATUSES: readonly string[] = [
  'INTERNATIONAL_SHIPPING',
  'INTERNATIONAL_SHIPPED',
  'ORDER_RECEIVED',
];

export const MY_ORDERS_INTERNATIONAL_IN_TRANSIT_STATUSES: readonly string[] = ['INTERNATIONAL_SHIPPING'];

const REFUND_STATUSES: readonly string[] = ['USER_REFUND_REQ', 'USER_REFUND_COMPLETED'];

export type MyOrdersDashboardCounts = {
  paymentCompleted: number;
  awaitingShipmentPayment: number;
  internationalShipping: number;
  /** In-transit abroad only — used for express quick-access card. */
  internationalInTransit: number;
  /** Orders with line items (same basis as BuyList list). */
  viewAll: number;
  refunds: number;
};

function hasDisplayableItems(o: any): boolean {
  return Array.isArray(o?.items) && o.items.length > 0;
}

export function computeMyOrdersDashboardCounts(orders: unknown): MyOrdersDashboardCounts {
  const empty: MyOrdersDashboardCounts = {
    paymentCompleted: 0,
    awaitingShipmentPayment: 0,
    internationalShipping: 0,
    internationalInTransit: 0,
    viewAll: 0,
    refunds: 0,
  };
  if (!Array.isArray(orders)) return empty;

  const paySet = new Set(MY_ORDERS_PAYMENT_COMPLETED_STATUSES);
  const whSet = new Set(MY_ORDERS_WAREHOUSE_STATUSES);
  const intlSet = new Set(MY_ORDERS_INTERNATIONAL_SHIPPING_STATUSES);
  const intlTransitSet = new Set(MY_ORDERS_INTERNATIONAL_IN_TRANSIT_STATUSES);
  const refundSet = new Set(REFUND_STATUSES);

  const counts = { ...empty };

  for (const order of orders) {
    const o = order as any;
    if (!hasDisplayableItems(o)) continue;
    counts.viewAll += 1;
    const ps: string | undefined = o?.progressStatus;
    if (!ps) continue;
    if (paySet.has(ps)) counts.paymentCompleted += 1;
    if (whSet.has(ps)) counts.awaitingShipmentPayment += 1;
    if (intlSet.has(ps)) counts.internationalShipping += 1;
    if (intlTransitSet.has(ps)) counts.internationalInTransit += 1;
    if (refundSet.has(ps)) counts.refunds += 1;
  }

  return counts;
}
