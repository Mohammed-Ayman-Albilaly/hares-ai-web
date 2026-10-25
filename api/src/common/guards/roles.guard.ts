import { ForbiddenException, Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { OWN_DATA_CAPABILITIES, grantFor, type Capability, type Grant } from '@hares/contract';
import type { AuthUser } from '../auth-user';
import { CLIENT_KIND_KEY, IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { CAPABILITY_KEY } from '../decorators/roles.decorator';

const deny = () =>
  new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have permission for this action.' });

/** What a guarded handler can read about the caller's grant. */
export interface CapabilityContext {
  capability: Capability;
  grant: Exclude<Grant, 'DENY'>;
}

/**
 * Global RBAC guard (runs after JwtAuthGuard). For a route marked with
 * @RequireCapability it looks up the caller's role in the capability matrix
 * and refuses DENY with 403 FORBIDDEN (WEB-NFR-003). The grant (ALLOW or
 * SCOPED) is attached to the request so services can apply the scope.
 *
 * Fail closed: a non-public web route WITHOUT a capability is refused (403),
 * so a future route that forgets @RequireCapability can never ship open to
 * every role. Public routes and extension-token routes (ExtensionGuard) are
 * exempt.
 *
 * A department-scoped grant (Department Admin) also needs a department on the
 * caller; without one it is refused, so a service can never build an unscoped
 * query from a null department.
 *
 * Hard rules (no self-deactivation, Department Admin cannot touch admins) are
 * enforced again in the services, not only here.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const capability = this.reflector.getAllAndOverride<Capability | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!capability) {
      const targets = [context.getHandler(), context.getClass()];
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) === true;
      const client = this.reflector.getAllAndOverride<string>(CLIENT_KIND_KEY, targets) ?? 'web';
      if (isPublic || client !== 'web') return true;
      throw deny();
    }

    const req = context
      .switchToHttp()
      .getRequest<Request & { authUser?: AuthUser; capability?: CapabilityContext }>();
    const user = req.authUser;
    // Web routes only: an extension token never carries web capabilities.
    const grant = user && user.client === 'web' ? grantFor(capability, user.role) : 'DENY';
    if (grant === 'DENY') throw deny();
    if (
      grant === 'SCOPED' &&
      !OWN_DATA_CAPABILITIES.includes(capability) &&
      user?.role === 'DEPARTMENT_ADMIN' &&
      !user.departmentId
    ) {
      throw deny();
    }
    req.capability = { capability, grant };
    return true;
  }
}
