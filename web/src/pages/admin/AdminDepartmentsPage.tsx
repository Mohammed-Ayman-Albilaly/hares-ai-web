import type { DepartmentResponse } from '@hares/contract';
import { CreateDepartmentRequestSchema } from '@hares/contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { I } from '@/components/ui/icons';
import { formatNumber } from '@/components/charts/direction';
import { Card } from '@/components/ui/layout';
import { DataState, EmptyState, TableSkeleton } from '@/components/ui/states';
import { invalidateAdmin } from '@/features/common/invalidate';
import { useDepartments } from '@/features/common/useDepartments';
import { useLang } from '@/i18n/useLang';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { zodResolver } from '@/lib/form';

/** Create or rename: one name field, the API keeps names unique (case-insensitive). */
function NameDialog({ department, onClose }: { department: DepartmentResponse | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const form = useForm<{ name: string }>({
    resolver: zodResolver(CreateDepartmentRequestSchema, () => t),
    defaultValues: { name: department?.name ?? '' },
  });
  const m = useMutation({
    mutationFn: (v: { name: string }) =>
      department ? api.patch(`/admin/departments/${department.id}`, { name: v.name }) : api.post('/admin/departments', { name: v.name }),
    onSuccess: () => {
      void invalidateAdmin(qc);
      onClose();
    },
  });
  const nameErr = form.formState.errors.name?.message;
  return (
    <Modal open onClose={onClose} title={department ? t('departments.renameTitle') : t('departments.createTitle')}>
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => m.mutate(v))} noValidate>
        <TextField label={t('departments.name')} maxLength={100} error={nameErr} {...form.register('name')} />
        {m.isError && (
          <div className="err" role="alert">
            {apiErrorMessage(t, m.error, { CONFLICT: t('departments.nameTaken'), DEPARTMENT_NAME_TAKEN: t('departments.nameTaken') })}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('app.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={m.isPending} loadingLabel={t('manage.working')}>
            {department ? t('app.save') : t('departments.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeactivateDepartmentDialog({ department, onClose }: { department: DepartmentResponse; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api.post(`/admin/departments/${department.id}/deactivate`),
    onSuccess: () => {
      void invalidateAdmin(qc);
      onClose();
    },
  });
  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={t('departments.deactivateTitle', { name: department.name })}
      description={t('departments.deactivateBody')}
      confirmLabel={t('users.deactivate')}
      busyLabel={t('users.deactivating')}
      onConfirm={() => m.mutate()}
      busy={m.isPending}
      error={m.error}
    />
  );
}

/** Departments: create, rename, deactivate (WEB-FR-019, 054..056). Deactivating blocks ingestion for its users. */
export function AdminDepartmentsPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useDepartments();
  const [editing, setEditing] = useState<DepartmentResponse | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<DepartmentResponse | null>(null);
  const items = q.data?.items ?? [];

  return (
    <Page
      title={t('nav.adminDepartments')}
      crumb={t('navGroup.organization')}
      actions={
        <Button variant="primary" onClick={() => setEditing('new')}>
          <I.Plus size={14} /> {t('departments.create')}
        </Button>
      }
    >
      <DataState
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        refetch={() => void q.refetch()}
        isEmpty={items.length === 0}
        skeleton={<TableSkeleton rows={4} />}
        empty={<EmptyState title={t('departments.emptyTitle')} body={t('departments.emptyBody')} icon={<I.Departments size={20} />} />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="h-table">
              <caption className="sr-only">{t('departments.tableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('departments.name')}</th>
                  <th scope="col">{t('departments.members')}</th>
                  <th scope="col">{t('users.status')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('users.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-ink">{d.name}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(d.member_count, lang)}</td>
                    <td>
                      <span className={`h-pill ${d.active ? 'status-active' : 'status-inactive'}`}>
                        <span className="dot" aria-hidden="true" />
                        {d.active ? t('status.ACTIVE') : t('status.DEACTIVATED')}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button small variant="secondary" onClick={() => setEditing(d)} aria-label={t('departments.renameNamed', { name: d.name })}>
                          {t('departments.rename')}
                        </Button>
                        {d.active && (
                          <Button small variant="ghost" onClick={() => setDeactivating(d)} aria-label={t('departments.deactivateNamed', { name: d.name })}>
                            {t('users.deactivate')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>
      {editing && <NameDialog key={editing === 'new' ? 'new' : editing.id} department={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deactivating && <DeactivateDepartmentDialog department={deactivating} onClose={() => setDeactivating(null)} />}
    </Page>
  );
}
