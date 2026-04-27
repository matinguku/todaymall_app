import { productsApi } from '../services/productsApi';
import { PAGINATION } from '../constants';

// Module-level cache that fires home API requests once, ideally during the
// splash screen, so HomeScreen can read pre-resolved data on its first paint
// instead of waiting on round-trips after mount.

type ApiResponse<T> = { success: boolean; data: T | null; message?: string };

interface CacheEntry<T> {
  promise: Promise<ApiResponse<T>>;
  response: ApiResponse<T> | null;
  startedAt: number;
}

// 5-minute freshness window — long enough for splash → first home render to
// reuse data, short enough that pull-to-refresh after a long pause re-fetches.
const STALE_AFTER_MS = 5 * 60 * 1000;

const cache = new Map<string, CacheEntry<any>>();

function isFresh(entry: CacheEntry<any> | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.startedAt < STALE_AFTER_MS;
}

function run<T>(key: string, factory: () => Promise<ApiResponse<T>>): Promise<ApiResponse<T>> {
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && isFresh(existing)) {
    return existing.promise;
  }
  const entry: CacheEntry<T> = {
    promise: (async () => {
      try {
        const response = await factory();
        entry.response = response;
        return response;
      } catch (err) {
        // Drop the cache entry on hard failure so callers can retry.
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

export const homePrefetchKeys = {
  banners: () => 'banners',
  carousels: () => 'carousels',
  liveCommerce: () => 'liveCommerce',
  newInProducts: (platform: string, country: string) => `newIn:${platform}:${country}`,
  defaultCategories: (platform: string) => `defaultCategories:${platform}`,
  recommendations: (
    country: string,
    outMemberId: string,
    beginPage: number,
    pageSize: number,
    platform: string,
  ) => `recommendations:${country}:${outMemberId}:${beginPage}:${pageSize}:${platform}`,
};

export const prefetchBanners = () =>
  run(homePrefetchKeys.banners(), () => productsApi.getBanners());

export const prefetchCarousels = () =>
  run(homePrefetchKeys.carousels(), () => productsApi.getCarousels());

export const prefetchLiveCommerce = () =>
  run(homePrefetchKeys.liveCommerce(), () => productsApi.getLiveCommerce());

export const prefetchNewInProducts = (platform: string, country: string) =>
  run(homePrefetchKeys.newInProducts(platform, country), () =>
    productsApi.getNewInProducts(platform, country),
  );

export const prefetchDefaultCategories = (platform: string) =>
  run(homePrefetchKeys.defaultCategories(platform), () =>
    productsApi.getDefaultCategories(platform, true),
  );

export const prefetchRecommendations = (
  country: string,
  outMemberId: string,
  beginPage: number = 1,
  pageSize: number = 20,
  platform: string = '1688',
) =>
  run(
    homePrefetchKeys.recommendations(country, outMemberId, beginPage, pageSize, platform),
    () => productsApi.getRecommendations(country, outMemberId, beginPage, pageSize, platform),
  );

export function getCachedHomeData<T = any>(key: string): ApiResponse<T> | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && isFresh(entry)) return entry.response;
  return null;
}

export function getCachedHomePromise<T = any>(key: string): Promise<ApiResponse<T>> | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && isFresh(entry)) return entry.promise;
  return null;
}

export function invalidateHomeCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

interface PrefetchHomeArgs {
  platform?: string;
  country?: string;
  outMemberId?: string;
}

// Tracks the most recent prefetch run so the splash gate can wait on the
// first-paint phase without re-triggering the requests, and other callers
// can wait on the full aggregate if they need everything settled.
let latestFirstPaint: Promise<void> | null = null;
let latestAggregate: Promise<void> | null = null;

// Kick off home-screen requests in three sequential phases so the
// above-the-fold visuals (banners, carousels, default categories) win the
// network race and the home screen can paint as quickly as possible.
//
//   Phase 1: banners + carousels + default categories  (small, above the fold)
//   Phase 2: live commerce + new-in / today's deals     (heavier)
//   Phase 3: more-to-love recommendations               (heaviest)
//
// Within a phase the requests run in parallel; the next phase starts only
// after the previous phase settles. The splash gate releases as soon as
// Phase 1 settles so the user sees content immediately while Phases 2 and 3
// keep filling in.
export function prefetchHome(args: PrefetchHomeArgs = {}): Promise<void> {
  const platform = args.platform ?? '1688';
  const country = args.country ?? 'ko';
  const newInCountry = country === 'zh' || country === 'ko' ? 'en' : country;
  const outMemberId = args.outMemberId ?? 'dferg0001';

  const phase1 = Promise.allSettled([
    prefetchBanners(),
    prefetchCarousels(),
    prefetchDefaultCategories(platform),
  ]).then(() => undefined);

  const phase2 = phase1.then(() =>
    Promise.allSettled([
      prefetchLiveCommerce(),
      prefetchNewInProducts(platform, newInCountry),
    ]).then(() => undefined),
  );

  const phase3 = phase2.then(() =>
    prefetchRecommendations(country, outMemberId, 1, PAGINATION.FEED_INITIAL_PAGE_SIZE, '1688')
      .then(() => undefined)
      .catch(() => undefined),
  );

  latestFirstPaint = phase1;
  latestAggregate = phase3;
  return latestAggregate;
}

// Promise that settles when Phase 1 (above-the-fold data) is done. The
// splash gate waits on this so the user reaches the home screen as soon as
// the visible-on-mount data is ready.
export function getHomeFirstPaintPromise(): Promise<void> | null {
  return latestFirstPaint;
}

export function getHomePrefetchPromise(): Promise<void> | null {
  return latestAggregate;
}
