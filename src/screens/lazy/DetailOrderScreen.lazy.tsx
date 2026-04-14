import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Lazy load the DetailOrderScreen component
const LazyDetailOrderScreen = lazy(() => import('../main/profileScreen/DetailOrderScreen'));

// Export a component that wraps the lazy-loaded component with Suspense
const DetailOrderScreenWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingSpinner message="Loading order details..." />}>
    <LazyDetailOrderScreen {...props} />
  </Suspense>
);

export default DetailOrderScreenWithSuspense;
