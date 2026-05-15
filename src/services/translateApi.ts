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

/** Translate many texts in parallel, deduping identical inputs. Order of results matches input order. */
export async function translateBatch(
  texts: string[],
  target: LangCode,
  source: LangCode = 'zh',
): Promise<string[]> {
  const unique = Array.from(new Set(texts));
  const translations = await Promise.all(
    unique.map((t) => translateText(t, target, source)),
  );
  const map = new Map<string, string>();
  unique.forEach((t, i) => map.set(t, translations[i]));
  return texts.map((t) => map.get(t) ?? t);
}
