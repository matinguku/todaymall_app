import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Lazy load the StoreInformationScreen component
const LazyStoreInformationScreen = lazy(() => import('../main/StoreInformationScreen'));

// Export a component that wraps the lazy-loaded component with Suspense
const StoreInformationScreenWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingSpinner message="Loading store information..." />}>
    <LazyStoreInformationScreen {...props} />
  </Suspense>
);

export default StoreInformationScreenWithSuspense;
