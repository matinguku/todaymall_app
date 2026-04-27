import { productsApi } from '../services/productsApi';

// In-memory cache for image-search results so the next "load more" page can
// be pre-warmed in the background as soon as the current page lands. Mirrors
// searchPrefetch / relatedPrefetch / homePrefetch.
//
// Image search hits two backends (1688 and Taobao) with different request
// shapes, so each gets its own thin wrapper. Both share the same cache map
// keyed by `<source>|<imageFingerprint>|<language>|<page>|<pageSize>`.

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

// Base64 strings can be 1MB+, so we don't want to use them as Map keys
// directly. A small fingerprint (length + a few slices) is more than enough
// to dedupe requests for the same image within a session.
function fingerprintBase64(b64: string): string {
  if (!b64) return 'empty';
  const len = b64.length;
  const head = b64.slice(0, 32);
  const mid = b64.slice(Math.max(0, Math.floor(len / 2) - 16), Math.floor(len / 2) + 16);
  const tail = b64.slice(-32);
  return `${len}:${head}:${mid}:${tail}`;
}

interface ImageSearch1688Params {
  imageBase64: string;
  language?: string;
  page: number;
  pageSize: number;
}

interface ImageSearchTaobaoParams {
  imageBase64: string;
  language: string;
  page: number;
  pageSize: number;
}

function makeKey(source: '1688' | 'taobao', fp: string, language: string, page: number, pageSize: number): string {
  return ['imgsearch', source, fp, language, page, pageSize].join('|');
}

export function prefetchImageSearch1688(params: ImageSearch1688Params): Promise<ApiResponse<any>> {
  const language = params.language ?? '';
  const fp = fingerprintBase64(params.imageBase64);
  const key = makeKey('1688', fp, language, params.page, params.pageSize);
  const existing = cache.get(key) as CacheEntry<any> | undefined;
  if (existing && isFresh(existing)) {
    return existing.promise;
  }

  const entry: CacheEntry<any> = {
    promise: (async () => {
      try {
        const response = await productsApi.imageSearch1688(
          params.imageBase64,
          params.language,
          params.page,
          params.pageSize,
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

export function prefetchImageSearchTaobao(params: ImageSearchTaobaoParams): Promise<ApiResponse<any>> {
  const fp = fingerprintBase64(params.imageBase64);
  const key = makeKey('taobao', fp, params.language, params.page, params.pageSize);
  const existing = cache.get(key) as CacheEntry<any> | undefined;
  if (existing && isFresh(existing)) {
    return existing.promise;
  }

  const entry: CacheEntry<any> = {
    promise: (async () => {
      try {
        const response = await productsApi.imageSearchTaobao(
          params.language,
          params.imageBase64,
          params.page,
          params.pageSize,
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

// Best-effort warm-ups — never throw, never update the calling component.
// Used to pre-load page N+1 the moment page N arrives so the next "load more"
// resolves from memory instead of a network round-trip.
export function warmImageSearch1688(params: ImageSearch1688Params): void {
  prefetchImageSearch1688(params).catch(() => {
    /* swallow — preload is best-effort */
  });
}

export function warmImageSearchTaobao(params: ImageSearchTaobaoParams): void {
  prefetchImageSearchTaobao(params).catch(() => {
    /* swallow — preload is best-effort */
  });
}

export function invalidateImageSearchCache(): void {
  cache.clear();
}
