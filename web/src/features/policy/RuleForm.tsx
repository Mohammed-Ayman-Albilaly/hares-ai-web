import {
  CustomRuleRequestSchema,
  POLICY_ACTIONS,
  RISK_LEVELS,
  RULE_KINDS,
  RULE_SCOPES,
  TOPIC_ACTIONS,
  TOPIC_DEFINITION_EN_MAX_LENGTH,
  TOPIC_SENSITIVITY,
  TOPIC_THRESHOLD_DEFAULT,
  type CustomRuleRequest,
  type CustomRuleResponse,
  type TopicSensitivity,
} from '@hares/contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Checkbox } from '@/components/ui/Checkbox';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { Textarea } from '@/components/ui/Textarea';
import { Toggle } from '@/components/ui/Toggle';
import { invalidateAdmin } from '@/features/common/invalidate';
import { useDepartments } from '@/features/common/useDepartments';
import { api, ApiError } from '@/lib/api';
import { apiErrorMessage } from '@/lib/errors';
import { zodResolver } from '@/lib/form';

/**
 * Create or edit a detection rule (WEB-FR-042..044). The same Zod schema the API
 * uses checks the form; the API additionally proves a PATTERN safe (ReDoS), and
 * its answer is shown under the definition. A TOPIC rule also has an English
 * description (what the extension's on-device model reads), a sensitivity stored as
 * a threshold, and no BLOCK action (decision 66); the form warns not to put real
 * secrets in either description.
 */
