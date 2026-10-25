import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES, type AuditEntryResponse, type AuditQueryResponse } from '@hares/contract';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { formatNumber } from '@/components/charts/direction';
import { Button } from '@/components/ui/Button';
import { I } from '@/components/ui/icons';
import { Card, FilterBar } from '@/components/ui/layout';
import { SelectField } from '@/components/ui/SelectField';
import { DataState, EmptyState, TableSkeleton } from '@/components/ui/states';
import { useKeysetList } from '@/features/logs/hooks';
import { useDateTime } from '@/features/logs/LogTable';
import { useLang } from '@/i18n/useLang';

const dayStart = (day: string, plusDays = 0) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d! + plusDays).toISOString();
};

/** Short, non-sensitive facts of one entry (ids, enum values, old/new names), as small tags. */
function Detail({ detail }: { detail: AuditEntryResponse['detail'] }) {
  if (!detail || Object.keys(detail).length === 0) return <span className="text-ink-4">—</span>;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" dir="ltr">
      {Object.entries(detail).map(([k, v]) => (
        <li key={k} className="h-pill role-user" style={{ fontSize: 11 }}>
          {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
        </li>
      ))}
    </ul>
  );
}

/** Read-only trail of administrator actions, newest first (WEB-FR-031, 066). Never edited or deleted. */
export function AdminAuditPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const when = useDateTime();
  const [f, setF] = useState({ action_type: '', target_type: '', fromDay: '', toDay: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const rangeInvalid = Boolean(f.fromDay && f.toDay && f.fromDay > f.toDay);

  const filters = useMemo(
    () => ({
      ...(f.action_type ? { action_type: f.action_type } : {}),
      ...(f.target_type ? { target_type: f.target_type } : {}),
      ...(f.fromDay ? { from: dayStart(f.fromDay) } : {}),
      ...(f.toDay ? { to: dayStart(f.toDay, 1) } : {}),
    }),
    [f],
  );
  const { query, page, hasPrev, hasNext, goNext, goPrev } = useKeysetList<AuditQueryResponse>('audit', '/admin/audit', filters, 25, !rangeInvalid);
  const items = query.data?.items ?? [];
  const filtered = Object.keys(filters).length > 0;
  const clear = () => setF({ action_type: '', target_type: '', fromDay: '', toDay: '' });

  return (
    <Page title={t('nav.adminAudit')} crumb={t('navGroup.organization')}>
      <FilterBar>
        <SelectField label={t('audit.action')} value={f.action_type} onChange={set('action_type')}>
          <option value="">{t('logs.all')}</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {t(`audit.actions.${a}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('audit.target')} value={f.target_type} onChange={set('target_type')}>
          <option value="">{t('logs.all')}</option>
          {AUDIT_TARGET_TYPES.map((a) => (
            <option key={a} value={a}>
              {t(`audit.targets.${a}`)}
            </option>
          ))}
        </SelectField>
        <div className="field">
          <label htmlFor="a-from">{t('logs.from')}</label>
          <input id="a-from" type="date" value={f.fromDay} max={f.toDay || undefined} onChange={set('fromDay')} />
        </div>
        <div className="field">
          <label htmlFor="a-to">{t('logs.to')}</label>
          <input id="a-to" type="date" value={f.toDay} min={f.fromDay || undefined} aria-invalid={rangeInvalid || undefined} onChange={set('toDay')} />
        </div>
        <Button variant="ghost" className="self-end" onClick={clear} disabled={!filtered && !f.fromDay}>
          <I.X size={14} /> {t('logs.clear')}
        </Button>
        {rangeInvalid && (
          <div className="err w-full" role="alert">
            {t('logs.rangeInvalid')}
          </div>
        )}
      </FilterBar>

      {!rangeInvalid && (
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          refetch={() => void query.refetch()}
          isEmpty={items.length === 0}
          skeleton={<TableSkeleton rows={8} />}
          empty={
            filtered ? (
              <EmptyState title={t('logs.noResults')} body={t('logs.noResultsBody')} action={<Button onClick={clear}>{t('logs.clear')}</Button>} />
            ) : (
              <EmptyState title={t('audit.emptyTitle')} body={t('audit.emptyBody')} />
            )
          }
        >
          <Card padded={false}>
            <div className="overflow-x-auto" style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
              <table className="h-table">
                <caption className="sr-only">{t('audit.tableCaption')}</caption>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 200 }}>
                      {t('logs.time')}
                    </th>
                    <th scope="col">{t('audit.admin')}</th>
                    <th scope="col">{t('audit.action')}</th>
                    <th scope="col">{t('audit.target')}</th>
                    <th scope="col">{t('audit.detail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id}>
                      <td style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{when(e.created_at)}</td>
                      <td className="font-medium text-ink">{e.acting_admin_name}</td>
                      <td>{t(`audit.actions.${e.action_type}`)}</td>
                      <td>
                        <div>{e.target_name ?? '—'}</div>
                        <div className="text-xs text-ink-4">{t(`audit.targets.${e.target_type}`)}</div>
                      </td>
                      <td style={{ maxWidth: 360 }}>
                        <Detail detail={e.detail} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12.5px] text-ink-4" aria-label={t('logs.pagination')}>
              <div aria-live="polite">{t('logs.pageInfo', { page: formatNumber(page, lang), count: formatNumber(items.length, lang) })}</div>
              <div className="flex gap-2">
                <Button small variant="ghost" onClick={goPrev} disabled={!hasPrev}>
                  {t('logs.prev')}
                </Button>
                <Button small variant="ghost" onClick={goNext} disabled={!hasNext}>
                  {t('logs.next')}
                </Button>
              </div>
            </nav>
          </Card>
        </DataState>
      )}
    </Page>
  );
}
