import type { UserPublic } from '@hares/contract';
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { navFor, type IconName } from '@/auth/routes';
import { Wordmark } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/layout';
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

/** Sidebar navigation, filtered by role (a convenience: the API enforces access). */
export function Sidebar({ user, onNavigate, className = 'desktop-only' }: { user: UserPublic; onNavigate?: () => void; className?: string }) {
  const { t } = useTranslation();
  const items = navFor(user.role);
  return (
    <aside className={`sidebar ${className}`}>
      <div className="mb-3.5 border-b border-line px-2 pb-[18px] pt-1">
        <Wordmark />
      </div>
      <nav aria-label={t('app.mainNavigation')} className="flex flex-1 flex-col gap-1">
        {GROUP_ORDER.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-1">
              <div className="nav-section-label">{t(`navGroup.${group}`)}</div>
              {groupItems.map((it) => {
                const Icon = ICONS[it.icon];
                return (
                  <NavLink key={it.to} to={it.to} className="nav-link" onClick={onNavigate} end>
                    <Icon size={16} />
                    <span>{t(`nav.${it.label}`)}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="mt-2 flex items-center gap-2.5 border-t border-line px-2 pb-1 pt-3">
        <Avatar name={user.full_name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-ink">{user.full_name}</div>
          <div className="truncate text-[11.5px] text-ink-4" dir="ltr" style={{ textAlign: 'start' }}>
            {user.email}
          </div>
        </div>
      </div>
    </aside>
  );
}
