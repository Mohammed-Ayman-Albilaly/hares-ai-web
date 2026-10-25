import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Capability } from '@hares/contract';
import type { AuthUser } from '../auth-user';
import { CLIENT_KIND_KEY, IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { CAPABILITY_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

// Unit tests of the guard's fail-closed rules (no database needed).

function ctx(meta: { capability?: Capability; isPublic?: boolean; client?: string }, user?: Partial<AuthUser>) {
  const handler = () => undefined;
  class Ctrl {}
  Reflect.defineMetadata(CAPABILITY_KEY, meta.capability, handler);
  Reflect.defineMetadata(IS_PUBLIC_KEY, meta.isPublic, handler);
  Reflect.defineMetadata(CLIENT_KIND_KEY, meta.client, handler);
  const req: { authUser?: Partial<AuthUser> } = { authUser: user };
  return {
    getHandler: () => handler,
    getClass: () => Ctrl,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const guard = new RolesGuard(new Reflector());
const web = (role: AuthUser['role'], departmentId: string | null = null): Partial<AuthUser> => ({
  id: 'u',
  role,
  departmentId,
  client: 'web',
  status: 'ACTIVE',
});

describe('RolesGuard (fail closed)', () => {
  it('refuses a non-public web route that has no capability', () => {
    expect(() => guard.canActivate(ctx({}, web('SYSTEM_ADMIN')))).toThrow();
  });

  it('lets public routes and extension-client routes through without a capability', () => {
    expect(guard.canActivate(ctx({ isPublic: true }))).toBe(true);
    expect(guard.canActivate(ctx({ client: 'extension' }, { id: 'u', client: 'extension' }))).toBe(true);
  });

  it('refuses a department-scoped capability for a Department Admin without a department', () => {
    expect(() => guard.canActivate(ctx({ capability: 'USERS_LIST' }, web('DEPARTMENT_ADMIN', null)))).toThrow();
    expect(guard.canActivate(ctx({ capability: 'USERS_LIST' }, web('DEPARTMENT_ADMIN', 'd1')))).toBe(true);
  });

  it('own-data capabilities do not need a department (a System Admin has none)', () => {
    expect(guard.canActivate(ctx({ capability: 'PROFILE_VIEW' }, web('SYSTEM_ADMIN', null)))).toBe(true);
  });

  it('refuses a capability route when nobody is authenticated or the token is not a web token', () => {
    expect(() => guard.canActivate(ctx({ capability: 'PROFILE_VIEW' }))).toThrow();
    expect(() =>
      guard.canActivate(ctx({ capability: 'PROFILE_VIEW' }, { ...web('SYSTEM_ADMIN'), client: 'extension' })),
    ).toThrow();
  });
});
