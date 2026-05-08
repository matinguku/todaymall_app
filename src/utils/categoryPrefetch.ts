import { productsApi } from '../services/productsApi';

/**
 * Warm-cache for CategoryTabScreen: top (L1) categories plus child (L2) trees,
 * keyed like the screen’s own cache (`${platform}-${locale}`).
 * Started from App.tsx so the category tab can paint from memory first.
 */

const STALE_AFTER_MS = 5 * 60 * 1000;

export type CategoryBrowsePayload = {
  platform: string;
  localeKey: string;
  categories: any[];
  l2ByL1: Record<string, any[]>;
  startedAt: number;
};

const browseCache = new Map<string, CategoryBrowsePayload>();

export function categoryBrowseCacheKey(platform: string, locale: string): string {
  return `${platform}-${locale}`;
}

function isFresh(entry: CategoryBrowsePayload | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.startedAt < STALE_AFTER_MS;
}

export function peekCategoryBrowsePayload(
  platform: string,
  locale: string,
): CategoryBrowsePayload | null {
  const key = categoryBrowseCacheKey(platform, locale);
  const entry = browseCache.get(key);
  if (entry && isFresh(entry)) return entry;
  return null;
}

/** Remove one platform/locale slice or the whole browse cache (e.g. pull-to-refresh). */
export function invalidateCategoryBrowseCache(platform?: string, locale?: string) {
  if (platform !== undefined && locale !== undefined) {
    browseCache.delete(categoryBrowseCacheKey(platform, locale));
    return;
  }
  browseCache.clear();
}

/** Seed top categories with empty L2 trees (used when the screen fetches L1 itself, no prefetch hit). */
export function seedCategoryBrowseCategories(
  platform: string,
  locale: string,
  categories: any[],
) {
  const key = categoryBrowseCacheKey(platform, locale);
  const existing = browseCache.get(key);
  browseCache.set(key, {
    platform,
    localeKey: locale,
    categories,
    l2ByL1: existing?.l2ByL1 ?? {},
    startedAt: Date.now(),
  });
}

/** Merge a single L1's L2 tree into the cache; refreshes startedAt to keep the entry warm. */
export function upsertL2ForL1(
  platform: string,
  locale: string,
  l1Id: string,
  tree: any[],
) {
  const key = categoryBrowseCacheKey(platform, locale);
  const existing = browseCache.get(key);
  if (!existing) return;
  browseCache.set(key, {
    ...existing,
    l2ByL1: { ...existing.l2ByL1, [l1Id]: tree },
    startedAt: Date.now(),
  });
}

const inflight = new Map<string, Promise<void>>();

/**
 * Fetches top categories then each L1’s child tree (same order as CategoryTabScreen).
 * Safe to call repeatedly; returns existing promise while in flight or if cache is fresh.
 */
export function prefetchCategoryBrowse(
  platform: string = '1688',
  locale: string = 'ko',
): Promise<void> {
  const key = categoryBrowseCacheKey(platform, locale);
  const existing = browseCache.get(key);
  if (existing && isFresh(existing)) {
    return Promise.resolve();
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const run = (async () => {
    try {
      const topResp = await productsApi.getTopCategories(platform);
      const categories =
        topResp.success && topResp.data?.categories ? topResp.data.categories : [];

      const l2ByL1: Record<string, any[]> = {};
      const CONCURRENCY = 4;
      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, categories.length) },
        async () => {
          while (true) {
            const i = cursor++;
            if (i >= categories.length) return;
            const l1 = categories[i];
            try {
              const resp = await productsApi.getChildCategories(platform, l1._id);
              const tree = resp?.success && resp?.data?.tree ? resp.data.tree : [];
              l2ByL1[l1._id] = Array.isArray(tree) ? tree : [];
            } catch {
              l2ByL1[l1._id] = [];
            }
          }
        },
      );
      await Promise.all(workers);

      browseCache.set(key, {
        platform,
        localeKey: locale,
        categories,
        l2ByL1,
        startedAt: Date.now(),
      });
    } catch {
      // Token/network failures — CategoryTabScreen will fetch on mount.
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, run);
  return run;
}
