import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SelectField } from '@/components/ui/SelectField';
import { invalidateAdmin } from '@/features/common/invalidate';
import { useDepartments } from '@/features/common/useDepartments';
import { api } from '@/lib/api';

/** Make one department follow another's policy (the usual start for a new department). One audited change on the server. */
export function CopyPolicy() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const departments = useDepartments();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const items = (departments.data?.items ?? []).filter((d) => d.active);
  const name = (id: string) => items.find((d) => d.id === id)?.name ?? '';

  const copy = useMutation({
    mutationFn: () => api.post(`/admin/policy/departments/${to}/copy-from/${from}`, {}),
    onSuccess: async () => {
      setConfirming(false);
      setDone(true);
      await invalidateAdmin(qc);
    },
  });

  const options = (
    <>
      <option value="">{t('manage.chooseDepartment')}</option>
      {items.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </>
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <SelectField label={t('policy.copyFrom')} value={from} onChange={(e) => { setFrom(e.target.value); setDone(false); }}>
          {options}
        </SelectField>
      </div>
      <div className="min-w-[200px] flex-1">
        <SelectField label={t('policy.copyTo')} value={to} onChange={(e) => { setTo(e.target.value); setDone(false); }}>
          {options}
        </SelectField>
      </div>
      <Button variant="secondary" disabled={!from || !to || from === to} onClick={() => { copy.reset(); setConfirming(true); }}>
        {t('policy.copyAction')}
      </Button>
      {done && (
        <span role="status" className="text-[13px] text-ink-3">
          {t('policy.copyDone')}
        </span>
      )}
      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('policy.copyConfirmTitle')}
        description={t('policy.copyConfirmBody', { from: name(from), to: name(to) })}
        confirmLabel={t('policy.copyAction')}
        busyLabel={t('policy.copying')}
        onConfirm={() => copy.mutate()}
        busy={copy.isPending}
        error={copy.error}
        danger={false}
      />
    </div>
  );
}
