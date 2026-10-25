import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { AppLayout } from '@/layouts/AppLayout';
import { LandingPage } from '@/pages/LandingPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { HomePlaceholder } from '@/pages/HomePlaceholder';
import { ActivityPage } from '@/pages/activity/ActivityPage';
import { BlockedPage } from '@/pages/blocked/BlockedPage';
import { UserDashboardPage } from '@/pages/dashboard/UserDashboardPage';
import {
  DepartmentDashboardPage,
  DepartmentLogsPage,
  DepartmentPolicyPage,
  DepartmentRulesPage,
  DepartmentUsersPage,
} from '@/pages/department/DepartmentPages';
import { useAuth } from '@/auth/AuthProvider';
import { NotFoundPage } from '@/pages/errors/NotFoundPage';
import { GuestOnly, RequireAuth, RequireRole } from './guards';

/**
 * Route map (ARCHITECTURE "Route map (per role)"). Public pages first, then the
 * authenticated shell. Role screens are added by batches B12 to B14 under the
 * guards below; the API enforces the same rules independently.
 */
/** `/dashboard` is the personal dashboard for a user and the department dashboard for a Department Admin. */
function DashboardRoute() {
  const auth = useAuth();
  return auth.user?.role === 'DEPARTMENT_ADMIN' ? <DepartmentDashboardPage /> : <UserDashboardPage />;
}

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
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/profile', element: <ProfilePage /> },
          {
            element: <RequireRole roles={['USER', 'DEPARTMENT_ADMIN']} />,
            children: [{ path: '/dashboard', element: <DashboardRoute /> }],
          },
          {
            element: <RequireRole roles={['DEPARTMENT_ADMIN']} />,
            children: [
              { path: '/department/logs', element: <DepartmentLogsPage /> },
              { path: '/department/users', element: <DepartmentUsersPage /> },
              { path: '/department/policy', element: <DepartmentPolicyPage /> },
              { path: '/department/rules', element: <DepartmentRulesPage /> },
            ],
          },
          {
            element: <RequireRole roles={['USER']} />,
            children: [
              { path: '/activity', element: <ActivityPage /> },
              { path: '/blocked', element: <BlockedPage /> },
            ],
          },
          {
            element: <RequireRole roles={['SYSTEM_ADMIN']} />,
            children: [{ path: '/admin/dashboard', element: <HomePlaceholder titleKey="nav.adminDashboard" /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export const createAppRouter = () => createBrowserRouter(routes);
export const createTestRouter = (initialEntries: string[]) => createMemoryRouter(routes, { initialEntries });
