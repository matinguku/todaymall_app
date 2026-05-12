import { useAppSelector } from '../store/hooks';
import { getTranslation } from '../utils/i18nHelpers';

export const useTranslation = () => {
  const rawLocale = useAppSelector((state) => state.i18n?.locale || 'ko');
  const locale: 'en' | 'ko' | 'zh' =
    rawLocale === 'en' || rawLocale === 'ko' || rawLocale === 'zh'
      ? rawLocale
      : 'ko';

  const t = (key: string): string => getTranslation(key, locale);

  return { t, locale };
};