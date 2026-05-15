import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants';
import { getStoredToken } from './authApi';
import { buildSignatureHeaders } from './signature';

type LangCode = 'ko' | 'zh' | 'en' | 'ja';

const CACHE_PREFIX = 'translateCache:v1:';
const MAX_INMEMORY_ENTRIES = 500;
const REQUEST_TIMEOUT_MS = 6000;

const memoryCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

// Process-wide kill-switch: once the backend returns 404 for /translate, stop
// retrying for the rest of the session so we don't spam the route. The flag
// resets on app restart, giving the backend a chance to come online.
let endpointDisabled = false;

function cacheKey(text: string, source: LangCode, target: LangCode): string {
  return `${source}>${target}:${text}`;
}

function isLikelyChinese(text: string): boolean {
  return /[一-鿿]/.test(text);
}

function isLikelyKorean(text: string): boolean {
  return /[가-힯]/.test(text);
}

/** Skip translation when the source already looks like the target language, or the input is empty/short. */
function shouldSkip(text: string, target: LangCode): boolean {
  if (!text || text.trim().length === 0) return true;
  if (target === 'ko' && isLikelyKorean(text) && !isLikelyChinese(text)) return true;
  if (target === 'zh' && isLikelyChinese(text) && !isLikelyKorean(text)) return true;
  return false;
}

function trimToMemoryBudget() {
  if (memoryCache.size <= MAX_INMEMORY_ENTRIES) return;
  const overflow = memoryCache.size - MAX_INMEMORY_ENTRIES;
  let removed = 0;
  for (const k of memoryCache.keys()) {
    if (removed >= overflow) break;
    memoryCache.delete(k);
    removed += 1;
  }
}

async function readDiskCache(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CACHE_PREFIX + key);
  } catch {
    return null;
  }
}

async function writeDiskCache(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + key, value);
  } catch {
    /* ignore — translation cache is best-effort */
  }
}

/**
 * Translate a single text via the backend Papago proxy.
 * Backend contract (to be implemented on api.todaymall.co.kr):
 *   POST /translate  { text: string, source: 'zh'|..., target: 'ko'|... }
 *   200 { data: { translatedText: string } }
 * Falls back to returning the source text on any failure so the UI never shows a blank.
 */
export async function translateText(
  text: string,
  target: LangCode,
  source: LangCode = 'zh',
): Promise<string> {
  if (shouldSkip(text, target)) return text;
  if (endpointDisabled) return text;

  const key = cacheKey(text, source, target);

  const mem = memoryCache.get(key);
  if (mem) return mem;

  const disk = await readDiskCache(key);
  if (disk) {
    memoryCache.set(key, disk);
    trimToMemoryBudget();
    return disk;
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const request = (async () => {
    try {
      const token = await getStoredToken();
      const url = `${API_BASE_URL}/translate`;
      const body = { source, target, text };
      const signatureHeaders = await buildSignatureHeaders('POST', url, body);
      const response = await axios.post(
        url,
        body,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...signatureHeaders,
          },
          timeout: REQUEST_TIMEOUT_MS,
        },
      );
      const translated =
        response.data?.data?.translatedText ||
        response.data?.translatedText ||
        '';
      if (translated && typeof translated === 'string') {
        memoryCache.set(key, translated);
        trimToMemoryBudget();
        void writeDiskCache(key, translated);
        return translated;
      }
      return text;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        endpointDisabled = true;
        if (__DEV__) {
          console.warn('[translateApi] endpoint missing (404); disabling translation for this session.');
        }
      } else if (__DEV__) {
        const data = err?.response?.data;
        console.warn(
          '[translateApi] failed',
          status ?? err?.code ?? 'unknown',
          typeof data === 'string' ? data.slice(0, 200) : data,
        );
      }
      return text;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

/**
 * Dev-only probe: sends ONE tiny POST to /v1/translate with a known phrase
 * and logs a clear status so backend teams can verify deployment without
 * running the full PDP / recently-viewed flow. No-op in production builds.
 * The result is also a side effect on `endpointDisabled`: if the route is
 * 404, the kill-switch trips immediately so the rest of the session stays
 * quiet. If the route is live, translation works for the rest of the
 * session as normal.
 */
export async function probeTranslateEndpoint(): Promise<void> {
  if (!__DEV__) return;
  if (endpointDisabled) {
    console.log('[translateApi.probe] skipped — endpoint already disabled this session.');
    return;
  }
  const sample = '你好';
  try {
    const token = await getStoredToken();
    const url = `${API_BASE_URL}/translate`;
    const body = { source: 'zh' as LangCode, target: 'ko' as LangCode, text: sample };
    const signatureHeaders = await buildSignatureHeaders('POST', url, body);
    const t0 = Date.now();
    const response = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...signatureHeaders,
      },
      timeout: REQUEST_TIMEOUT_MS,
    });
    const elapsed = Date.now() - t0;
    const translated =
      response.data?.data?.translatedText ||
      response.data?.translatedText ||
      '';
    if (translated) {
      console.log(
        `[translateApi.probe] OK in ${elapsed}ms — '${sample}' → '${translated}'. Endpoint is live.`,
      );
    } else {
      console.warn(
        `[translateApi.probe] reachable but response shape unexpected (took ${elapsed}ms). ` +
          `Expected { data: { translatedText } } or { translatedText }; got:`,
        response.data,
      );
    }
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    if (status === 404) {
      endpointDisabled = true;
      console.warn(
        '[translateApi.probe] 404 — /v1/translate is NOT deployed on api.todaymall.co.kr. ' +
          'Backend team needs to add the route (see translateApi.ts header for contract).',
      );
    } else if (status === 401 || status === 403) {
      console.warn(
        `[translateApi.probe] ${status} — route exists but auth/signature was rejected. ` +
          'Bearer token may be null (logged-out probe) or signature secret mismatch. ' +
          'This usually clears once a real user is logged in.',
      );
    } else if (status) {
      console.warn(
        `[translateApi.probe] ${status} — route exists but returned an error.`,
        typeof data === 'string' ? data.slice(0, 200) : data,
      );
    } else {
      console.warn(
        `[translateApi.probe] network failure (${err?.code ?? 'unknown'}) — ` +
          'could not reach api.todaymall.co.kr at all. Likely DNS/VPN, not a backend issue.',
      );
    }
  }
}

