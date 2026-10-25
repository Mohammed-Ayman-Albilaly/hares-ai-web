import type { LogAction, PolicyAction, RiskLevel, Role, UserDecision, UserStatus } from '@hares/contract';
import { useTranslation } from 'react-i18next';

const RISK_CLASS: Record<RiskLevel, string> = {
  HIGH: 'risk-high',
  MEDIUM: 'risk-med',
  LOW: 'risk-low',
  NONE: 'risk-none',
};

/**
 * Risk is never shown by colour alone (WCAG 1.4.1): a text label always comes
 * with the colour and a dot.
 */
export function RiskBadge({ level }: { level: RiskLevel }) {
  const { t } = useTranslation();
  return (
    <span className={`h-pill ${RISK_CLASS[level]}`}>
      <span className="dot" aria-hidden="true" />
      {t(`risk.${level}`)}
    </span>
  );
}

const ACTION_CLASS: Record<LogAction, string> = { BLOCKED: 'risk-high', WARNED: 'risk-med', ALLOWED: 'risk-none' };

export function ActionBadge({ action }: { action: LogAction }) {
  const { t } = useTranslation();
  return <span className={`h-pill ${ACTION_CLASS[action]}`}>{t(`action.${action}`)}</span>;
}

const POLICY_CLASS: Record<PolicyAction, string> = { BLOCK: 'risk-high', WARN: 'risk-med', ALLOW: 'risk-none' };

export function PolicyActionBadge({ action }: { action: PolicyAction }) {
  const { t } = useTranslation();
  return <span className={`h-pill ${POLICY_CLASS[action]}`}>{t(`policyAction.${action}`)}</span>;
}

export function DecisionBadge({ decision }: { decision: UserDecision }) {
  const { t } = useTranslation();
  const cls = decision === 'SUBMITTED_ANYWAY' ? 'risk-med' : decision === 'NONE' ? 'role-user' : 'risk-low';
  return <span className={`h-pill ${cls}`}>{t(`decision.${decision}`)}</span>;
}

const ROLE_CLASS: Record<Role, string> = {
  SYSTEM_ADMIN: 'role-sysadmin',
  DEPARTMENT_ADMIN: 'role-deptadmin',
  USER: 'role-user',
};

export function RoleBadge({ role }: { role: Role | null }) {
  const { t } = useTranslation();
  if (!role) return <span className="text-ink-4">—</span>;
  return <span className={`h-pill ${ROLE_CLASS[role]}`}>{t(`roles.${role}`)}</span>;
}

const STATUS_CLASS: Record<UserStatus, string> = {
  ACTIVE: 'status-active',
  PENDING: 'status-pending',
  REJECTED: 'status-inactive',
  DEACTIVATED: 'status-inactive',
};

export function StatusBadge({ status }: { status: UserStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`h-pill ${STATUS_CLASS[status]}`}>
      <span className="dot" aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}
