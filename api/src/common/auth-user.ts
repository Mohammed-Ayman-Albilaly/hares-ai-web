import type { Role, UserStatus } from '@hares/contract';
import type { ClientKind } from '../auth/auth.constants';

/**
 * The caller, as loaded from the database by the JwtAuthGuard on every request.
 * Role and department come from the User row, never from token claims.
 */
export interface AuthUser {
  id: string;
  status: UserStatus;
  role: Role | null;
  departmentId: string | null;
  client: ClientKind;
}
