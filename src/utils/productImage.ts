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
    s(p.whiteImage) ||
    s(p.productImage);

  if (!direct && p.image && typeof p.image === 'object' && !Array.isArray(p.image)) {
    const o = p.image as Record<string, unknown>;
    direct = s(o.url) || s(o.uri) || s(o.src) || s(o.imageUrl) || s(o.picUrl);
  }

  // 1688 / OpenAPI often ship `productImage` as `{ images: string[] }` rather than a string URL.
  if (!direct && p.productImage && typeof p.productImage === 'object' && !Array.isArray(p.productImage)) {
    const o = p.productImage as Record<string, unknown>;
    direct = s(o.url) || s(o.uri) || s(o.imageUrl) || s(o.picUrl);
    if (!direct) {
      const imgs = o.images;
      if (Array.isArray(imgs) && imgs.length > 0) {
        const first = imgs[0];
        if (typeof first === 'string') {
          direct = first.trim();
        } else if (first && typeof first === 'object') {
          const fo = first as Record<string, unknown>;
          direct = s(fo.url) || s(fo.uri) || s(fo.src) || s(fo.imageUrl) || s(fo.picUrl);
        }
      }
    }
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
    const skus = (p.productSkuInfos || p.skuInfos || p.skuList || p.skus) as unknown;
    if (Array.isArray(skus) && skus.length > 0) {
      const su = skus[0] as Record<string, unknown>;
      direct = s(su.skuImageUrl) || s(su.image);
      if (!direct && Array.isArray(su.skuAttributes) && (su.skuAttributes as unknown[]).length > 0) {
        const a0 = (su.skuAttributes as unknown[])[0] as Record<string, unknown>;
        direct = s(a0?.skuImageUrl);
      }
      if (!direct) {
        direct = pickProductPrimaryImage(skus[0], depth + 1);
      }
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

  image = normalizeAliPicassoInfixSizes(image);

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

  // `.../img/ibank/...-0-cib.jpg` must not become `...-0-cib_300x300.jpg` — Picasso 404s that shape.
  if (alibabaHost && /\/img\/ibank\/.+-\d+-cib\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(image)) {
    return image;
  }

  // Taobao/Tmall `imgextra`: `...-0-item_pic.jpg` is valid; `...-0-item_pic_300x300.jpg` is not.
  if (alibabaHost && /\/imgextra\/.+-\d+-item_pic\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(image)) {
    return image;
  }

  // List/detail APIs often return `..._!!0-item_pic_200x200.jpg` — Picasso 404s; stable base is `..._!!0-item_pic.jpg`.
  if (alibabaHost && /\/imgextra\/.+_!!\d+-item_pic\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(image)) {
    return image;
  }

  // `..._!!{seller}.jpg` — infix `_WxH` before `.jpg` 404s; do not add another `_PxP` before `.jpg`.
  if (alibabaHost && /\/imgextra\/[^?#]+_!!\d+\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(image)) {
    return image;
  }

  // Detect both `_NxN.jpg` and `_NxNqQ.jpg` so URLs that have already been
  // thumbnailed (e.g. by getAlibabaThumbnailImageUri before being stored on
  // the product object) aren't appended with a second size suffix — that
  // produced broken URLs like `image.jpg_200x200q60_200x200.jpg`.
  if (alibabaHost && !/_\d+x\d+(?:q\d+)?\.(jpg|jpeg|png|webp)/i.test(image)) {
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
 * Returns a smaller, lower-quality URL for CDN-hosted images so the network
 * payload stays small (used for the home carousel + banner where the full
 * desktop/mobile image is much larger than the on-screen render box).
 *
 * Cloudinary URLs get `/upload/w_<edgePx>,q_<quality>,f_auto/` inserted so
 * the CDN re-encodes on the fly; Alibaba CDN URLs get the existing
 * `_NxNqQ.jpg` suffix; everything else is returned unchanged.
 */
export function buildCdnThumbnailUri(
  raw?: string,
  edgePx: number = 480,
  quality: number = 60,
): string {
  if (!raw) return '';
  let image = raw.trim();
  if (!image) return '';

  if (image.startsWith('//')) image = `https:${image}`;
  if (image.startsWith('http://')) image = image.replace(/^http:\/\//i, 'https://');

  // Cloudinary delivery URL: insert resize/quality/format transformations
  // immediately after `/upload/` (or `/fetch/`). Skip if already transformed
  // so we don't stack `w_*` segments.
  if (/res\.cloudinary\.com\//i.test(image)) {
    if (/\/(upload|fetch)\/[^/]*\b(w_\d+|q_\d+|f_auto)\b/i.test(image)) {
      return image;
    }
    const px = Math.max(64, Math.min(1600, Math.round(edgePx)));
    const q = Math.max(1, Math.min(100, Math.round(quality)));
    return image.replace(
      /\/(upload|fetch)\//,
      `/$1/w_${px},q_${q},f_auto/`,
    );
  }

  // Anything Alibaba-hosted reuses the `_NxNqQ.jpg` suffix the product image
  // helper already understands.
  return buildProductDisplayImageUri(image, edgePx, quality);
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

  image = normalizeAliPicassoInfixSizes(image);

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
  // Already a 1688-style resized URL — do not append a second `_NxN` / `_NxNqQ` suffix
  // (would break loading, e.g. `...jpg_200x200_300x300q60.jpg`).
  if (/_\d+x\d+(?:q\d+)?\.(jpg|jpeg|png|webp)(?:$|[?#])/i.test(image)) return image;

  const px = Math.max(32, Math.min(800, Math.round(edgePx)));
  const q = Math.max(1, Math.min(100, Math.round(quality)));

  const m = image.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!m) return image;
  const base = m[1];
  const query = m[2] ?? '';
  const hash = m[3] ?? '';
  return `${base}_${px}x${px}q${q}.jpg${query}${hash}`;
}

/** https + trim; shared by gallery fallbacks. */
export function normalizeDisplayImageUri(raw?: string): string {
  if (!raw) return '';
  let image = raw.trim();
  if (!image) return '';
  if (image.startsWith('//')) image = `https:${image}`;
  if (image.startsWith('http://')) image = image.replace(/^http:\/\//i, 'https://');
  return image;
}

/**
 * cbu01 `img/ibank` 1688 paths: Picasso serves `...-0-cib.jpg` and `...-0-cib.jpg_WxHqQ.jpg`,
 * but `...-0-cib_WxH.jpg` (size before the final extension) returns IMAGE_NOT_FOUND.
 * APIs often return the broken infix form — collapse it to the stable base URL.
 */
function normalizeCbuIbankCibInfixSize(url: string): string {
  const image = normalizeDisplayImageUri(url);
  if (!image || !/\/img\/ibank\//i.test(image)) return image;
  return image.replace(
    /(-\d+-cib)_\d+x\d+(?:q\d+)?(\.(?:jpg|jpeg|png|webp))/gi,
    '$1$2',
  );
}

/** `...-0-item_pic_200x200.jpg` → `...-0-item_pic.jpg` on Taobao imgextra (Picasso 404s the infix). */
function normalizeImgextraItemPicInfixSize(url: string): string {
  if (!url || !/\/imgextra\//i.test(url)) return url;
  return url.replace(
    /(-\d+-item_pic)_\d+x\d+(?:q\d+)?(\.(?:jpg|jpeg|png|webp))/gi,
    '$1$2',
  );
}

/** `..._!!0-item_pic_200x200.jpg` → `..._!!0-item_pic.jpg` (Taobao list shape; hyphen form is handled above). */
function normalizeImgextraBangItemPicInfixSize(url: string): string {
  if (!url || !/\/imgextra\//i.test(url)) return url;
  return url.replace(
    /(_!!\d+-item_pic)_\d+x\d+(?:q\d+)?(\.(?:jpg|jpeg|png|webp))/gi,
    '$1$2',
  );
}

/** `..._!!{seller}_200x200.jpg` → `..._!!{seller}.jpg` on imgextra (seller id must stay on the path). */
function normalizeImgextraBangSellerWxHInfix(url: string): string {
  if (!url || !/\/imgextra\//i.test(url)) return url;
  return url.replace(
    /(_!!\d+)_\d+x\d+(?:q\d+)?(\.(?:jpg|jpeg|png|webp))$/i,
    '$1$2',
  );
}

/** Collapse Picasso-broken `_WxH` infixes for cbu01 ibank + Taobao imgextra before resize / fallback logic. */
function normalizeAliPicassoInfixSizes(url: string): string {
  const s0 = normalizeDisplayImageUri(url);
  if (!s0) return s0;
  let s = normalizeCbuIbankCibInfixSize(s0);
  s = normalizeImgextraItemPicInfixSize(s);
  s = normalizeImgextraBangItemPicInfixSize(s);
  s = normalizeImgextraBangSellerWxHInfix(s);
  return s;
}

/**
 * Strip one Alibaba resize layer from the path. Handles:
 * - imgextra / ibank infix sizes (see normalizeAliPicassoInfixSizes)
 * - `..._!!{digits}.jpg` → `....jpg` (non-imgextra; main O1CN without numeric tail)
 * - `..._480x480q55.jpg`
 */
function stripOneAlibabaDynamicResizeSuffix(url: string): string | null {
  const image = normalizeDisplayImageUri(url);
  if (!image) return null;

  const collapsed = normalizeAliPicassoInfixSizes(image);
  if (collapsed !== image) return collapsed;

  const qIdx = image.search(/[?#]/);
  const path = qIdx >= 0 ? image.slice(0, qIdx) : image;
  const tail = qIdx >= 0 ? image.slice(qIdx) : '';

  // `...O1CNxxx_!!461....jpg` → `...O1CNxxx.jpg` (skip on imgextra — `_!!seller` tail is required)
  if (!/\/imgextra\//i.test(path)) {
    const bangNumeric = path.match(/^(.*)_!!\d+(\.(?:jpg|jpeg|png|webp))$/i);
    if (bangNumeric?.[1]) {
      const next = bangNumeric[1] + bangNumeric[2];
      if (next !== path) return next + tail;
    }
  }

  const m1688 = path.match(
    /^(.*\.(?:jpg|jpeg|png|webp))_\d+x\d+(?:q\d+)?\.(?:jpg|jpeg|png|webp)$/i,
  );
  if (m1688?.[1]) {
    return m1688[1] + tail;
  }

  const mTail = path.match(/^(.*)_\d+x\d+(?:q\d+)?(\.(?:jpg|jpeg|png|webp))$/i);
  if (mTail?.[1] && mTail[1] + mTail[2] !== path) {
    return mTail[1] + mTail[2] + tail;
  }

  return null;
}

/**
 * Chain of progressively simpler URLs for img.alicdn.com / cbu01 paths where a
 * dynamic size segment returns 404.
 */
export function expandAlibabaCdnImageFallbacks(raw?: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    const n = normalizeDisplayImageUri(u);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };

  push(raw ?? '');
  let cur = normalizeDisplayImageUri(raw ?? '');
  for (let i = 0; i < 12; i++) {
    const next = stripOneAlibabaDynamicResizeSuffix(cur);
    if (!next || next === cur) break;
    push(next);
    cur = next;
  }
  return out;
}

/**
 * Ordered URIs for image load retry (smaller Alibaba thumbs first, then legacy, then raw).
 */
function isAlibabaImageHost(uri: string): boolean {
  try {
    const host = new URL(uri).hostname.toLowerCase();
    return (
      host.includes('alicdn.com') ||
      host.includes('1688.com') ||
      host.includes('taobao.com') ||
      host.includes('tmall.com') ||
      host.includes('alibaba.com') ||
      host.includes('cbu01.') ||
      host === 'gw.alicdn.com'
    );
  } catch {
    return false;
  }
}

export function buildAlibabaImageLoadAttempts(
  raw: string,
  thumbEdgePx: number,
  quality: number,
  maxAttempts: number = 18,
): string[] {
  const bases = expandAlibabaCdnImageFallbacks(raw);
  const attempts: string[] = [];
  const add = (u: string) => {
    const n = normalizeDisplayImageUri(u);
    if (n && !attempts.includes(n)) attempts.push(n);
  };

  const pxPrimary = Math.max(120, Math.min(480, Math.round(thumbEdgePx)));
  const pxMid = Math.max(120, Math.min(360, Math.round(pxPrimary * 0.75)));
  const pxSmall = Math.max(96, Math.min(240, Math.round(pxPrimary * 0.5)));
  const qPrimary = Math.max(40, Math.min(90, Math.round(quality)));
  const qLo = Math.max(35, Math.min(75, Math.round(quality * 0.85)));

  for (const b of bases) {
    const ali = isAlibabaImageHost(b);
    // Prefer smaller CDN requests on Alibaba first (less decode + some CDNs only serve certain sizes).
    if (ali) {
      add(buildCdnThumbnailUri(b, pxSmall, qLo));
      add(buildCdnThumbnailUri(b, pxMid, qLo));
    }
    add(buildCdnThumbnailUri(b, pxPrimary, qPrimary));
    if (ali && pxPrimary > 200) {
      add(buildProductDisplayImageUri(b, pxMid));
      add(buildProductDisplayImageUri(b, pxSmall));
    }
    add(buildProductDisplayImageUri(b, pxPrimary));
    add(b);
  }
  return attempts.slice(0, maxAttempts);
}
