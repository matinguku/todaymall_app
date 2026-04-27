import { productsApi } from '../services/productsApi';

// In-memory cache for keyword search-results so the next "load more" page
// can be pre-warmed in the background as soon as the current page lands.
// Mirrors the home/recommendations cache in `homePrefetch.ts`.

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

interface SearchKeywordParams {
  keyword: string;
  source?: string;
  country?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  priceStart?: number;
  priceEnd?: number;
  filter?: string;
  requireAuth?: boolean;
  sellerOpenId?: string;
}

function makeKey(p: Required<Pick<SearchKeywordParams, 'keyword' | 'source' | 'country' | 'page' | 'pageSize'>> & SearchKeywordParams): string {
  return [
    'search',
    p.keyword,
    p.source,
    p.country,
    p.page,
    p.pageSize,
    p.sort ?? '',
    p.priceStart ?? '',
    p.priceEnd ?? '',
    p.filter ?? '',
    p.requireAuth ?? '',
    p.sellerOpenId ?? '',
  ].join('|');
}

export function prefetchSearch(params: SearchKeywordParams): Promise<ApiResponse<any>> {
  const normalized = {
    keyword: params.keyword,
    source: params.source ?? '1688',
    country: params.country ?? 'en',
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    sort: params.sort,
    priceStart: params.priceStart,
    priceEnd: params.priceEnd,
    filter: params.filter,
    requireAuth: params.requireAuth ?? true,
    sellerOpenId: params.sellerOpenId,
  };
  const key = makeKey(normalized);
  const existing = cache.get(key) as CacheEntry<any> | undefined;
  if (existing && isFresh(existing)) {
    return existing.promise;
  }

  const entry: CacheEntry<any> = {
    promise: (async () => {
      try {
        const response = await productsApi.searchProductsByKeyword(
          normalized.keyword,
          normalized.source,
          normalized.country,
          normalized.page,
          normalized.pageSize,
          normalized.sort,
          normalized.priceStart,
          normalized.priceEnd,
          normalized.filter,
          normalized.requireAuth,
          normalized.sellerOpenId,
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

// Best-effort cache warm-up — never throws and never updates the calling
// component. Used to pre-load page N+1 the moment page N arrives so the next
// "load more" resolves from memory.
export function warmSearchPage(params: SearchKeywordParams): void {
  prefetchSearch(params).catch(() => {
    /* swallow — preload is best-effort */
  });
}

export function invalidateSearchCache(): void {
  cache.clear();
}
