import { useTranslation } from 'react-i18next';
import { setLang } from '@/i18n';
import { useLang } from '@/i18n/useLang';
import { I } from './icons';

/**
 * Language switcher (WEB-NFR-012): on every page, persisted. It shows the name
 * of the OTHER language, written in that language, and tags it with `lang` so
 * screen readers pronounce it correctly.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const next = lang === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm ${className}`}
      onClick={() => setLang(next)}
      aria-label={t('app.language')}
      title={t('app.language')}
    >
      <I.Globe size={14} />
      <span lang={next}>{t('app.switchTo')}</span>
    </button>
  );
}
