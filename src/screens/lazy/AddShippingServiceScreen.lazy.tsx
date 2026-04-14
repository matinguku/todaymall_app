import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Lazy load the AddShippingServiceScreen component
const LazyAddShippingServiceScreen = lazy(() => import('../main/profileScreen/AddShippingServiceScreen'));

// Export a component that wraps the lazy-loaded component with Suspense
const AddShippingServiceScreenWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingSpinner message="Loading shipping service..." />}>
    <LazyAddShippingServiceScreen {...props} />
  </Suspense>
);

export default AddShippingServiceScreenWithSuspense;
