import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Single import factory so React.lazy and the manual prefetch hit the same
// module record (preventing a second network/parse pass).
const importProductDetail = () => import('../main/ProductDetailScreen');

const LazyProductDetailScreen = lazy(importProductDetail);

// Call this once the app is idle to download/parse the chunk before the user
// taps a product card. Subsequent navigations will then resolve immediately
// instead of showing the Suspense fallback.
export const preloadProductDetailScreen = (): Promise<unknown> =>
  importProductDetail().catch(() => {
    /* swallow — preload is best-effort */
  });

// Export a component that wraps the lazy-loaded component with Suspense
const ProductDetailScreenWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingSpinner message="Loading product details..." />}>
    <LazyProductDetailScreen {...props} />
  </Suspense>
);

export default ProductDetailScreenWithSuspense;