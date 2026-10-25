import { SetMetadata } from '@nestjs/common';
import type { Capability } from '@hares/contract';

export const CAPABILITY_KEY = 'hares:capability';

/**
 * Require a capability from the matrix (contract/src/capabilities.ts). The
 * RolesGuard returns 403 when the caller's role has DENY for it. A SCOPED grant
 * passes the guard; the service then limits the query to the caller's
 * department (read from the guard-loaded user row, never a token claim).
 */
export const RequireCapability = (capability: Capability) => SetMetadata(CAPABILITY_KEY, capability);
