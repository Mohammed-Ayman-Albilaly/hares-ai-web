# Free deployment: Vercel + Render + Supabase

A no-cost alternative to the Docker/VPS stack in `docker-compose.prod.yml` (see `docs/audit.md`, section 5).

```
browser / extension ──► Vercel  (https://<project>.vercel.app)
                         ├─ the SPA (static files from web/dist)
                         └─ /api/*  ──rewrite──►  Render web service (Dockerfile.api)  ──►  Supabase PostgreSQL
```

The browser only ever sees the Vercel origin, like with the nginx proxy: the refresh cookie (`SameSite=Strict`,
path `/api/auth`) and the Origin check on the auth routes work unchanged.

| Part | Service | Notes |
|---|---|---|
| Web | Vercel (Hobby) | `web/vercel.json` |
| API | Render (free web service, Docker) | sleeps after 15 min idle, 512 MB, 750 h/month |
| Database | Supabase (free) | session pooler (IPv4); pauses after a week without activity |
| Mail | Brevo (free) or any SMTP | password-reset e-mails |
| Database setup | your own machine, Docker Desktop | Render's free plan has no pre-deploy command |

## 1. Supabase

1. New project, region close to the Render region (e.g. Frankfurt / `eu-central-1`). Keep the database password.
2. **Project Settings → Data API: turn the Data API off.** The app does not use it.
   (`ops/supabase-revoke-api-roles.sql` also revokes the `anon` / `authenticated` grants on every deploy.)
3. **Connect → Session pooler** (not "Direct": it is IPv6-only on the free plan; not "Transaction pooler").
   It looks like `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.

## 2. Database setup from your machine (once, and again after every new migration)

Copy `.env.prod.example` to `.env.prod` (never commit it) and set:

```
DATABASE_URL="postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
APP_DATABASE_URL="postgresql://hares_app.<ref>:<new-random-password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=verify-full"
INITIAL_ADMIN_NAME / INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD
```

- `APP_DATABASE_URL` ends in `sslmode=verify-full`: only Node reads it, and this keeps full certificate verification
  when node-postgres 9 gives `require` the weaker libpq meaning.
- `APP_DATABASE_URL` uses the **same pooler host** with the user `hares_app.<ref>`: the init script creates the role
  `hares_app` (the part before the dot) with that password.
- Passwords with special characters must be URL-encoded (`@` → `%40`, `#` → `%23`, `/` → `%2F`).

Also add this line to `.env.prod`:

```
NODE_EXTRA_CA_CERTS="/usr/local/share/ca-certificates/supabase-root-2021-ca.crt"
```

**Why: the TLS certificate of Supabase.** Supabase signs its server certificates with its own CA ("Supabase Root
2021 CA"), which Node does not trust. node-postgres (the seed and the API) verifies the certificate fully, so without
that CA it stops with `self-signed certificate in certificate chain`. The public root certificate is kept in
`ops/certs/supabase-root-2021-ca.crt` (downloaded from Database settings → SSL configuration; its SHA-256 fingerprint
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA` matched the root
the pooler presents) and copied into both images at the path above. `NODE_EXTRA_CA_CERTS` adds it to the CAs Node
trusts, so the connection stays encrypted **and** verified (the pooler certificate is issued for
`*.pooler.supabase.com`). psql and the Prisma migration engine encrypt with `sslmode=require` as before.

Then, from the repository root:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm --build migrate
```

It ends with `[init] done` and, the first time, `Bootstrap SYSTEM_ADMIN created for ...`.

## 3. Render (the API)

New → **Web Service** → connect the repository (branch of your choice).

| Setting | Value |
|---|---|
| Language / Runtime | Docker |
| Dockerfile path | `./Dockerfile.api` |
| Docker build context | `.` (repository root) |
| Instance type | Free |
| Health check path | `/api/health` |

Environment variables (**not** `DATABASE_URL` nor the `INITIAL_ADMIN_*` values: the API never needs them):

| Key | Value |
|---|---|
| `APP_DATABASE_URL` | the same value as in `.env.prod` |
| `NODE_EXTRA_CA_CERTS` | `/usr/local/share/ca-certificates/supabase-root-2021-ca.crt` |
| `JWT_ACCESS_SECRET` | 32+ random characters (`openssl rand -base64 48`) |
| `WEB_BASE_URL` | `https://<project>.vercel.app` |
| `CORS_ORIGIN` | `https://<project>.vercel.app` |
| `TRUST_PROXY` | `2` to start with; check it in step 6 |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` `MAIL_FROM` | your SMTP provider |

`PORT` is set by Render and read by the API. Note the service URL (`https://<service>.onrender.com`) and check
`https://<service>.onrender.com/api/health`.

## 4. Vercel (the web app)

1. Put the Render host in `web/vercel.json` (replace `YOUR-RENDER-SERVICE`), commit and push.
2. Add New → Project → the repository, **Root Directory: `web`** (keep "Include files outside the root directory").
   The build settings come from `web/vercel.json`.
3. Environment variable `ENABLE_EXPERIMENTAL_COREPACK=1`, so the pnpm version of `packageManager` is used.
4. Deploy. If the project URL is not the one used in step 3, update `WEB_BASE_URL` and `CORS_ORIGIN` on Render.

## 5. Keep the API awake (optional)

A free Render service sleeps after 15 minutes; the next request waits about a minute and the extension may time out.
A free scheduler such as cron-job.org calling `https://<service>.onrender.com/api/health` every 10 minutes keeps it up
(one service fits in the 750 free hours a month).

## 6. Checks after the first deploy

- Sign in at `https://<project>.vercel.app` as the first System Admin, then change the password.
- **Client address (`TRUST_PROXY`)**: the login throttle keys on the client address. Fail the sign-in on purpose until
  the page shows the countdown, then sign in from **another network** (a phone on mobile data). If the other network is
  blocked too, the API sees the proxy's address instead of the client's: raise `TRUST_PROXY` by one and test again.
  Do not set it higher than needed (a client could then choose its own address).
- Point the browser extension at `https://<project>.vercel.app`.

## Limits

- Cold starts on Render's free plan; scheduled jobs inside the API run only while it is awake.
- Supabase free: no daily backups, pause after a week of inactivity (restore it from the dashboard).
- One API instance only (the request-rate windows live in memory, decision 27).
