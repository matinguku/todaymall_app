/**
 * Local-only live-product tracking via AsyncStorage.
 *
 * The backend may expose `liveCodeSnapshot` / `purchaseSource: live` on
 * orders; for older payloads we still tag live products on the device
 * the moment the user adds one to the cart (or buys it directly). When
 * the orders list later renders, we cross-reference each order item's
 * offerId against the recorded set to decide whether to swap the
 * displayed order-number prefix from `TM` to `LS`.
 *
 * Caveats:
 *   - Per-device only. Records made on phone A aren't visible on phone B.
 *   - Records added BEFORE this feature was deployed are not present, so
 *     historical live orders made earlier won't get the LS prefix until
 *     the user re-visits / re-adds them.
 *
 * Storage shape: a JSON-serialized string[] of offerIds (newest at the
 * end). Capped at 1000 entries to avoid unbounded growth.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'TM_LIVE_PRODUCT_IDS';
// Separate keyspace for the offerId→liveCode map so the existing flat-set
// storage keeps working unchanged (no migration on upgrade).
const LIVE_CODE_MAP_KEY = 'TM_LIVE_PRODUCT_CODE_MAP';
const MAX_ENTRIES = 1000;

function normalizeId(productId: unknown): string {
  if (productId == null) return '';
  return String(productId).trim();
}

/**
 * Record that the given productId came from a live-commerce flow.
 * Idempotent — duplicates are ignored. Best-effort: failures are
 * swallowed because tracking is non-critical UI sugar.
 */
export async function recordLiveProduct(productId: unknown): Promise<void> {
  const id = normalizeId(productId);
  if (!id) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (arr.includes(id)) return;
    arr.push(id);
    const capped = arr.length > MAX_ENTRIES ? arr.slice(-MAX_ENTRIES) : arr;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // best-effort tracking; ignore storage failures
  }
}

/**
 * Record an `offerId → liveCode` mapping locally. Called the moment a live
 * product is added to the cart, so we can later re-attach the `liveCode`
 * when navigating to checkout even if the server cart-line schema drops
 * the field. The cap matches MAX_ENTRIES; eviction is FIFO via Map order.
 * Best-effort: storage failures are swallowed.
 */
export async function recordLiveProductCode(
  offerId: unknown,
  liveCode: unknown,
): Promise<void> {
  const id = normalizeId(offerId);
  const code = normalizeId(liveCode);
  if (!id || !code) return;
  try {
    const raw = await AsyncStorage.getItem(LIVE_CODE_MAP_KEY);
    const obj: Record<string, string> = raw ? JSON.parse(raw) : {};
    if (obj[id] === code) return;
    obj[id] = code;
    const keys = Object.keys(obj);
    if (keys.length > MAX_ENTRIES) {
      const overflow = keys.length - MAX_ENTRIES;
      for (let i = 0; i < overflow; i += 1) {
        delete obj[keys[i]];
      }
    }
    await AsyncStorage.setItem(LIVE_CODE_MAP_KEY, JSON.stringify(obj));
  } catch {
    // best-effort tracking; ignore storage failures
  }
}

/**
 * Returns the locally-recorded `offerId → liveCode` map (newest writes
 * win). Used by the cart-checkout flow to back-fill `liveCode` onto cart
 * lines when the server cart-line response is missing the field.
 * Returns an empty map on storage error.
 */
export async function loadLiveProductCodeMap(): Promise<Map<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(LIVE_CODE_MAP_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return new Map();
    const out = new Map<string, string>();
    for (const k of Object.keys(obj)) {
      const v = (obj as Record<string, unknown>)[k];
      if (typeof v === 'string' && v) out.set(String(k), v);
    }
    return out;
  } catch {
    return new Map();
  }
}

/**
 * Returns the set of all locally-recorded live product offerIds.
 * Returns an empty set on storage error.
 */
export async function loadLiveProductIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set<string>(arr.map(String));
  } catch {
    return new Set();
  }
}

/**
 * True when any item in the order references an offerId that we've
 * tagged as live-origin on this device. Order items can carry the id
 * under different field names depending on the surface, so we check
 * the common ones.
 */
export function orderHasRecordedLiveProduct(
  order: unknown,
  liveProductIds: Set<string>,
): boolean {
  if (liveProductIds.size === 0) return false;
  const o = order as {
    items?: Array<Record<string, unknown> | null | undefined>;
    childOrders?: Array<Record<string, unknown> | null | undefined>;
  } | null | undefined;
  if (!o) return false;

  const checkItem = (item: Record<string, unknown> | null | undefined): boolean => {
    if (!item) return false;
    const candidates = [
      item.offerId,
      item.productId,
      item.itemId,
      item.id,
      item.liveCode,
      item.liveCodeSnapshot,
      item.live_code,
    ];
    for (const c of candidates) {
      const id = normalizeId(c);
      if (id && liveProductIds.has(id)) return true;
    }
    return false;
  };

  if (Array.isArray(o.items)) {
    for (const item of o.items) {
      if (checkItem(item as Record<string, unknown> | undefined)) return true;
    }
  }
  if (Array.isArray(o.childOrders)) {
    for (const co of o.childOrders) {
      if (!co) continue;
      const items = co.items as Array<Record<string, unknown> | undefined> | undefined;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (checkItem(item)) return true;
      }
    }
  }
  return false;
}
