import * as Menu from '@radix-ui/react-dropdown-menu';
import type { UserPublic } from '@hares/contract';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/auth/AuthProvider';
import { Avatar } from '@/components/ui/layout';
import { I } from '@/components/ui/icons';

/** Avatar menu in the top bar: profile and sign out. */
export function UserMenu({ user }: { user: UserPublic }) {
  const { t } = useTranslation();
  const session = useSession();
  const navigate = useNavigate();
  const first = user.full_name.split(/\s+/)[0];

  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex items-center gap-2 rounded-full border border-line bg-transparent py-1 pe-2.5 ps-1 hover:bg-surface-2"
        aria-label={user.full_name}
      >
        <Avatar name={user.full_name} size={26} />
        <span className="hidden text-[12.5px] font-medium text-ink-2 sm:inline">{first}</span>
        <I.Chevron size={14} className="text-ink-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={8}
          className="card z-50 min-w-48 p-1.5"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <div className="text-[13px] font-medium text-ink">{user.full_name}</div>
            <div className="text-[11.5px] text-ink-4" dir="ltr" style={{ textAlign: 'start' }}>
              {user.email}
            </div>
          </div>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-surface-3"
            onSelect={() => navigate('/profile')}
          >
            <I.User size={15} /> {t('nav.profile')}
          </Menu.Item>
          <Menu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-surface-3"
            onSelect={() => {
              void session.logout().then(() => navigate('/login', { replace: true }));
            }}
          >
            <I.Logout size={15} /> {t('nav.logout')}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