const SENSITIVITY_LEVELS = Object.keys(TOPIC_SENSITIVITY) as TopicSensitivity[];
const isTopicAction = (a: string) => (TOPIC_ACTIONS as readonly string[]).includes(a);
export function RuleForm({
  rule,
  onClose,
  fixedDepartmentId,
}: {
  rule: CustomRuleResponse | null;
  onClose: () => void;
  /** A Department Admin writes rules for their own department only: scope and departments are not offered. */
  fixedDepartmentId?: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const departments = useDepartments(!fixedDepartmentId); // a Department Admin may not list departments and does not need to
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
          definition_en: rule.definition_en ?? '',
          threshold: rule.threshold ?? TOPIC_THRESHOLD_DEFAULT,
        }
      : {
          name: '',
          kind: 'KEYWORD',
          definition: '',
          risk_level: 'HIGH',
          action: 'BLOCK',
          scope: fixedDepartmentId ? 'DEPARTMENTS' : 'ORG_WIDE',
          department_ids: fixedDepartmentId ? [fixedDepartmentId] : [],
          enabled: true,
          definition_en: '',
          threshold: TOPIC_THRESHOLD_DEFAULT,
        },
  });
  const { register, watch, setValue, formState } = form;
  const kind = watch('kind');
  const scope = watch('scope');
  const enabled = watch('enabled');
  const selected = watch('department_ids');
  const definition = watch('definition');
  const definitionEn = watch('definition_en');
  const threshold = watch('threshold');
  const action = watch('action');
  const isTopic = kind === 'TOPIC';
  // A stored threshold that is not one of the three levels (set through the API) stays selectable as it is.
  const customThreshold =
    threshold != null && !Object.values(TOPIC_SENSITIVITY).some((v) => v === threshold) ? threshold : null;
  const level = SENSITIVITY_LEVELS.find((l) => TOPIC_SENSITIVITY[l] === threshold);

  // A TOPIC rule never blocks: switching to TOPIC moves BLOCK to WARN, the recommended action.
  useEffect(() => {
    if (isTopic && !isTopicAction(action)) setValue('action', 'WARN');
  }, [isTopic]);

  const m = useMutation({
    mutationFn: (v: CustomRuleRequest) => {
      const body = fixedDepartmentId ? { ...v, scope: 'DEPARTMENTS' as const, department_ids: [fixedDepartmentId] } : v;
      return rule ? api.put(`/admin/rules/${rule.id}`, body) : api.post('/admin/rules', body);
    },
    onSuccess: () => {
      void invalidateAdmin(qc);
      onClose();
    },
  });

  // The server's verdict belongs to what was submitted: once the admin edits those fields it is stale.
  useEffect(() => {
    if (m.isError) m.reset();
  }, [definition, definitionEn, threshold, action, enabled, kind, selected]);

  /** Server-side validation messages for one field (keys like `rule.pattern_unsafe`). */
  const serverField = (field: string): string | undefined => {
    if (!(m.error instanceof ApiError)) return undefined;
    const key = m.error.details?.[field]?.[0];
    return key ? t(key, { defaultValue: t('validation.invalid') }) : undefined;
  };
  const defErr = formState.errors.definition?.message ?? serverField('definition');
  const depErr = formState.errors.department_ids?.message ?? serverField('department_ids');
  const enErr = formState.errors.definition_en?.message ?? serverField('definition_en');
  const thresholdErr = formState.errors.threshold?.message ?? serverField('threshold');
  const actionErr = formState.errors.action?.message ?? serverField('action');
  const enabledErr = serverField('enabled'); // rule.topic_limit
  const fieldKeys = ['definition', 'department_ids', 'definition_en', 'threshold', 'action', 'enabled'];
  const generalError = m.isError && !fieldKeys.some((f) => serverField(f)) ? apiErrorMessage(t, m.error) : null;

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

        <Textarea
          id="rule-def"
          label={t(`rules.definitionLabel.${kind}`)}
          rows={kind === 'PATTERN' ? 3 : 5}
          dir={kind === 'PATTERN' ? 'ltr' : undefined}
          style={kind === 'PATTERN' ? { fontFamily: 'var(--font-mono)' } : undefined}
          error={defErr}
          hint={t(`rules.definitionHint.${kind}`)}
          {...register('definition')}
        />
        {isTopic && (
          <>
            <Textarea
              id="rule-def-en"
              label={t('rules.definitionEnLabel')}
              rows={3}
              dir="ltr"
              lang="en"
              maxLength={TOPIC_DEFINITION_EN_MAX_LENGTH}
              error={enErr}
              hint={t('rules.definitionEnHint')}
              {...register('definition_en')}
            />
            <div className="field">
              <SelectField
                label={t('rules.sensitivity')}
                aria-describedby="rule-sensitivity-hint"
                {...register('threshold', { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) })}
              >
                {SENSITIVITY_LEVELS.map((l) => (
                  <option key={l} value={TOPIC_SENSITIVITY[l]}>
                    {t(`rules.sensitivityLevels.${l}`)}
                  </option>
                ))}
                {customThreshold != null && (
                  <option value={customThreshold}>{t('rules.sensitivityCustom', { value: customThreshold })}</option>
                )}
              </SelectField>
              <div id="rule-sensitivity-hint" className={thresholdErr ? 'err' : 'hint'} role={thresholdErr ? 'alert' : undefined}>
                {thresholdErr ?? (level ? t(`rules.sensitivityHints.${level}`) : null)}
              </div>
            </div>
            <div className="card px-3.5 py-3 text-[13px]" role="note" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
              {t('rules.topicWarning')} {t('rules.topicModelNote')}
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('logs.risk')} {...register('risk_level')}>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {t(`risk.${r}`)}
              </option>
            ))}
          </SelectField>
          <div className="field">
            <SelectField
              label={t('rules.actionLabel')}
              aria-describedby={isTopic || actionErr ? 'rule-action-hint' : undefined}
              {...register('action')}
            >
              {POLICY_ACTIONS.filter((a) => !isTopic || isTopicAction(a)).map((a) => (
                <option key={a} value={a}>
                  {t(`policyAction.${a}`)}
                </option>
              ))}
            </SelectField>
            {(isTopic || actionErr) && (
              <div id="rule-action-hint" className={actionErr ? 'err' : 'hint'} role={actionErr ? 'alert' : undefined}>
                {actionErr ?? t('rules.topicActionHint')}
              </div>
            )}
          </div>
        </div>

        {!fixedDepartmentId && (
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
        )}

        {!fixedDepartmentId && scope === 'DEPARTMENTS' && (
          <fieldset className="m-0 border-0 p-0" aria-describedby={depErr ? 'rule-dep-err' : undefined}>
            <legend className="mb-1.5 p-0 text-[12.5px] font-medium text-ink-2">{t('rules.departmentsLabel')}</legend>
            <div className="flex max-h-40 flex-col gap-1.5 overflow-auto rounded-lg border border-line p-3">
              {(departments.data?.items ?? []).map((d) => (
                <Checkbox
                  key={d.id}
                  label={
                    <>
                      {d.name}
                      {!d.active && <span className="text-ink-4"> ({t('status.DEACTIVATED')})</span>}
                    </>
                  }
                  checked={selected.includes(d.id)}
                  onChange={(e) => toggleDepartment(d.id, e.target.checked)}
                />
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
        {enabledErr && (
          <div className="err" role="alert">
            {enabledErr}
          </div>
        )}

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
