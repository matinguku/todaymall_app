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
