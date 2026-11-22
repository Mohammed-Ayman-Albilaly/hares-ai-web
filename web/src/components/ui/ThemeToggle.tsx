import { useTranslation } from 'react-i18next';
import { setTheme, useTheme } from '@/lib/theme';
import { IconButton } from './IconButton';
import { I } from './icons';

/** Light/dark switch: one 44x44 target with a name, never an unlabelled icon. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <IconButton
      label={t(next === 'dark' ? 'app.themeDark' : 'app.themeLight')}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? <I.Sun size={16} /> : <I.Moon size={16} />}
    </IconButton>
  );
}
