import { IMAGE_CONFIG } from '../constants';

/**
 * Resolve primary product image URL from API / list payloads (field names vary by source).
 */

const NESTED_IMAGE_KEYS = [
  'offer',
  'offerDetail',
  'detail',
  'productInfo',
  'baseInfo',
  'product',
  'item',
  'result',
] as const;

function isHttpUrl(v: string): boolean {
  return /^https?:\/\//i.test(v) || v.startsWith('//');
}

export function pickProductPrimaryImage(product: unknown, depth = 0): string {
  if (!product || typeof product !== 'object' || depth > 4) return '';
  const p = product as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  let direct =
    s(p.imageUrl) ||
    s(p.image) ||
    s(p.picUrl) ||
    s(p.pic_url) ||
    s(p.pictUrl) ||
    s(p.picture) ||
    s(p.pictureUrl) ||
    s(p.imgUrl) ||
    s(p.photoUrl) ||
    s(p.thumbnail) ||
    s(p.coverUrl) ||
    s(p.mainImage) ||
    s(p.mainPic) ||
    s(p.primaryImage) ||
    s(p.offerImage) ||
    s(p.coverImage) ||
    s(p.productImage);

  if (!direct && p.image && typeof p.image === 'object' && !Array.isArray(p.image)) {
    const o = p.image as Record<string, unknown>;
    direct = s(o.url) || s(o.uri) || s(o.src) || s(o.imageUrl) || s(o.picUrl);
  }

  if (!direct) {
    const imgs = p.images;
    if (Array.isArray(imgs) && imgs.length > 0) {
      const first = imgs[0];
      if (typeof first === 'string') {
        direct = first.trim();
      } else if (first && typeof first === 'object') {
        const o = first as Record<string, unknown>;
        direct = s(o.url) || s(o.uri) || s(o.src) || s(o.imageUrl) || s(o.picUrl);
      }
    }
  }

  if (!direct) {
    const list = p.imageList;
    if (Array.isArray(list) && list.length > 0) {
      const first = list[0];
      if (typeof first === 'string') {
        direct = first.trim();
      } else if (first && typeof first === 'object') {
        const o = first as Record<string, unknown>;
        direct = s(o.url) || s(o.imageUrl) || s(o.picUrl);
      }
    }
  }

  if (!direct) {
    const skus = (p.skuInfos || p.skuList || p.skus) as unknown;
    if (Array.isArray(skus) && skus.length > 0) {
      direct = pickProductPrimaryImage(skus[0], depth + 1);
    }
  }

  if (!direct) {
    for (const k of NESTED_IMAGE_KEYS) {
      const v = p[k];
      if (v && typeof v === 'object') {
        direct = pickProductPrimaryImage(v, depth + 1);
        if (direct) break;
      }
    }
  }

  if (!direct) {
    for (const v of Object.values(p)) {
      if (typeof v === 'string' && v.length > 12 && isHttpUrl(v) && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(v)) {
        direct = v.trim();
        break;
      }
    }
  }

  return direct;
}

/** Undo our / CDN-style `_300x300.jpg` (or other `_NxN`) suffix when the URL fails to load. */
export function stripThumbnailSizeSuffix(url: string): string {
  if (!url) return url;
  const next = url.replace(/_(\d+)x\1\.(jpg|jpeg|png|webp)((\?|#).*)?$/i, '.$2$3');
  return next !== url ? next : url;
}

/**
 * Normalize URL for display (protocol, optional Alibaba thumbnail path).
 * Only rewrite URLs on known Alibaba-related hosts — avoid matching generic `img.` subdomains.
 *
 * `quality` is OPTIONAL. When omitted (the default), we generate the legacy
 * `_NxN.jpg` suffix that every existing call site relies on. When specified,
 * we generate `_NxNqQ.jpg` so the Alibaba CDN re-encodes the JPEG at the
 * requested quality. Pass quality only at call sites you've verified actually
 * load on the device — keeps the rollout incremental.
 */
export function buildProductDisplayImageUri(
  raw?: string,
  edgePx: number = IMAGE_CONFIG.PRODUCT_DISPLAY_PIXEL,
  quality?: number,
): string {
  if (!raw) return '';
  let image = raw.trim();
  if (!image) return '';

  if (image.startsWith('//')) {
    image = `https:${image}`;
  }

  if (image.startsWith('http://')) {
    image = image.replace(/^http:\/\//i, 'https://');
  }

  let host = '';
  try {
    const u = new URL(image);
    host = u.hostname.toLowerCase();
  } catch {
    host = '';
  }

  const alibabaHost =
    host &&
    (host.includes('alicdn.com') ||
      host.includes('1688.com') ||
      host.includes('taobao.com') ||
      host.includes('tmall.com') ||
      host.includes('alibaba.com') ||
      host.includes('cbu01.') ||
      host === 'gw.alicdn.com');

  if (alibabaHost && !/_\d+x\d+\.(jpg|jpeg|png|webp)/i.test(image)) {
    const px = Math.max(32, Math.min(800, Math.round(edgePx)));
    const sizeSuffix =
      quality != null
        ? `_${px}x${px}q${Math.max(1, Math.min(100, Math.round(quality)))}`
        : `_${px}x${px}`;
    const replaced = image.replace(
      /\.(jpg|jpeg|png|webp)((\?|#).*)?$/i,
      `${sizeSuffix}.$1$2`,
    );
    if (replaced !== image) {
      return replaced;
    }
    if (!/\.(jpg|jpeg|png|webp)/i.test(image)) {
      return `${image}${sizeSuffix}.jpg`;
    }
  }

  return image;
}

export function getProductCardImageUri(
  product: unknown,
  edgePx?: number,
  quality?: number,
): string {
  return buildProductDisplayImageUri(
    pickProductPrimaryImage(product),
    edgePx ?? IMAGE_CONFIG.PRODUCT_DISPLAY_PIXEL,
    quality,
  );
}

/**
 * Build Alibaba-style thumbnail URL:
 * `...jpg_200x200q90.jpg`
 */
export function getAlibabaThumbnailImageUri(
  product: unknown,
  edgePx: number = IMAGE_CONFIG.HOME_GRID_IMAGE_PIXEL,
  quality: number = 60,
): string {
  const raw = pickProductPrimaryImage(product);
  if (!raw) return '';

  let image = raw.trim();
  if (!image) return '';
  if (image.startsWith('//')) image = `https:${image}`;
  if (image.startsWith('http://')) image = image.replace(/^http:\/\//i, 'https://');

  let host = '';
  try {
    host = new URL(image).hostname.toLowerCase();
  } catch {
    host = '';
  }

  const isAlibabaHost =
    host &&
    (host.includes('alicdn.com') ||
      host.includes('1688.com') ||
      host.includes('taobao.com') ||
      host.includes('tmall.com') ||
      host.includes('alibaba.com') ||
      host.includes('cbu01.') ||
      host === 'gw.alicdn.com');

  if (!isAlibabaHost) return image;
  if (/_\d+x\d+q\d+\.jpg(?:$|[?#])/i.test(image)) return image;

  const px = Math.max(32, Math.min(800, Math.round(edgePx)));
  const q = Math.max(1, Math.min(100, Math.round(quality)));

  const m = image.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!m) return image;
  const base = m[1];
  const query = m[2] ?? '';
  const hash = m[3] ?? '';
  return `${base}_${px}x${px}q${q}.jpg${query}${hash}`;
}
