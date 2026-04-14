import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Lazy load the StorePerformanceScreen component
const LazyStorePerformanceScreen = lazy(() => import('../main/StorePerformanceScreen'));

// Export a component that wraps the lazy-loaded component with Suspense
const StorePerformanceScreenWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingSpinner message="Loading store performance..." />}>
    <LazyStorePerformanceScreen {...props} />
  </Suspense>
);

export default StorePerformanceScreenWithSuspense;
