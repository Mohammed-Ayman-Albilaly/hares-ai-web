import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/components/charts/direction';
import { useLang } from '@/i18n/useLang';
import { Button } from './Button';

interface BarProps {
  /** Where the reader is in the list, already formatted (announced when it changes). */
  position: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/** The one bar under a table: position on the inline start, the two steps on the inline end. */
function PaginationBar({ position, hasPrev, hasNext, onPrev, onNext }: BarProps) {
  const { t } = useTranslation();
  return (
    <nav
      // Wraps on a phone: the position text keeps its line instead of pushing the buttons off the card.
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line px-4 py-3 text-[12.5px] text-ink-4"
      aria-label={t('logs.pagination')}
    >
      <div className="min-w-0" aria-live="polite">
        {position}
      </div>
      <div className="flex gap-2">
        <Button small variant="ghost" onClick={onPrev} disabled={!hasPrev}>
          {t('logs.prev')}
        </Button>
        <Button small variant="ghost" onClick={onNext} disabled={!hasNext}>
          {t('logs.next')}
        </Button>
      </div>
    </nav>
  );
}

interface PageProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

/** Previous/Next for lists the server pages by page number (users, departments): the total is known. */
export function PageNav({ page, pageSize, total, onPage }: PageProps) {
  const { t } = useTranslation();
  const lang = useLang();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <PaginationBar
      position={t('app.pageOf', {
        page: formatNumber(page, lang),
        pages: formatNumber(pages, lang),
        total: formatNumber(total, lang),
      })}
      hasPrev={page > 1}
      hasNext={page < pages}
      onPrev={() => onPage(page - 1)}
      onNext={() => onPage(page + 1)}
    />
  );
}

interface CursorProps {
  page: number;
  /** Rows on this page (a cursor list has no total). */
  count: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/** The same bar for lists the server pages by cursor (logs, audit trail). */
export function CursorNav({ page, count, hasPrev, hasNext, onPrev, onNext }: CursorProps) {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <PaginationBar
      position={t('logs.pageInfo', { page: formatNumber(page, lang), count: formatNumber(count, lang) })}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onPrev={onPrev}
      onNext={onNext}
    />
  );
}
