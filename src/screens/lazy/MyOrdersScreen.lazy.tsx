import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Lazy load the MyOrdersScreen component
const LazyMyOrdersScreen = lazy(() => import('../main/profileScreen/MyOrdersScreen'));

// Export a component that wraps the lazy-loaded component with Suspense
const MyOrdersScreenWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingSpinner message="Loading my orders..." />}>
    <LazyMyOrdersScreen {...props} />
  </Suspense>
);

export default MyOrdersScreenWithSuspense;
