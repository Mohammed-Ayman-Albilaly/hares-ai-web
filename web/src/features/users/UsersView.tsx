import { USER_STATUSES, type AdminUserResponse, type UserListResponse } from '@hares/contract';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Card, FilterBar } from '@/components/ui/layout';
import { PageNav } from '@/components/ui/PageNav';
import { RoleBadge, StatusBadge } from '@/components/ui/badges';
import { SelectField } from '@/components/ui/SelectField';
import { DataState, EmptyState, TableSkeleton } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/useDebounced';
import { useDateTime } from '@/features/logs/LogTable';

const PAGE_SIZE = 25;

interface Props {
  /** Show the department column (organisation view). */
  showDepartment?: boolean;
  /** Buttons for one row (e.g. Deactivate). */
  renderActions?: (user: AdminUserResponse) => ReactNode;
  emptyTitle: string;
  emptyBody: string;
}

/**
 * Users of the caller's scope with search, status filter and paging. The API
 * decides the scope (a Department Admin only ever receives their own department).
 */
export function UsersView({ showDepartment, renderActions, emptyTitle, emptyBody }: Props) {
  const { t } = useTranslation();
  const when = useDateTime();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q.trim());
  // A new search term or status starts again at page 1 (one fetch, with the new term).
  useEffect(() => setPage(1), [search, status]);

  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  if (search) params.set('q', search);
  if (status) params.set('status', status);

  const query = useQuery({
    queryKey: ['users', search, status, page],
    queryFn: ({ signal }) => api.get<UserListResponse>(`/admin/users?${params.toString()}`, { signal }),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.items ?? [];
  // The last row of the last page was removed (e.g. deactivated under a status filter): go back.
  useEffect(() => {
    if (query.data && query.data.items.length === 0 && page > 1) setPage(1);
  }, [query.data, page]);
  const filtered = Boolean(search || status);

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <div className="field" style={{ minWidth: 240 }}>
          <label htmlFor="u-q">{t('users.search')}</label>
          <input
            id="u-q"
            type="search"
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('users.searchPlaceholder')}
          />
        </div>
        <SelectField
          label={t('users.status')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t('logs.all')}</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </SelectField>
      </FilterBar>

      <DataState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        refetch={() => void query.refetch()}
        isEmpty={items.length === 0}
        skeleton={<TableSkeleton rows={6} />}
        empty={filtered ? <EmptyState title={t('logs.noResults')} body={t('logs.noResultsBody')} /> : <EmptyState title={emptyTitle} body={emptyBody} />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto" style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
            <table className="h-table">
              <caption className="sr-only">{t('users.tableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('users.user')}</th>
                  <th scope="col">{t('users.role')}</th>
                  {showDepartment && <th scope="col">{t('logs.department')}</th>}
                  <th scope="col">{t('users.status')}</th>
                  <th scope="col">{t('users.registered')}</th>
                  {renderActions && (
                    <th scope="col">
                      <span className="sr-only">{t('users.actions')}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.full_name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{u.full_name}</div>
                          <div className="truncate text-xs text-ink-4" dir="ltr" style={{ textAlign: 'start' }}>
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    {showDepartment && <td style={{ color: 'var(--ink-3)' }}>{u.department_name ?? '—'}</td>}
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{when(u.registered_at)}</td>
                    {renderActions && <td>{renderActions(u)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.data && <PageNav page={query.data.page} pageSize={query.data.page_size} total={query.data.total} onPage={setPage} />}
        </Card>
      </DataState>
    </div>
  );
}
