#!/bin/sh
# One-shot database setup for a deployment, in the required order
# (api/db/roles.sql and ops/revoke-audit-privileges.sql explain why):
#   1. migrations           2. application role + grants
#   3. audit trail lock     4. seed (categories, policy, bootstrap admin)
# Safe to run on every deploy: each step is idempotent.
#
# CAUTION: a PostgreSQL role is shared by the whole cluster, and db/roles.sql sets its password on
# every run. Two environments (or databases) on one cluster must use DIFFERENT application role
# names in their APP_DATABASE_URL, or running this for one resets the password of the other. The
# owner user also needs the CREATEROLE privilege (many managed services give it a restricted form:
# create the role once by hand and run only the grants).
#
# Needs DATABASE_URL (owner role) and APP_DATABASE_URL (the runtime role the API
# connects as). The role name and password are taken from APP_DATABASE_URL, so
# the two can never disagree.
set -eu
cd "$(dirname "$0")/.."
# prisma starts its seed command (tsx) by name: make the installed tools findable without pnpm.
export PATH="$PWD/node_modules/.bin:$PATH"

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${APP_DATABASE_URL:?APP_DATABASE_URL is required}"

APP_ROLE=$(node -e "console.log(decodeURIComponent(new URL(process.env.APP_DATABASE_URL).username))")
APP_PASSWORD=$(node -e "console.log(decodeURIComponent(new URL(process.env.APP_DATABASE_URL).password))")
if [ -z "$APP_ROLE" ] || [ -z "$APP_PASSWORD" ]; then
  echo "APP_DATABASE_URL must contain the runtime role and its password" >&2
  exit 1
fi

echo "[init] migrations"
./node_modules/.bin/prisma migrate deploy

# One transaction: the grants of roles.sql re-open UPDATE/DELETE on the audit table, and the revoke
# closes them again; no other session can ever see the table writable in between.
echo "[init] application role, grants and audit trail lock"
psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -v app_role="$APP_ROLE" -v app_password="$APP_PASSWORD" -f db/roles.sql -f ../ops/revoke-audit-privileges.sql >/dev/null

echo "[init] seed"
./node_modules/.bin/prisma db seed

echo "[init] done"
