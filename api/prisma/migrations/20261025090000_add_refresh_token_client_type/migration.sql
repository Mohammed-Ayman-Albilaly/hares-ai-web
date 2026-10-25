-- Bind every refresh-token family to the client that created it, so a web
-- refresh cookie can never be redeemed on the extension endpoint and vice versa.
CREATE TYPE "client_type" AS ENUM ('WEB', 'EXTENSION');

ALTER TABLE "RefreshToken" ADD COLUMN "client_type" "client_type" NOT NULL DEFAULT 'WEB';
ALTER TABLE "RefreshToken" ALTER COLUMN "client_type" DROP DEFAULT;
