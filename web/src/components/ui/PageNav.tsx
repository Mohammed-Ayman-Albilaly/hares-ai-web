import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/components/charts/direction';
import { useLang } from '@/i18n/useLang';
import { Button } from './Button';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

/** Previous/Next for lists the server pages by page number (users, departments). */
export function PageNav({ page, pageSize, total, onPage }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12.5px] text-ink-4" aria-label={t('logs.pagination')}>
      <div aria-live="polite">
        {t('app.pageOf', { page: formatNumber(page, lang), pages: formatNumber(pages, lang), total: formatNumber(total, lang) })}
      </div>
      <div className="flex gap-2">
        <Button small variant="ghost" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          {t('logs.prev')}
        </Button>
        <Button small variant="ghost" onClick={() => onPage(page + 1)} disabled={page >= pages}>
          {t('logs.next')}
        </Button>
      </div>
    </nav>
  );
}
