import type { LogListItem } from '@hares/contract';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionBadge, DecisionBadge, RiskBadge } from '@/components/ui/badges';
import { I } from '@/components/ui/icons';
import { useLang } from '@/i18n/useLang';

export function useDateTime() {
  const lang = useLang();
  // Western digits in both languages (unambiguous numbers), local time zone.
  const f = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  return (iso: string) => f.format(new Date(iso));
}

interface Props {
  items: LogListItem[];
  /** Show the user and department columns (administrator views). */
  showUser?: boolean;
  /** Dim the table while the next page loads. */
  busy?: boolean;
  compact?: boolean;
}

/**
 * The log table (WEB-FR-026). Rows hold metadata only: time, platform, the
 * categories of data that were found, risk, action and the user's decision.
 * There is no prompt text to show, so a row expands to the full category list
 * instead of the prompt. Each row has a real button for the expansion so it
 * works with a keyboard and a screen reader.
 */
export function LogTable({ items, showUser, busy, compact }: Props) {
  const { t } = useTranslation();
  const when = useDateTime();
  const [open, setOpen] = useState<string | null>(null);
  const cols = 6 + (showUser ? 2 : 0) + (compact ? 0 : 1);

  return (
    <div className="overflow-x-auto" style={{ opacity: busy ? 0.6 : 1 }} aria-busy={busy || undefined}>
      <table className="h-table">
        <caption className="sr-only">{t('logs.tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col" style={{ width: 200 }}>
              {t('logs.time')}
            </th>
            {showUser && <th scope="col">{t('logs.user')}</th>}
            {showUser && <th scope="col">{t('logs.department')}</th>}
            <th scope="col" style={{ width: 100 }}>
              {t('logs.platform')}
            </th>
            <th scope="col">{t('logs.categories')}</th>
            <th scope="col" style={{ width: 120 }}>
              {t('logs.risk')}
            </th>
            <th scope="col" style={{ width: 120 }}>
              {t('logs.action')}
            </th>
            {!compact && (
              <th scope="col" style={{ width: 150 }}>
                {t('logs.decision')}
              </th>
            )}
            <th scope="col" style={{ width: 44 }}>
              <span className="sr-only">{t('logs.details')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const expanded = open === r.log_id;
            const shown = r.categories.slice(0, 2);
            return (
              <Fragment key={r.log_id}>
                <tr>
                  <td style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{when(r.event_time)}</td>
                  {showUser && <td>{r.user_name}</td>}
                  {showUser && <td style={{ color: 'var(--ink-3)' }}>{r.department_name ?? '—'}</td>}
                  <td>{t(`platform.${r.platform}`)}</td>
                  <td style={{ fontSize: 12.5 }}>
                    {r.categories.length === 0 && r.rule_name ? (
                      <span className="h-pill risk-none" style={{ fontSize: 11 }}>
                        {t('logs.ruleNamed', { name: r.rule_name })}
                      </span>
                    ) : r.categories.length === 0 ? (
                      <span style={{ color: 'var(--ink-4)' }}>{t('logs.noCategories')}</span>
                    ) : (
                      <>
                        {shown.map((c) => (
                          <span key={c} className={`h-pill risk-${r.risk_level === 'HIGH' ? 'high' : r.risk_level === 'MEDIUM' ? 'med' : 'low'}`} style={{ marginInlineEnd: 4, fontSize: 11 }}>
                            {t(`category.${c}`)}
                          </span>
                        ))}
                        {r.categories.length > 2 && <span style={{ color: 'var(--ink-4)' }}>+{r.categories.length - 2}</span>}
                      </>
                    )}
                  </td>
                  <td>
                    <RiskBadge level={r.risk_level} />
                  </td>
                  <td>
                    <ActionBadge action={r.action} />
                  </td>
                  {!compact && (
                    <td>
                      <DecisionBadge decision={r.user_decision} />
                    </td>
                  )}
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost !p-1.5"
                      aria-expanded={expanded}
                      aria-controls={expanded ? `log-${r.log_id}` : undefined}
                      aria-label={t(expanded ? 'logs.collapseRow' : 'logs.expandRow', { time: when(r.event_time), platform: t(`platform.${r.platform}`) })}
                      onClick={() => setOpen(expanded ? null : r.log_id)}
                    >
                      <I.Chevron size={14} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr id={`log-${r.log_id}`}>
                    <td colSpan={cols} style={{ background: 'var(--surface-2)' }}>
                      <div className="grid gap-5 p-4 sm:grid-cols-2">
                        <div>
                          <div className="mb-2 text-[11px] font-medium text-ink-4">{t('logs.detectedCategories')}</div>
                          {r.categories.length === 0 && !r.rule_name ? (
                            <div className="text-[13px] text-ink-4">{t('logs.nothingDetected')}</div>
                          ) : (
                            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                              {r.categories.map((c) => (
                                <li key={c} className="h-pill risk-none" style={{ fontSize: 12 }}>
                                  {t(`category.${c}`)}
                                </li>
                              ))}
                              {r.rule_name && (
                                <li className="h-pill risk-none" style={{ fontSize: 12 }}>
                                  {t('logs.ruleNamed', { name: r.rule_name })}
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                        <div className="text-[13px] text-ink-3">
                          <p className="m-0 mb-2">{t('logs.privacyNote')}</p>
                          {compact && (
                            <p className="m-0">
                              {t('logs.decision')}: <DecisionBadge decision={r.user_decision} />
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
