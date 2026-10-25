import type { AdminUserResponse, UserListResponse } from '@hares/contract';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { I } from '@/components/ui/icons';
import { Avatar, Card } from '@/components/ui/layout';
import { PageNav } from '@/components/ui/PageNav';
import { SelectField } from '@/components/ui/SelectField';
import { DataState, EmptyState, TableSkeleton } from '@/components/ui/states';
import { invalidateAdmin } from '@/features/common/invalidate';
import { useDepartments } from '@/features/common/useDepartments';
import { useDateTime } from '@/features/logs/LogTable';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';

const PAGE_SIZE = 25;


/** Approve: the admin picks the department (active ones) and the role, as the account has neither yet (WEB-FR-056). */
function ApproveDialog({ user, onClose }: { user: AdminUserResponse; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const departments = useDepartments();
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState<'USER' | 'DEPARTMENT_ADMIN'>('USER');
  const m = useMutation({
    mutationFn: () => api.post(`/admin/users/${user.id}/approve`, { department_id: departmentId, role }),
    onSuccess: () => {
      void invalidateAdmin(qc);
      onClose();
    },
  });
  const active = (departments.data?.items ?? []).filter((d) => d.active);
  return (
    <Modal open onClose={onClose} title={t('pending.approveTitle', { name: user.full_name })} description={user.email}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (departmentId) m.mutate();
        }}
      >
        <SelectField label={t('logs.department')} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={departments.isLoading}>
          <option value="">{t('manage.chooseDepartment')}</option>
          {active.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('users.role')} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="USER">{t('roles.USER')}</option>
          <option value="DEPARTMENT_ADMIN">{t('roles.DEPARTMENT_ADMIN')}</option>
        </SelectField>
        {m.isError && (
          <div className="err" role="alert">
            {apiErrorMessage(t, m.error)}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('app.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={m.isPending} loadingLabel={t('manage.working')} disabled={!departmentId}>
            {t('pending.approve')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RejectDialog({ user, onClose }: { user: AdminUserResponse; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api.post(`/admin/users/${user.id}/reject`),
    onSuccess: () => {
      void invalidateAdmin(qc);
      onClose();
    },
  });
  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={t('pending.rejectTitle', { name: user.full_name })}
      description={t('pending.rejectBody')}
      confirmLabel={t('pending.reject')}
      busyLabel={t('manage.working')}
      onConfirm={() => m.mutate()}
      busy={m.isPending}
      error={m.error}
    />
  );
}

/** Accounts waiting for a decision, oldest first, with approve and reject. */
export function PendingApprovals() {
  const { t } = useTranslation();
  const when = useDateTime();
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<AdminUserResponse | null>(null);
  const [rejecting, setRejecting] = useState<AdminUserResponse | null>(null);
  const q = useQuery({
    queryKey: ['pending', page],
    queryFn: ({ signal }) => api.get<UserListResponse>(`/admin/users/pending?page=${page}&page_size=${PAGE_SIZE}`, { signal }),
    placeholderData: keepPreviousData,
  });
  const items = q.data?.items ?? [];
  // The last request of the last page was decided: go back instead of showing an empty page.
  useEffect(() => {
    if (q.data && q.data.items.length === 0 && page > 1) setPage(1);
  }, [q.data, page]);

  return (
    <>
      <DataState
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        refetch={() => void q.refetch()}
        isEmpty={items.length === 0}
        skeleton={<TableSkeleton rows={4} />}
        empty={<EmptyState title={t('pending.emptyTitle')} body={t('pending.emptyBody')} icon={<I.Check size={20} />} />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="h-table">
              <caption className="sr-only">{t('pending.tableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('users.user')}</th>
                  <th scope="col">{t('users.registered')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('users.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.full_name} />
                        <div className="min-w-0">
                          <div className="font-medium text-ink">{u.full_name}</div>
                          <div className="text-xs text-ink-4" dir="ltr" style={{ textAlign: 'start' }}>
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{when(u.registered_at)}</td>
                    <td>
                      <div className="flex gap-2">
                        <Button small variant="primary" onClick={() => setApproving(u)} aria-label={t('pending.approveNamed', { name: u.full_name })}>
                          {t('pending.approve')}
                        </Button>
                        <Button small variant="ghost" onClick={() => setRejecting(u)} aria-label={t('pending.rejectNamed', { name: u.full_name })}>
                          {t('pending.reject')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.data && <PageNav page={q.data.page} pageSize={q.data.page_size} total={q.data.total} onPage={setPage} />}
        </Card>
      </DataState>
      {approving && <ApproveDialog user={approving} onClose={() => setApproving(null)} />}
      {rejecting && <RejectDialog user={rejecting} onClose={() => setRejecting(null)} />}
    </>
  );
}
