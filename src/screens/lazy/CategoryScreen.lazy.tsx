import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAppSelector } from '../../store/hooks';
import { translations } from '../../i18n/translations';

// Lazy load the CategoryScreen component
const LazyCategoryScreen = lazy(() => import('../main/CategoryScreen'));

// Export a component that wraps the lazy-loaded component with Suspense
const CategoryScreenWithSuspense = (props: any) => {
  const locale = useAppSelector((s) => s.i18n.locale);
  const t = (key: string) => {
    const dict: any = (translations as any)[locale] || (translations as any).en;
    const val = key.split('.').reduce((o: any, k: string) => (o && o[k] !== undefined ? o[k] : undefined), dict);
    if (val !== undefined) return String(val);
    const fallback = key.split('.').reduce((o: any, k: string) => (o && o[k] !== undefined ? o[k] : undefined), (translations as any).en);
    return fallback !== undefined ? String(fallback) : key;
  };
  return (
    <Suspense fallback={<LoadingSpinner message={t('loading.category')} />}>
      <LazyCategoryScreen {...props} />
    </Suspense>
  );
};

export default CategoryScreenWithSuspense;
