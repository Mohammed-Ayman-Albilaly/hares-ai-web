import { useTranslation } from 'react-i18next';
import { setLang } from '@/i18n';
import { useLang } from '@/i18n/useLang';
import { I } from './icons';

/**
 * Language switcher (WEB-NFR-012): on every page, persisted. It shows the name
 * of the OTHER language, written in that language, and tags it with `lang` so
 * screen readers pronounce it correctly. Below 640px that name is hidden
 * visually but stays in the DOM, so the accessible name always reads
 * "switchTo: language".
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const next = lang === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm gap-2 ${className}`}
      onClick={() => setLang(next)}
      // The visible name comes first, so the accessible name starts with it (WCAG 2.5.3).
      title={t('app.language')}
    >
      <I.Globe size={15} />
      <span lang={next} className="sr-only sm:not-sr-only">
        {t('app.switchTo')}
      </span>
      <span className="sr-only">: {t('app.language')}</span>
    </button>
  );
}
