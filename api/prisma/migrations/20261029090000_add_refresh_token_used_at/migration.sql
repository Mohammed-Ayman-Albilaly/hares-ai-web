-- When a refresh token was exchanged. The extension's service worker can be stopped
-- between the server rotating a token and the client saving the new one, so a short
-- grace window (see RefreshTokenService) accepts the just-replaced token once more.
ALTER TABLE "RefreshToken" ADD COLUMN "used_at" timestamptz;
