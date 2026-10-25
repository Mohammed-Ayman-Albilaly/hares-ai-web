import { useTranslation } from 'react-i18next';
import { setTheme, useTheme } from '@/lib/theme';
import { I } from './icons';

export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm !px-2"
      onClick={() => setTheme(next)}
      aria-label={t(next === 'dark' ? 'app.themeDark' : 'app.themeLight')}
      title={t(next === 'dark' ? 'app.themeDark' : 'app.themeLight')}
    >
      {theme === 'dark' ? <I.Sun size={15} /> : <I.Moon size={15} />}
    </button>
  );
}
