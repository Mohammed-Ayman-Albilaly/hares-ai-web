import { useAuth } from '@/auth/AuthProvider';
import { DepartmentDashboardPage } from '@/pages/department/DepartmentPages';
import { UserDashboardPage } from './UserDashboardPage';

/** `/dashboard` is the personal dashboard for a user and the department dashboard for a Department Admin. */
export function DashboardRoute() {
  const auth = useAuth();
  return auth.user?.role === 'DEPARTMENT_ADMIN' ? <DepartmentDashboardPage /> : <UserDashboardPage />;
}
