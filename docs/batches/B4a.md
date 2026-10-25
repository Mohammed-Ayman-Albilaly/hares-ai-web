## B4a — Web auth (register, login, logout, refresh)
**Goal:** Core web session flows.
**Delivers:** register (→PENDING), login, logout, `/auth/refresh` (HTTP-only cookie), bcrypt hashing (cost 12), `JwtAuthGuard` (signature + expiry + `status` + `token_version`), 15-min access JWT + 30-day refresh cookie. (Contract schemas: `RegisterRequest/Response`, `LoginRequest/Response`, `RefreshRequest/Response`, `LogoutRequest`, `TokenPair`, `UserPublic`, `UserStatus`.)
**Depends on:** B3.
**Verify:** `pnpm --filter api test` (register→PENDING, login, logout clears cookie, refresh rotates, guard rejects non-ACTIVE/revoked).
**Expected files:** `api/src/auth/**`, `api/src/users/*mock*` (minimal), `api/src/common/guards/*.guard.ts`, `contract/src/**`, `api/package.json`.