/**
 * Live commerce product code helpers.
 *
 * Live products carry a numeric code (e.g. "574061") at the END of the
 * product name. The backend uses this code to mark the order as a "live"
 * order — those orders get an `LS` prefix on their order number (e.g.
 * `LS20260427A0007`) and become discoverable via the live-orders list
 * (`GET /orders?country=ko&progressStatus=BUY_PAY_WAIT`).
 *
 * The client first checks the product object itself for an explicit
 * `liveCode`-like field (in case the backend already exposes it). If
 * none is found we fall back to parsing the trailing digits of the
 * product name. The minimum digit count is ≥3 (relaxed from the
 * original ≥4) to catch shorter codes; combined with the `isLiveSource`
 * gate this keeps false positives away from regular ownmall products.
 */

const LIVE_SOURCE_VALUES = new Set(['live-commerce', 'live']);

/** True when the product was navigated from a live-commerce origin. */
export function isLiveSource(source: unknown): boolean {
  if (typeof source !== 'string') return false;
  return LIVE_SOURCE_VALUES.has(source.toLowerCase());
}

/** Field names the backend may expose the code under, in priority order. */
export const EXPLICIT_LIVE_CODE_FIELDS = [
  'liveCode',
  'live_code',
  'liveCodeSnapshot',
  'live_code_snapshot',
  'liveCommerceCode',
  'liveCommerceId',
  'liveProductCode',
  'live_product_code',
  'listingLiveCode',
  'listing_live_code',
  'liveBroadcastCode',
  'live_broadcast_code',
  'broadcastCode',
  'broadcastId',
  'broadcast_code',
  'broadcast_id',
] as const;

/**
 * Look for an explicit liveCode-like field on a product object before
 * falling back to name parsing. Returns the stringified value or null.
 */
export function pickExplicitLiveCode(product: unknown): string | null {
  if (!product || typeof product !== 'object') return null;
  const p = product as Record<string, unknown>;
  for (const key of EXPLICIT_LIVE_CODE_FIELDS) {
    const v = p[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

/**
 * Same as {@link pickExplicitLiveCode} but walks common nesting paths used by
 * live-commerce listing APIs (`product`, `productData`, `listing`, etc.) so
 * we do not fall back to `offerId` when `liveCode` only exists on a child.
 */
export function pickExplicitLiveCodeFromTree(root: unknown): string | null {
  if (root == null || typeof root !== 'object') return null;
  const r = root as Record<string, unknown>;
  const product = r.product as Record<string, unknown> | undefined;
  const buckets: unknown[] = [
    root,
    r.raw,
    r.product,
    r.productData,
    product?.productData,
    r.listing,
    r.liveProduct,
    r.liveListing,
  ];
  for (const b of buckets) {
    const hit = pickExplicitLiveCode(b);
    if (hit) return hit;
  }
  const nestKeys = ['data', 'result', 'detail', 'attributes', 'info'] as const;
  for (const k of nestKeys) {
    const sub = r[k];
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      const hit = pickExplicitLiveCode(sub);
      if (hit) return hit;
      const subObj = sub as Record<string, unknown>;
      const inner = pickExplicitLiveCode(subObj.product) ?? pickExplicitLiveCode(subObj.productData);
      if (inner) return inner;
    }
  }
  return null;
}

/**
 * Extract a trailing numeric code from one of the candidate name strings.
 * Returns `null` when no ≥3-digit trailing run is found.
 */
export function extractLiveCode(...names: Array<string | null | undefined>): string | null {
  for (const raw of names) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    // ≥3 trailing digits, optionally followed by simple punctuation /
    // whitespace. Combined with the isLiveSource() gate in
    // resolveLiveCode, this keeps regular product titles (which can
    // also end with digits) from being mistagged as live.
    const match = trimmed.match(/(\d{3,})[\s.,)\]]*$/);
    if (match) return match[1];
  }
  return null;
}

function purchaseSourceIsLive(v: unknown): boolean {
  return String(v ?? '').trim().toLowerCase() === 'live';
}

/**
 * Own-mall order / checkout line marked as a live broadcast product
 * (`ownmallProductType: "live"` from API), distinct from PDP `live-commerce` route.
 */
