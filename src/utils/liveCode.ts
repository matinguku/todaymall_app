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
const EXPLICIT_LIVE_CODE_FIELDS = [
  'liveCode',
  'live_code',
  'liveCommerceCode',
  'liveCommerceId',
  'broadcastCode',
  'broadcastId',
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
  return pickExplicitLiveCode(product) ?? extractLiveCode(...names);
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
};

/**
 * Heuristic check: does the order look like a live-commerce order?
 * Returns `true` when any of the following is detected:
 *   1. The order itself carries an explicit liveCode-like field.
 *   2. Any item carries an explicit liveCode-like field.
 *   3. Any item's subject ends with ≥3 trailing digits.
 */
export function hasLiveItem(order: unknown): boolean {
  const o = order as (OrderLoose & { [k: string]: unknown }) | null | undefined;
  if (!o) return false;
  // (1) Order-level explicit field
  if (pickExplicitLiveCode(o) != null) return true;
  // (2) and (3) Item-level checks
  if (!Array.isArray(o.items)) return false;
  for (const item of o.items) {
    if (!item) continue;
    if (pickExplicitLiveCode(item) != null) return true;
    const multiLangValues = item.subjectMultiLang
      ? Object.values(item.subjectMultiLang).filter(
          (v): v is string => typeof v === 'string',
        )
      : [];
    const code = extractLiveCode(item.subject, item.subjectTrans, ...multiLangValues);
    if (code != null) return true;
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