/**
 * Translate many texts in ONE network round-trip.
 *
 * Backend contract (batched):
 *   POST /translate  { texts: string[], source: 'zh'|..., target: 'ko'|... }
 *   200 { data: { translatedTexts: string[] } }     // preferred shape
 *   200 { translatedTexts: string[] }               // also accepted
 *   The response array MUST be the same length and order as the request.
 *
 * Behavior:
 *   - Items that fail shouldSkip (already in target lang, empty, etc.) are
 *     returned as-is with no network cost.
 *   - Items already in memory or AsyncStorage cache are returned from cache.
 *   - Only the remaining uncached unique strings hit the network — in ONE
 *     POST, regardless of how many there are.
 *   - On any failure the source strings are returned (UI never blanks).
 *   - Order of returned array matches order of input array.
 */
export async function translateBatch(
  texts: string[],
  target: LangCode,
  source: LangCode = 'zh',
): Promise<string[]> {
  // Deduplicate while preserving the original ordering of first occurrence.
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of texts) {
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(t);
    }
  }

  // Resolve each unique input from cache / skip rules before deciding what to
  // send. The result map is what we'll consult when reassembling the output.
  const resultMap = new Map<string, string>();
  const toFetch: string[] = [];

  for (const txt of unique) {
    if (shouldSkip(txt, target)) {
      resultMap.set(txt, txt);
      continue;
    }
    const key = cacheKey(txt, source, target);
    const mem = memoryCache.get(key);
    if (mem) {
      resultMap.set(txt, mem);
      continue;
    }
    const disk = await readDiskCache(key);
    if (disk) {
      memoryCache.set(key, disk);
      trimToMemoryBudget();
      resultMap.set(txt, disk);
      continue;
    }
    toFetch.push(txt);
  }

  // If the kill-switch tripped earlier this session, or nothing needs the
  // network, short-circuit and return what we have (cache + identity).
  if (endpointDisabled || toFetch.length === 0) {
    return texts.map((t) => resultMap.get(t) ?? t);
  }

  try {
    const token = await getStoredToken();
    const url = `${API_BASE_URL}/translate`;
    const body = { source, target, texts: toFetch };
    const signatureHeaders = await buildSignatureHeaders('POST', url, body);
    const response = await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...signatureHeaders,
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const translatedTexts: unknown =
      response.data?.data?.translatedTexts ??
      response.data?.translatedTexts;

    if (Array.isArray(translatedTexts) && translatedTexts.length === toFetch.length) {
      for (let i = 0; i < toFetch.length; i += 1) {
        const src = toFetch[i];
        const out = translatedTexts[i];
        if (typeof out === 'string' && out.length > 0 && out !== src) {
          const key = cacheKey(src, source, target);
          memoryCache.set(key, out);
          void writeDiskCache(key, out);
          resultMap.set(src, out);
        } else {
          resultMap.set(src, src);
        }
      }
      trimToMemoryBudget();
    } else if (__DEV__) {
      console.warn(
        '[translateApi.batch] response shape unexpected; expected ' +
          `{ data: { translatedTexts: string[len=${toFetch.length}] } }, got:`,
        response.data,
      );
    }
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) {
      endpointDisabled = true;
      if (__DEV__) {
        console.warn('[translateApi.batch] endpoint missing (404); disabling translation for this session.');
      }
    } else if (__DEV__) {
      const data = err?.response?.data;
      console.warn(
        '[translateApi.batch] failed',
        status ?? err?.code ?? 'unknown',
        typeof data === 'string' ? data.slice(0, 200) : data,
      );
    }
  }

  // Anything still missing from the map (network failure path) falls back to
  // the source string so the UI never blanks.
  return texts.map((t) => resultMap.get(t) ?? t);
}
