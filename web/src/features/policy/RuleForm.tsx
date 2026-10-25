import {
  CustomRuleRequestSchema,
  POLICY_ACTIONS,
  RISK_LEVELS,
  RULE_KINDS,
  RULE_SCOPES,
  type CustomRuleRequest,
  type CustomRuleResponse,
} from '@hares/contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { Toggle } from '@/components/ui/Toggle';
import { invalidateAdmin } from '@/features/common/invalidate';
import { useDepartments } from '@/features/common/useDepartments';
import { api, ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { zodResolver } from '@/lib/form';

/**
 * Create or edit a detection rule (WEB-FR-042..044). The same Zod schema the API
 * uses checks the form; the API additionally proves a PATTERN safe (ReDoS), and
 * its answer is shown under the definition. A TOPIC description is free text the
 * extension's classifier reads: the form warns not to put real secrets in it.
 */
export function RuleForm({ rule, onClose }: { rule: CustomRuleResponse | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const departments = useDepartments();
  const form = useForm<CustomRuleRequest>({
    resolver: zodResolver(CustomRuleRequestSchema, () => t),
    defaultValues: rule
      ? {
          name: rule.name,
          kind: rule.kind,
          definition: rule.definition,
          risk_level: rule.risk_level,
          action: rule.action,
          scope: rule.scope,
          department_ids: rule.department_ids,
          enabled: rule.enabled,
        }
      : { name: '', kind: 'KEYWORD', definition: '', risk_level: 'HIGH', action: 'BLOCK', scope: 'ORG_WIDE', department_ids: [], enabled: true },
  });
  const { register, watch, setValue, formState } = form;
  const kind = watch('kind');
  const scope = watch('scope');
  const enabled = watch('enabled');
  const selected = watch('department_ids');
  const definition = watch('definition');

  const m = useMutation({
    mutationFn: (v: CustomRuleRequest) => (rule ? api.put(`/admin/rules/${rule.id}`, v) : api.post('/admin/rules', v)),
    onSuccess: () => {
      void invalidateAdmin(qc);
      onClose();
    },
  });

  // The server's verdict belongs to what was submitted: once the admin edits those fields it is stale.
  useEffect(() => {
    if (m.isError) m.reset();
  }, [definition, kind, selected]);

  /** Server-side validation messages for one field (keys like `rule.pattern_unsafe`). */
  const serverField = (field: string): string | undefined => {
    if (!(m.error instanceof ApiError)) return undefined;
    const key = m.error.details?.[field]?.[0];
    return key ? t(key, { defaultValue: t('validation.invalid') }) : undefined;
  };
  const defErr = formState.errors.definition?.message ?? serverField('definition');
  const depErr = formState.errors.department_ids?.message ?? serverField('department_ids');
  const generalError = m.isError && !serverField('definition') && !serverField('department_ids') ? apiErrorMessage(t, m.error) : null;

  const toggleDepartment = (id: string, on: boolean) =>
    setValue('department_ids', on ? [...selected, id] : selected.filter((d) => d !== id), { shouldValidate: formState.isSubmitted });

  return (
    <Modal open onClose={onClose} width={560} title={rule ? t('rules.editTitle') : t('rules.createTitle')}>
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((v) => m.mutate(v))} noValidate>
        <TextField label={t('rules.name')} maxLength={100} error={formState.errors.name?.message} {...register('name')} />

        <SelectField label={t('rules.kind')} {...register('kind')}>
          {RULE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`rules.kinds.${k}`)}
            </option>
          ))}
        </SelectField>

        <div className="field">
          <label htmlFor="rule-def">{t(`rules.definitionLabel.${kind}`)}</label>
          <textarea
            id="rule-def"
            rows={kind === 'PATTERN' ? 3 : 5}
            dir={kind === 'PATTERN' ? 'ltr' : undefined}
            style={kind === 'PATTERN' ? { fontFamily: 'var(--font-mono)' } : undefined}
            aria-invalid={defErr ? true : undefined}
            aria-describedby={defErr ? 'rule-def-err' : 'rule-def-hint'}
            {...register('definition')}
          />
          {!defErr && (
            <div id="rule-def-hint" className="hint">
              {t(`rules.definitionHint.${kind}`)}
            </div>
          )}
          {defErr && (
            <div id="rule-def-err" className="err" role="alert">
              {defErr}
            </div>
          )}
        </div>
        {kind === 'TOPIC' && (
          <div className="card px-3.5 py-3 text-[13px]" role="note" style={{ background: 'var(--risk-med-soft)', color: 'var(--risk-med)' }}>
            {t('rules.topicWarning')}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('logs.risk')} {...register('risk_level')}>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {t(`risk.${r}`)}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('rules.actionLabel')} {...register('action')}>
            {POLICY_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`policyAction.${a}`)}
              </option>
            ))}
          </SelectField>
        </div>

        <SelectField
          label={t('rules.scope')}
          {...register('scope', {
            onChange: (e) => {
              if (e.target.value === 'ORG_WIDE') setValue('department_ids', []);
            },
          })}
        >
          {RULE_SCOPES.map((s) => (
            <option key={s} value={s}>
              {t(`rules.scopes.${s}`)}
            </option>
          ))}
        </SelectField>

        {scope === 'DEPARTMENTS' && (
          <fieldset className="m-0 border-0 p-0" aria-describedby={depErr ? 'rule-dep-err' : undefined}>
            <legend className="mb-1.5 p-0 text-[12.5px] font-medium text-ink-2">{t('rules.departmentsLabel')}</legend>
            <div className="flex max-h-40 flex-col gap-1.5 overflow-auto rounded-lg border border-line p-3">
              {(departments.data?.items ?? []).map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-[13.5px]">
                  <input type="checkbox" checked={selected.includes(d.id)} onChange={(e) => toggleDepartment(d.id, e.target.checked)} />
                  {d.name}
                  {!d.active && <span className="text-ink-4">({t('status.DEACTIVATED')})</span>}
                </label>
              ))}
            </div>
            {depErr && (
              <div id="rule-dep-err" className="err" role="alert">
                {depErr}
              </div>
            )}
          </fieldset>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] text-ink-2" id="rule-enabled-label">
            {t('rules.enabledLabel')}
          </span>
          <Toggle checked={enabled} onChange={(v) => setValue('enabled', v)} label={t('rules.enabledLabel')} />
        </div>

        {generalError && (
          <div className="err" role="alert">
            {generalError}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('app.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={m.isPending} loadingLabel={t('rules.saving')}>
            {t('app.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
