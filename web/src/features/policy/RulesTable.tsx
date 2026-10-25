import type { CustomRuleResponse } from '@hares/contract';
import { useTranslation } from 'react-i18next';
import { PolicyActionBadge, RiskBadge } from '@/components/ui/badges';
import { Card } from '@/components/ui/layout';

/**
 * Detection rules, read-only. The text of a TOPIC rule is never shown here: it
 * describes what to look for and is treated as confidential (decision 30: examples may hold sensitive hints).
 */
export function RulesTable({ items }: { items: CustomRuleResponse[] }) {
  const { t } = useTranslation();
  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <table className="h-table">
          <caption className="sr-only">{t('rules.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('rules.name')}</th>
              <th scope="col">{t('rules.kind')}</th>
              <th scope="col">{t('rules.definition')}</th>
              <th scope="col">{t('logs.risk')}</th>
              <th scope="col">{t('logs.action')}</th>
              <th scope="col">{t('rules.scope')}</th>
              <th scope="col">{t('policy.enabled')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="font-medium text-ink">{r.name}</td>
                <td>{t(`rules.kinds.${r.kind}`)}</td>
                <td style={{ maxWidth: 280 }}>
                  {r.kind === 'TOPIC' ? (
                    <span className="text-ink-4">{t('rules.hidden')}</span>
                  ) : (
                    <code className="block truncate text-xs" dir="ltr" style={{ textAlign: 'start' }} title={r.definition}>
                      {r.definition}
                    </code>
                  )}
                </td>
                <td>
                  <RiskBadge level={r.risk_level} />
                </td>
                <td>
                  <PolicyActionBadge action={r.action} />
                </td>
                <td style={{ color: 'var(--ink-3)' }}>{t(`rules.scopes.${r.scope}`)}</td>
                <td>{r.enabled ? t('policy.on') : t('policy.off')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
