import { POLICY_ACTIONS, type CategoryPolicyEntry, type PolicyAction } from '@hares/contract';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiskBadge } from '@/components/ui/badges';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/layout';
import { Toggle } from '@/components/ui/Toggle';
import { apiErrorMessage } from '@/lib/errors';

interface Props {
  items: CategoryPolicyEntry[];
  /** Save one category (the whole row: action + enabled). */
  save: (category: string, body: { action: PolicyAction; enabled: boolean }) => Promise<unknown>;
  /** Remove a department override (only passed for a department's table). */
  reset?: (category: string) => Promise<unknown>;
}

/**
 * Editable policy: a change is saved on the spot, one category at a time, and
 * the row shows "saving" and any error next to itself. The table is refreshed
 * by the caller after a save, so what you see is what the server holds.
 */
export function PolicyEditor({ items, save, reset }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  async function run(code: string, fn: () => Promise<unknown>) {
    setBusy(code);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError({ code, message: apiErrorMessage(t, e) });
    } finally {
      setBusy(null);
    }
  }

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
              {reset && (
                <th scope="col">
                  <span className="sr-only">{t('users.actions')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const name = t(`category.${p.category_code}`);
              const rowBusy = busy === p.category_code;
              // One save at a time: a second row cannot overwrite the first row's state.
              const locked = busy !== null;
              return (
                <tr key={p.category_code}>
                  <td className="font-medium text-ink">
                    {name}
                    {p.category_code === 'PERSONAL_IDENTITY' && <div className="hint">{t('policy.personalIdentityHint')}</div>}
                    {error?.code === p.category_code && (
                      <div className="err" role="alert">
                        {error.message}
                      </div>
                    )}
                  </td>
                  <td>
                    <RiskBadge level={p.default_risk_level} />
                  </td>
                  <td>
                    <select
                      className="control"
                      style={{ minWidth: 110, padding: '6px 10px' }}
                      aria-label={t('policy.actionFor', { name })}
                      value={p.action}
                      disabled={locked}
                      onChange={(e) => void run(p.category_code, () => save(p.category_code, { action: e.target.value as PolicyAction, enabled: p.enabled }))}
                    >
                      {POLICY_ACTIONS.map((a) => (
                        <option key={a} value={a}>
                          {t(`policyAction.${a}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Toggle
                      size="sm"
                      checked={p.enabled}
                      disabled={locked}
                      label={t('policy.enabledFor', { name })}
                      onChange={(enabled) => void run(p.category_code, () => save(p.category_code, { action: p.action, enabled }))}
                    />
                  </td>
                  <td style={{ color: 'var(--ink-3)' }}>{rowBusy ? t('policy.saving') : t(`policy.sources.${p.source}`)}</td>
                  {reset && (
                    <td>
                      {p.source === 'DEPARTMENT' && (
                        <Button small variant="ghost" disabled={locked} onClick={() => void run(p.category_code, () => reset(p.category_code))} aria-label={t('policy.resetFor', { name })}>
                          {t('policy.reset')}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
