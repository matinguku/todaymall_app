import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Lazy load the LikeScreen component
const LazyLikeScreen = lazy(() => import('../main/LikeScreen'));

// Export a component that wraps the lazy-loaded component with Suspense
const LikeScreenWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingSpinner message="Loading likes..." />}>
    <LazyLikeScreen {...props} />
  </Suspense>
);

export default LikeScreenWithSuspense;
