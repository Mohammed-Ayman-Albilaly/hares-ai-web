import type { Role } from '@hares/contract';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { homeFor } from '@/auth/routes';
import { FullPageLoading } from '@/components/FullPageLoading';
import { ForbiddenPage } from '@/pages/errors/ForbiddenPage';

/**
 * Signed-in users only. While the silent refresh runs (page load) it shows a
 * loading screen instead of redirecting, so a reload never bounces a signed-in
 * user to the login page. Anonymous users go to /login and come back after.
 */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <FullPageLoading />;
  if (auth.status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (auth.user.status !== 'ACTIVE') return <Navigate to="/login" replace />;
  return <Outlet />;
}

/**
 * Role gate (WEB-FR-018). The API enforces the same rule on every endpoint
 * (defence in depth); this decides what the screen shows.
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children?: ReactNode }) {
  const auth = useAuth();
  if (auth.status !== 'authenticated') return null;
  if (!auth.user.role || !roles.includes(auth.user.role)) return <ForbiddenPage />;
  return <>{children ?? <Outlet />}</>;
}

/** Public pages for signed-out users (login, register): a signed-in user is sent to their home. */
export function GuestOnly() {
  const auth = useAuth();
  if (auth.status === 'loading') return <FullPageLoading />;
  if (auth.status === 'authenticated' && auth.user.status === 'ACTIVE') return <Navigate to={homeFor(auth.user.role)} replace />;
  return <Outlet />;
}
