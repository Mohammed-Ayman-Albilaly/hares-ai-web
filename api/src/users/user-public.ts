import type { UserPublic } from '@hares/contract';

/** The account fields needed to build the public view. */
export interface UserPublicSource {
  id: string;
  fullName: string;
  email: string;
  status: UserPublic['status'];
  role: UserPublic['role'];
  departmentId: string | null;
}

/** Map a User row to the snake_case public view (no hash, no token_version). */
export function toUserPublic(u: UserPublicSource): UserPublic {
  return {
    id: u.id,
    full_name: u.fullName,
    email: u.email,
    status: u.status,
    role: u.role,
    department_id: u.departmentId,
  };
}

/** Prisma `select` that loads exactly the public fields. */
export const USER_PUBLIC_SELECT = {
  id: true,
  fullName: true,
  email: true,
  status: true,
  role: true,
  departmentId: true,
} as const;
