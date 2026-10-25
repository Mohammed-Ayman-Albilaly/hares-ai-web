import type { Role } from '@hares/contract';

/** Where each role lands after signing in (WEB-FR-003: the dashboard matching their role). */
export function homeFor(role: Role | null): string {
  return role === 'SYSTEM_ADMIN' ? '/admin/dashboard' : '/dashboard';
}

export type IconName =
  | 'Dashboard'
  | 'Activity'
  | 'Block'
  | 'Logs'
  | 'Users'
  | 'Roles'
  | 'Departments'
  | 'Settings'
  | 'Shield'
  | 'User'
  | 'Check'
  | 'Edit';

export interface NavItem {
  to: string;
  /** i18n key under `nav.` */
  label: string;
  icon: IconName;
  /** Roles that see this item. */
  roles: readonly Role[];
  /** Sidebar group (i18n key under `navGroup.`). */
  group: 'personal' | 'department' | 'organization' | 'account';
}

/**
 * Sidebar items per role (route map, ARCHITECTURE section 6). The API enforces
 * the same rules; hiding an item is only a convenience (WEB-NFR-003).
 */
export const NAV: readonly NavItem[] = [
  { to: '/dashboard', label: 'dashboard', icon: 'Dashboard', roles: ['USER'], group: 'personal' },
  { to: '/dashboard', label: 'deptDashboard', icon: 'Dashboard', roles: ['DEPARTMENT_ADMIN'], group: 'department' },
  { to: '/activity', label: 'activity', icon: 'Activity', roles: ['USER'], group: 'personal' },
  { to: '/blocked', label: 'blocked', icon: 'Block', roles: ['USER'], group: 'personal' },
  { to: '/profile', label: 'profile', icon: 'User', roles: ['USER', 'DEPARTMENT_ADMIN', 'SYSTEM_ADMIN'], group: 'account' },
  { to: '/department/logs', label: 'deptLogs', icon: 'Logs', roles: ['DEPARTMENT_ADMIN'], group: 'department' },
  { to: '/department/users', label: 'deptUsers', icon: 'Users', roles: ['DEPARTMENT_ADMIN'], group: 'department' },
  { to: '/department/policy', label: 'deptPolicy', icon: 'Shield', roles: ['DEPARTMENT_ADMIN'], group: 'department' },
  { to: '/department/rules', label: 'deptRules', icon: 'Settings', roles: ['DEPARTMENT_ADMIN'], group: 'department' },
  { to: '/admin/dashboard', label: 'adminDashboard', icon: 'Dashboard', roles: ['SYSTEM_ADMIN'], group: 'organization' },
  { to: '/admin/logs', label: 'adminLogs', icon: 'Logs', roles: ['SYSTEM_ADMIN'], group: 'organization' },
  { to: '/admin/pending', label: 'adminPending', icon: 'Check', roles: ['SYSTEM_ADMIN'], group: 'organization' },
  { to: '/admin/users', label: 'adminUsers', icon: 'Users', roles: ['SYSTEM_ADMIN'], group: 'organization' },
  { to: '/admin/departments', label: 'adminDepartments', icon: 'Departments', roles: ['SYSTEM_ADMIN'], group: 'organization' },
  { to: '/admin/policy', label: 'adminPolicy', icon: 'Shield', roles: ['SYSTEM_ADMIN'], group: 'organization' },
  { to: '/admin/rules', label: 'adminRules', icon: 'Settings', roles: ['SYSTEM_ADMIN'], group: 'organization' },
  { to: '/admin/audit', label: 'adminAudit', icon: 'Roles', roles: ['SYSTEM_ADMIN'], group: 'organization' },
];

export const navFor = (role: Role | null): NavItem[] => NAV.filter((i) => role && i.roles.includes(role));
