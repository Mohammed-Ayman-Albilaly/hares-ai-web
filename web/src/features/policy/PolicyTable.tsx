import type { CategoryPolicyEntry } from '@hares/contract';
import { useTranslation } from 'react-i18next';
import { PolicyActionBadge, RiskBadge } from '@/components/ui/badges';
import { Card } from '@/components/ui/layout';

/** Policy per data category, read-only: the effective action and where it comes from. */
export function PolicyTable({ items }: { items: CategoryPolicyEntry[] }) {
  const { t } = useTranslation();
  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <table className="h-table">
          <caption className="sr-only">{t('policy.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('logs.category')}</th>
              <th scope="col">{t('policy.defaultRisk')}</th>
              <th scope="col">{t('policy.effectiveAction')}</th>
              <th scope="col">{t('policy.enabled')}</th>
              <th scope="col">{t('policy.source')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.category_code}>
                <td className="font-medium text-ink">{t(`category.${p.category_code}`)}</td>
                <td>
                  <RiskBadge level={p.default_risk_level} />
                </td>
                <td>
                  <PolicyActionBadge action={p.action} />
                </td>
                <td>{p.enabled ? t('policy.on') : t('policy.off')}</td>
                <td style={{ color: 'var(--ink-3)' }}>{t(`policy.sources.${p.source}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
