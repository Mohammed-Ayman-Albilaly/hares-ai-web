## B4b — Extension auth + rotation/reuse detection
**Goal:** Extension token lifecycle.
**Delivers:** `/extension/login`, `/extension/refresh`, `/extension/logout`, refresh rotation + reuse-detection family revocation, hashed refresh store (family id + used flag), `ExtensionGuard` (`client_type=extension`), web tokens cannot call extension endpoints. (Contract schemas: `ExtensionLogin/Refresh/LogoutRequest/Response`, `ClientType`.)
**Depends on:** B4a.
**Verify:** `pnpm --filter api test` (rotate on each use; reuse revokes whole family → 401; web token vs extension endpoint denied).
**Expected files:** `api/src/auth/extension/**`, `api/src/auth/*token-store*`, `api/src/common/guards/extension.guard.ts`, `contract/src/**`, `api/package.json`.