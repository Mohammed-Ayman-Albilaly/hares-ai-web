import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ar } from './ar';
import { en } from './en';

export type Lang = 'ar' | 'en';
export const LANGS: readonly Lang[] = ['ar', 'en'];
const STORAGE_KEY = 'hares.lang';

export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');

/** The saved choice, else Arabic (the first language). Storage may be blocked: never throw. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* private mode or blocked storage */
  }
  return 'ar';
}

/** Keep <html lang dir> in step with the language so layout, forms and screen readers follow it. */
export function applyDocumentLang(lang: Lang): void {
  document.documentElement.lang = lang;
  document.documentElement.dir = dirOf(lang);
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore: the choice just will not persist */
  }
  void i18n.changeLanguage(lang);
}

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: initialLang(),
  fallbackLng: 'ar',
  supportedLngs: [...LANGS],
  interpolation: { escapeValue: false }, // React escapes
  returnNull: false,
});

applyDocumentLang(i18n.language as Lang);
i18n.on('languageChanged', (lng) => applyDocumentLang(lng as Lang));

export default i18n;
