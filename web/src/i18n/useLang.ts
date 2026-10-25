import { useTranslation } from 'react-i18next';
import { dirOf, type Lang } from './index';

/** The active language ('ar' | 'en'). */
export function useLang(): Lang {
  const { i18n } = useTranslation();
  return i18n.language === 'en' ? 'en' : 'ar';
}

/** The active text direction. */
export const useDir = (): 'rtl' | 'ltr' => dirOf(useLang());
