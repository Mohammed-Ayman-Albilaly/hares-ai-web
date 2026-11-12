import type { UserPublic } from '@hares/contract';
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { navFor, type IconName } from '@/auth/routes';
import { Wordmark } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/layout';
import { IconButton } from '@/components/ui/IconButton';
import { RoleBadge } from '@/components/ui/badges';
import { I } from '@/components/ui/icons';

const ICONS: Record<IconName, (typeof I)[keyof typeof I]> = {
  Dashboard: I.Dashboard,
  Activity: I.Activity,
  Block: I.Block,
  Logs: I.Logs,
  Users: I.Users,
  Roles: I.Roles,
  Departments: I.Departments,
  Settings: I.Settings,
  Shield: I.Shield,
  User: I.User,
  Check: I.Check,
  Edit: I.Edit,
};

const GROUP_ORDER = ['personal', 'department', 'organization', 'account'] as const;

/**
 * Sidebar navigation, filtered by role (a convenience: the API enforces access).
 * `onClose` is passed by the phone drawer only: it adds a visible close button,
 * because a dialog that closes only with Escape hides a control from sighted users.
 */
export function Sidebar({
  user,
  onNavigate,
  onClose,
  className = 'desktop-only',
}: {
  user: UserPublic;
  onNavigate?: () => void;
  onClose?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const items = navFor(user.role);
  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar-brand">
        <Wordmark />
        {onClose && (
          <IconButton label={t('app.close')} onClick={onClose} className="-me-2">
            <I.X size={18} />
          </IconButton>
        )}
      </div>
      <nav aria-label={t('app.mainNavigation')} className="flex flex-1 flex-col gap-3">
        {GROUP_ORDER.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group}>
              <div className="nav-section-label">{t(`navGroup.${group}`)}</div>
              <ul className="nav-list">
                {groupItems.map((it) => {
                  const Icon = ICONS[it.icon];
                  return (
                    <li key={it.to}>
                      <NavLink to={it.to} className="nav-link" onClick={onNavigate} end>
                        <Icon size={16} />
                        <span>{t(`nav.${it.label}`)}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="sidebar-user">
        <Avatar name={user.full_name} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-ink">{user.full_name}</div>
          <div className="truncate text-[11.5px] text-ink-4" dir="ltr" style={{ textAlign: 'start' }}>
            {user.email}
          </div>
          {user.role && (
            <div className="mt-1.5">
              <RoleBadge role={user.role} />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
