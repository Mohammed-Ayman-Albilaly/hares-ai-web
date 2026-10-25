import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { FullPageLoading } from '@/components/FullPageLoading';
import { AppLayout } from '@/layouts/AppLayout';
import { LandingPage } from '@/pages/LandingPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { NotFoundPage } from '@/pages/errors/NotFoundPage';
import { RouteError } from '@/pages/errors/RouteError';
import { GuestOnly, RequireAuth, RequireRole } from './guards';

/**
 * A screen loaded on first visit. The public pages and the shell load with the
 * app; role screens (and with them the chart library) are separate files, so a
 * visitor only downloads the screens their role can open.
 */
const screen = <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load())[name] as React.ComponentType }),
});

/**
 * Route map (ARCHITECTURE "Route map (per role)"). Public pages first, then the
 * authenticated shell; the guards decide what each role may open and the API
 * enforces the same rules independently.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <RequireAuth />,
    HydrateFallback: FullPageLoading,
    ErrorBoundary: RouteError,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/profile', ...screen(() => import('@/pages/ProfilePage'), 'ProfilePage') },
          {
            element: <RequireRole roles={['USER', 'DEPARTMENT_ADMIN']} />,
            children: [{ path: '/dashboard', ...screen(() => import('@/pages/dashboard/DashboardRoute'), 'DashboardRoute') }],
          },
          {
            element: <RequireRole roles={['DEPARTMENT_ADMIN']} />,
            children: [
              { path: '/department/logs', ...screen(() => import('@/pages/department/DepartmentPages'), 'DepartmentLogsPage') },
              { path: '/department/users', ...screen(() => import('@/pages/department/DepartmentPages'), 'DepartmentUsersPage') },
              { path: '/department/policy', ...screen(() => import('@/pages/department/DepartmentPages'), 'DepartmentPolicyPage') },
              { path: '/department/rules', ...screen(() => import('@/pages/department/DepartmentPages'), 'DepartmentRulesPage') },
            ],
          },
          {
            element: <RequireRole roles={['USER']} />,
            children: [
              { path: '/activity', ...screen(() => import('@/pages/activity/ActivityPage'), 'ActivityPage') },
              { path: '/blocked', ...screen(() => import('@/pages/blocked/BlockedPage'), 'BlockedPage') },
            ],
          },
          {
            element: <RequireRole roles={['SYSTEM_ADMIN']} />,
            children: [
              { path: '/admin/dashboard', ...screen(() => import('@/pages/admin/AdminOverviewPages'), 'AdminDashboardPage') },
              { path: '/admin/logs', ...screen(() => import('@/pages/admin/AdminOverviewPages'), 'AdminLogsPage') },
              { path: '/admin/pending', ...screen(() => import('@/pages/admin/AdminUsersPages'), 'AdminPendingPage') },
              { path: '/admin/users', ...screen(() => import('@/pages/admin/AdminUsersPages'), 'AdminUsersPage') },
              { path: '/admin/departments', ...screen(() => import('@/pages/admin/AdminDepartmentsPage'), 'AdminDepartmentsPage') },
              { path: '/admin/policy', ...screen(() => import('@/pages/admin/AdminPolicyPage'), 'AdminPolicyPage') },
              { path: '/admin/rules', ...screen(() => import('@/pages/admin/AdminRulesPage'), 'AdminRulesPage') },
              { path: '/admin/audit', ...screen(() => import('@/pages/admin/AdminAuditPage'), 'AdminAuditPage') },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export const createAppRouter = () => createBrowserRouter(routes);
export const createTestRouter = (initialEntries: string[]) => createMemoryRouter(routes, { initialEntries });
