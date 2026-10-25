import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { AppLayout } from '@/layouts/AppLayout';
import { LandingPage } from '@/pages/LandingPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { HomePlaceholder } from '@/pages/HomePlaceholder';
import { NotFoundPage } from '@/pages/errors/NotFoundPage';
import { GuestOnly, RequireAuth, RequireRole } from './guards';

/**
 * Route map (ARCHITECTURE "Route map (per role)"). Public pages first, then the
 * authenticated shell. Role screens are added by batches B12 to B14 under the
 * guards below; the API enforces the same rules independently.
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
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/profile', element: <ProfilePage /> },
          {
            element: <RequireRole roles={['USER', 'DEPARTMENT_ADMIN']} />,
            children: [{ path: '/dashboard', element: <HomePlaceholder titleKey="nav.dashboard" /> }],
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
