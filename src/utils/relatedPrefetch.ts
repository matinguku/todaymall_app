import { productsApi } from '../services/productsApi';

// Small in-memory cache for the "related recommendations" feed shown at the
// bottom of ProductDetailScreen. Mirrors searchPrefetch / homePrefetch so the
// next page can be pre-warmed in the background as soon as the current page
// lands — the next "load more" then resolves from memory.

type ApiResponse<T> = { success: boolean; data: T | null; message?: string };

interface CacheEntry<T> {
  promise: Promise<ApiResponse<T>>;
  response: ApiResponse<T> | null;
  startedAt: number;
}

const STALE_AFTER_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry<any>>();

function isFresh(entry: CacheEntry<any> | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.startedAt < STALE_AFTER_MS;
}

interface RelatedParams {
  productId: string;
  pageNo: number;
  pageSize: number;
  language: string;
  source: string;
}

function makeKey(p: RelatedParams): string {
  return ['related', p.productId, p.pageNo, p.pageSize, p.language, p.source].join('|');
}

export function prefetchRelated(params: RelatedParams): Promise<ApiResponse<any>> {
  const key = makeKey(params);
  const existing = cache.get(key) as CacheEntry<any> | undefined;
  if (existing && isFresh(existing)) {
    return existing.promise;
  }

  const entry: CacheEntry<any> = {
    promise: (async () => {
      try {
        const response = await productsApi.getRelatedRecommendations(
          params.productId,
          params.pageNo,
          params.pageSize,
          params.language,
          params.source,
        );
        entry.response = response;
        return response;
      } catch (err) {
        cache.delete(key);
        throw err;
      }
    })(),
    response: null,
    startedAt: Date.now(),
  };
  cache.set(key, entry);
  return entry.promise;
}

// Best-effort warm-up — never throws, never updates the calling component.
export function warmRelatedPage(params: RelatedParams): void {
  prefetchRelated(params).catch(() => {
    /* swallow — preload is best-effort */
  });
}
