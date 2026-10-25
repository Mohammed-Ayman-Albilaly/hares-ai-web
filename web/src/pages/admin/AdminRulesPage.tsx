import type { CustomRuleListResponse, CustomRuleResponse } from '@hares/contract';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '@/components/Page';
import { PolicyActionBadge, RiskBadge } from '@/components/ui/badges';
import { Button } from '@/components/ui/Button';
import { I } from '@/components/ui/icons';
import { Card } from '@/components/ui/layout';
import { DataState, EmptyState, TableSkeleton } from '@/components/ui/states';
import { useDepartments } from '@/features/common/useDepartments';
import { RuleForm } from '@/features/policy/RuleForm';
import { api } from '@/lib/api';

/** Detection rules: create and edit PATTERN, KEYWORD and TOPIC rules (WEB-FR-042..044). Not deleted, only disabled. */
export function AdminRulesPage() {
  const { t } = useTranslation();
  const departments = useDepartments();
  const q = useQuery({ queryKey: ['rules'], queryFn: ({ signal }) => api.get<CustomRuleListResponse>('/admin/rules', { signal }) });
  const [editing, setEditing] = useState<CustomRuleResponse | 'new' | null>(null);
  const items = q.data?.items ?? [];
  const deptName = new Map((departments.data?.items ?? []).map((d) => [d.id, d.name]));

  return (
    <Page
      title={t('nav.adminRules')}
      crumb={t('navGroup.organization')}
      actions={
        <Button variant="primary" onClick={() => setEditing('new')}>
          <I.Plus size={14} /> {t('rules.create')}
        </Button>
      }
    >
      <DataState
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        refetch={() => void q.refetch()}
        isEmpty={items.length === 0}
        skeleton={<TableSkeleton rows={5} />}
        empty={<EmptyState title={t('rules.adminEmptyTitle')} body={t('rules.adminEmptyBody')} icon={<I.Settings size={20} />} />}
      >
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="h-table">
              <caption className="sr-only">{t('rules.tableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('rules.name')}</th>
                  <th scope="col">{t('rules.kind')}</th>
                  <th scope="col">{t('logs.risk')}</th>
                  <th scope="col">{t('logs.action')}</th>
                  <th scope="col">{t('rules.scope')}</th>
                  <th scope="col">{t('policy.enabled')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('users.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-ink">{r.name}</td>
                    <td>{t(`rules.kinds.${r.kind}`)}</td>
                    <td>
                      <RiskBadge level={r.risk_level} />
                    </td>
                    <td>
                      <PolicyActionBadge action={r.action} />
                    </td>
                    <td style={{ color: 'var(--ink-3)' }}>
                      {r.scope === 'ORG_WIDE' ? t('rules.scopes.ORG_WIDE') : r.department_ids.map((id) => deptName.get(id) ?? '…').join('، ')}
                    </td>
                    <td>{r.enabled ? t('policy.on') : t('policy.off')}</td>
                    <td>
                      <Button small variant="secondary" onClick={() => setEditing(r)} aria-label={t('rules.editNamed', { name: r.name })}>
                        {t('rules.edit')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>
      {editing && <RuleForm key={editing === 'new' ? 'new' : editing.id} rule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}