export function isOwnmallLiveLineItem(item: unknown): boolean {
  if (item == null || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;
  const t = String(r.ownmallProductType ?? r.ownmall_product_type ?? '').trim().toLowerCase();
  if (t === 'live') return true;
  return purchaseSourceIsLive(r.purchaseSource);
}

/**
 * Value to send as `liveCode` for POST /orders/direct-purchase (and similar)
 * when the checkout row is an own-mall live line. Uses explicit live fields,
 * then `productNo` (e.g. "X308"), then trailing digits from titles.
 */
export function resolveLiveCodeForOwnmallOrderLine(item: unknown): string | null {
  if (item == null || typeof item !== 'object') return null;
  const explicit = pickExplicitLiveCodeFromTree(item) ?? pickExplicitLiveCode(item);
  if (explicit) return explicit;
  if (!isOwnmallLiveLineItem(item)) return null;
  const r = item as Record<string, unknown>;
  const pn = r.productNo ?? r.product_no;
  if (pn != null) {
    const s = String(pn).trim();
    if (s) return s;
  }
  const multiLang = r.subjectMultiLang as Record<string, unknown> | undefined;
  const multiVals = multiLang
    ? Object.values(multiLang).filter((x): x is string => typeof x === 'string')
    : [];
  return extractLiveCode(
    typeof r.subject === 'string' ? r.subject : undefined,
    typeof r.subjectTrans === 'string' ? r.subjectTrans : undefined,
    ...multiVals,
  );
}

/**
 * Resolve the liveCode for a product when (and only when) it was
 * navigated from a live-commerce origin. Tries the explicit product
 * field first, then falls back to parsing the candidate name strings.
 * Returns `null` for non-live products.
 */
export function resolveLiveCode(
  source: unknown,
  product: unknown,
  ...names: Array<string | null | undefined>
): string | null {
  if (!isLiveSource(source)) return null;
  return pickExplicitLiveCodeFromTree(product) ?? extractLiveCode(...names);
}

/**
 * Backend rules for `liveCode` on `/cart`, checkout, and orders: exactly six
 * digits, or `LV` plus six alphanumeric characters (case-insensitive LV).
 */
export function isStrictBackendLiveCode(value: unknown): boolean {
  const s = value != null ? String(value).trim() : '';
  if (!s) return false;
  if (/^\d{6}$/.test(s)) return true;
  return /^LV[a-zA-Z0-9]{6}$/i.test(s);
}

/** Returns trimmed `liveCode` only when it satisfies {@link isStrictBackendLiveCode}. */
export function sanitizeLiveCodeForApi(value: unknown): string | undefined {
  const s = value != null ? String(value).trim() : '';
  if (!s) return undefined;
  return isStrictBackendLiveCode(s) ? s : undefined;
}

/**
 * When PDP is opened from live-commerce, the listing code is often passed
 * only as navigation `productId` (numeric). Reject Mongo-style 24-hex ids.
 */
function liveCodeFromRouteProductId(routeProductId: unknown): string | undefined {
  const raw = routeProductId != null ? String(routeProductId).trim() : '';
  if (!raw) return undefined;
  if (/^[a-f\d]{24}$/i.test(raw)) return undefined;
  // Typical live listing codes are short numeric strings; cap length so we
  // do not treat a long numeric id as a live code.
  if (/^\d{3,12}$/.test(raw)) return raw;
  return undefined;
}

/**
 * Live code for POST `/cart` and `/cart/checkout/direct-purchase` when the
 * user opened PDP from live-commerce. Prefer the navigation param, then
 * explicit fields on the product payload, then title parsing, then the
 * numeric `productId` route param when it is a short digit code (not a Mongo id).
 * Send this together with catalog `offerId` / `productId` when the provider expects both.
 */
export function getLiveCodeForCartPayload(
  routeSource: unknown,
  product: unknown,
  routeLiveCode?: unknown,
  routeProductId?: unknown,
): string | undefined {
  if (!isLiveSource(routeSource)) return undefined;
  const nav =
    routeLiveCode != null && String(routeLiveCode).trim() !== ''
      ? String(routeLiveCode).trim()
      : '';
  if (nav) {
    const ok = sanitizeLiveCodeForApi(nav);
    if (ok) return ok;
  }
  const p = product as { name?: string; subject?: string; subjectTrans?: string } | null | undefined;
  const fromProduct =
    resolveLiveCode(routeSource, product, p?.name, p?.subject, p?.subjectTrans) ?? undefined;
  const sProd = sanitizeLiveCodeForApi(fromProduct);
  if (sProd) return sProd;
  return sanitizeLiveCodeForApi(liveCodeFromRouteProductId(routeProductId));
}

/** First explicit live-code-like value on any checkout / order line row. */
export function pickFirstExplicitLiveCodeFromRows(rows: unknown): string | undefined {
  if (!Array.isArray(rows)) return undefined;
  for (const row of rows) {
    const hit =
      pickExplicitLiveCodeFromTree(row) ??
      pickExplicitLiveCode(row) ??
      resolveLiveCodeForOwnmallOrderLine(row);
    const ok = sanitizeLiveCodeForApi(hit);
    if (ok) return ok;
  }
  return undefined;
}

/**
 * Live listing / broadcast code on a checkout or order line
 * (explicit fields, plain `liveCode` / `live_code`, or own-mall live SKU rules).
 */
export function resolveLiveLineCode(it: unknown): string | null {
  if (it == null || typeof it !== 'object') return null;
  const o = it as Record<string, unknown>;
  const fromPick = pickExplicitLiveCodeFromTree(it) ?? pickExplicitLiveCode(it);
  if (fromPick && String(fromPick).trim()) {
    const ok = sanitizeLiveCodeForApi(fromPick);
    if (ok) return ok;
  }
  const raw = o.liveCode ?? o.live_code;
  if (raw != null && String(raw).trim() !== '') {
    const ok = sanitizeLiveCodeForApi(raw);
    if (ok) return ok;
  }
  return resolveLiveCodeForOwnmallOrderLine(it);
}

/**
 * When the order carries a top-level `liveCode`, merge it onto direct-purchase
 * lines that lack one so POST /orders/direct-purchase matches checkout. Does
 * not remove catalog `offerId` / `productId` — the provider uses them together
 * with `liveCode` per your workflow.
 */
export function augmentDirectPurchaseItemsWithOrderLiveCode(
  items: unknown[],
  orderLiveCode: string | undefined,
): unknown[] {
  const lc = sanitizeLiveCodeForApi(orderLiveCode) ?? '';
  if (!lc || !Array.isArray(items)) return items;
  return items.map((it) => {
    if (it == null || typeof it !== 'object') return it;
    const o = it as Record<string, unknown>;
    if (resolveLiveLineCode(o)) return it;
    return { ...o, liveCode: lc, ownmallProductType: o.ownmallProductType ?? o.ownmall_product_type ?? 'live' };
  });
}

/** Field names the service provider may use for the per-line live / agency order id. */
const LIVE_PROVIDER_ORDER_ID_FIELDS = [
  'liveOrderId',
  'live_order_id',
  'liveOrderNumber',
  'live_order_number',
  'serviceProviderOrderId',
  'service_provider_order_id',
  'supplierOrderId',
  'supplier_order_id',
  'externalOrderId',
  'agencyOrderNo',
  'purchaseOrderNo',
] as const;

/**
 * Per–line item: id returned by the live / fulfillment provider (distinct from
 * our cart `offerId`). Used on order UIs instead of inferring from offer id.
 */
export function pickLiveProviderOrderId(root: unknown): string | null {
  if (root == null || typeof root !== 'object') return null;
  const r = root as Record<string, unknown>;
  for (const key of LIVE_PROVIDER_ORDER_ID_FIELDS) {
    const v = r[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  const nestedKeys = ['product', 'lineItem', 'orderItem', 'item'] as const;
  for (const nk of nestedKeys) {
    const sub = r[nk];
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      const hit = pickLiveProviderOrderId(sub);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Same as {@link pickLiveProviderOrderId}, but only when the line is
 * live-commerce ({@link resolveLiveLineCode} non-null). Standard rows may
 * still carry supplier-style ids on nested `product`; those must not be
 * shown as the live "service order" on payment / order UIs.
 */
export function pickLiveProviderOrderIdForLiveLine(item: unknown): string | null {
  if (resolveLiveLineCode(item) == null) return null;
  if (item == null || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  for (const key of ['liveProviderOrderId', 'live_provider_order_id'] as const) {
    const v = r[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return pickLiveProviderOrderId(item);
}

// ─── Order display helpers ────────────────────────────────────────────
// The backend currently returns every order with a `TM` prefix on the
// orderNumber regardless of whether it contained live-commerce items.
// We can detect a "live" order client-side because live products carry
// a numeric code at the END of their subject (e.g. "원피스 574061") —
// the same pattern used by extractLiveCode above. When that pattern
// matches on any item in the order, we swap the displayed prefix from
// `TM` to `LS` so users can distinguish live orders at a glance.

// Loose shapes — accept any order/item-ish object so callers don't have
// to coerce their domain types (e.g. orderApi.OrderItem) at the call
// site. We only read a few optional fields and tolerate everything else.
type OrderItemLoose = {
  subject?: string | null;
  subjectTrans?: string | null;
  subjectMultiLang?: Record<string, string | null | undefined> | null;
  liveCode?: string | number | null;
};

type OrderLoose = {
  orderNumber?: string | null;
  items?: ReadonlyArray<OrderItemLoose | null | undefined> | null;
  childOrders?: ReadonlyArray<unknown> | null;
  purchaseSource?: string | null;
};

/**
 * First explicit live / snapshot code on an order: root, each child order,
 * then each line item under `childOrders` (own-mall parent bundles often
 * keep `items: []` on the parent and put rows on children).
 */
export function pickOrderLiveCodeSnapshot(order: unknown): string | null {
  const o = order as Record<string, unknown> | null | undefined;
  if (!o) return null;
  const tryNode = (node: unknown): string | null => pickExplicitLiveCode(node);
  const root = tryNode(o);
  if (root) return root;
  const flatItems = o.items;
  if (Array.isArray(flatItems)) {
    for (const it of flatItems) {
      const hit = tryNode(it) ?? resolveLiveCodeForOwnmallOrderLine(it);
      if (hit) return hit;
    }
  }
  const children = o.childOrders;
  if (!Array.isArray(children)) return null;
  for (const co of children) {
    const c = tryNode(co);
    if (c) return c;
    const items = (co as Record<string, unknown>)?.items;
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      const hit = tryNode(it) ?? resolveLiveCodeForOwnmallOrderLine(it);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Heuristic check: does the order look like a live-commerce order?
 * Returns `true` when any of the following is detected:
 *   1. `purchaseSource === 'live'` on the order or any child order.
 *   2. Any explicit live / `liveCodeSnapshot` field on order, child, or item.
 *   3. Any flat `items[]` entry matches (2) or subject tail digits (legacy).
 *   4. Any line has `ownmallProductType === 'live'` (own-mall broadcast SKU).
 */
export function hasLiveItem(order: unknown): boolean {
  const o = order as (OrderLoose & { [k: string]: unknown }) | null | undefined;
  if (!o) return false;
  if (purchaseSourceIsLive(o.purchaseSource)) return true;
  if (pickOrderLiveCodeSnapshot(o) != null) return true;
  if (pickExplicitLiveCode(o) != null) return true;
  if (Array.isArray(o.items)) {
    for (const item of o.items) {
      if (!item) continue;
      if (isOwnmallLiveLineItem(item)) return true;
      if (pickExplicitLiveCode(item) != null) return true;
      const multiLangValues = item.subjectMultiLang
        ? Object.values(item.subjectMultiLang).filter(
            (v): v is string => typeof v === 'string',
          )
        : [];
      const code = extractLiveCode(item.subject, item.subjectTrans, ...multiLangValues);
      if (code != null) return true;
    }
  }
  if (Array.isArray(o.childOrders)) {
    for (const co of o.childOrders) {
      if (hasLiveItem(co)) return true;
    }
  }
  return false;
}

/**
 * Returns the order number with the `TM` prefix swapped to `LS` when
 * the order contains live-commerce items. Already-`LS`-prefixed numbers
 * pass through unchanged. Non-live orders also pass through unchanged.
 *
 * Use this anywhere we display the order number to the user. Backend
 * communication (search, navigation, etc.) should still use the raw
 * `order.orderNumber`.
 */
export function getDisplayOrderNumber(order: unknown): string {
  const o = order as OrderLoose | null | undefined;
  const raw = o?.orderNumber ?? '';
  if (!raw) return '';
  if (raw.startsWith('LS')) return raw;
  if (!hasLiveItem(o)) return raw;
  return raw.replace(/^TM/, 'LS');
}
