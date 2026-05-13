import { extractLiveCode, pickExplicitLiveCodeFromTree } from './liveCode';

/**
 * Extra fields for live-seller product grid cards (code, item number, cost).
 * Accepts either a full live-commerce listing row or a flattened schedule item.
 */
export type LiveSellerListingProductMeta = {
  listProductCode: string;
  listProductItemNumber: string;
  listProductCost: number | null;
};

function parsePositiveCost(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return !Number.isNaN(n) && n > 0 ? n : null;
}

export function getLiveSellerListingProductMeta(item: any): LiveSellerListingProductMeta {
  const productObj = item?.product || item?.productData || {};
  const skuInfos =
    (Array.isArray(productObj?.productSkuInfos) ? productObj.productSkuInfos : null) ||
    (Array.isArray(productObj?.productData?.productSkuInfos)
      ? productObj.productData.productSkuInfos
      : null) ||
    (Array.isArray(item?.productData?.productSkuInfos) ? item.productData.productSkuInfos : null) ||
    [];

  const listProductCode = String(
    item?.productCode ||
      productObj?.productCode ||
      productObj?.offerId ||
      item?.offerId ||
      item?.productId ||
      item?.id ||
      '',
  ).trim();

  const listProductItemNumber = String(
    item?.productNo ||
      productObj?.productNo ||
      productObj?.productData?.productNo ||
      '',
  ).trim();

  const priceInfo = productObj?.priceInfo || item?.priceInfo;
  const costCandidates = [
    item?.productCost,
    item?.costPrice,
    item?.cost,
    productObj?.productCost,
    productObj?.costPrice,
    productObj?.consignPrice,
    priceInfo?.consignPrice,
  ];

  let listProductCost: number | null = null;
  for (const c of costCandidates) {
    listProductCost = parsePositiveCost(c);
    if (listProductCost != null) break;
  }
  if (listProductCost == null && skuInfos.length > 0) {
    for (const s of skuInfos) {
      listProductCost = parsePositiveCost(s?.consignPrice ?? s?.price);
      if (listProductCost != null) break;
    }
  }

  return { listProductCode, listProductItemNumber, listProductCost };
}

/** Explicit live-code on a listing row (walks `raw`, `product`, `productData`, etc.). */
export function pickLiveSellerRawLiveCode(row: any): string {
  return pickExplicitLiveCodeFromTree(row) || '';
}

/** 1688 / ownmall offer id on the listing (used as live-channel numeric id when no `liveCode`). */
export function getLiveSellerOfferId(row: any): string {
  if (!row) return '';
  const r = row.raw ?? row;
  const v =
    row.offerId ??
    r.offerId ??
    r.product?.offerId ??
    row.product?.offerId;
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

/**
 * Value shown beside the **Product Code** label on live-seller cards: real
 * `liveCode` when present, else tail digits from title, else `offerId`,
 * else catalog `listProductCode`.
 */
export function getLiveSellerProductCodeRowDisplayValue(mappedOrRow: any): string {
  const raw = mappedOrRow?.raw ?? mappedOrRow;
  const fromMappedLive =
    mappedOrRow?.liveCode != null && String(mappedOrRow.liveCode).trim() !== ''
      ? String(mappedOrRow.liveCode).trim()
      : '';
  if (fromMappedLive) return fromMappedLive;
  const explicit = pickLiveSellerRawLiveCode(mappedOrRow);
  if (explicit) return explicit;
  const named = extractLiveCode(
    mappedOrRow?.title,
    mappedOrRow?.name,
    raw?.subject,
    raw?.subjectTrans,
  );
  if (named) return named;
  const offer = getLiveSellerOfferId(mappedOrRow) || getLiveSellerOfferId(raw);
  if (offer) return offer;
  return getLiveSellerListingProductMeta(raw).listProductCode;
}

/**
 * Value for **Product Item Number** row: prefer `offerId` (live-channel id),
 * then SKU / listing `productNo` chain from {@link getLiveSellerListingProductMeta}.
 */
export function getLiveSellerProductItemNumberRowDisplayValue(mappedOrRow: any): string {
  const offer = getLiveSellerOfferId(mappedOrRow);
  if (offer) return offer;
  const raw = mappedOrRow?.raw ?? mappedOrRow;
  return getLiveSellerListingProductMeta(raw).listProductItemNumber;
}
