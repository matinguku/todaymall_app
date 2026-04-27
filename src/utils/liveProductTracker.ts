/**
 * Local-only live-product tracking via AsyncStorage.
 *
 * The backend currently doesn't expose a "this order contains live items"
 * marker on the orders endpoint, so we tag live products on the device
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
  const o = order as { items?: Array<Record<string, unknown> | null | undefined> } | null | undefined;
  if (!o || !Array.isArray(o.items)) return false;
  for (const item of o.items) {
    if (!item) continue;
    const candidates = [item.offerId, item.productId, item.itemId, item.id];
    for (const c of candidates) {
      const id = normalizeId(c);
      if (id && liveProductIds.has(id)) return true;
    }
  }
  return false;
}
