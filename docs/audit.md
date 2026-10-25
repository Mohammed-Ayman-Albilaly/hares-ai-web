# Release audit (batch B15)

What was checked before release, how to repeat it, what the checks found, and what is still open.
Everything below was run on the code in this repository; nothing here is a claim about official
certification (the interface follows the principles of the Saudi Digital Government Authority design
system, it is not a certified implementation).

## 1. How to repeat the checks

| Check | Command | What it needs |
| --- | --- | --- |
| Types, lint | `pnpm -w typecheck` and `pnpm -w lint` | nothing |
| Unit and integration tests (contract, API, web) | `pnpm -w test` | PostgreSQL (the API suites create a throwaway `hares_test_*` database) |
| API end-to-end (real server process) | `pnpm --filter api e2e` | PostgreSQL |
| Browser end-to-end, RTL and accessibility audit | `pnpm e2e` (first time: `pnpm e2e:browser-install`) | PostgreSQL; builds the web app, starts the API on :3200 and the web app on :1520, drops its database at the end |
| Production images | `docker compose -f docker-compose.prod.yml --env-file .env.prod build` | Docker; see section 5 |

`pnpm e2e` never touches the development database or the development servers.

**What the browser suite does and does not test.** It starts the API with `tsx` (`NODE_ENV=development`) and serves the built web app with `vite preview`. It therefore does not exercise the production packaging: no nginx, no Content-Security-Policy, no esbuild bundle, no `Secure` cookie, no `TRUST_PROXY`. The production stack was checked separately and by hand (section 5); the CI `containers` job only validates the compose file and builds the images.

## 2. Results

| Suite | Tests | Result |
| --- | --- | --- |
| contract | 20 | pass |
| API (unit and integration, throwaway database) | 317 | pass |
| API end-to-end (real process) | 10 | pass |
| web (components, pages, session, i18n, axe on key pages) | 88 | pass |
| browser end-to-end (Chromium, Arabic locale) | 53 | pass |

The browser suite (`e2e/tests`) covers:

- **auth.spec**: wrong password, role homes, reload keeps the session, sign-out (also in a second tab), refresh cookie is `HttpOnly`, `SameSite=Strict`, `Path=/api/auth` and no token is in web storage (the `Secure` flag is not asserted here: it is set only in production, and was seen on the production stack by hand), the failed-login throttle (429 with a countdown, also for the right password), and register → pending → approved by the System Admin → sign in.
- **rbac.spec**: every screen for each role (allowed or refused), and 15 API endpoints × 3 roles checked against the capability matrix, plus "no token → 401" for all of them, department scoping of logs, users and policy, and log identifiers that cannot be guessed across departments.
- **ingestion.spec**: extension sign-in, event stored once and counted once (duplicate `log_id` is acknowledged, not counted), the event appears in the user's blocked list and in the department counters, extra fields (`prompt_text`, `user_id`…) and bad enum/date values are refused, tokens are bound to their client, identity comes from the token.
- **csv.spec**: administrators only; scoped to the department; follows the filters on screen; header columns are metadata only; UTF-8 byte-order mark; formula-looking cells are neutralised.
- **admin-flows.spec**: policy change reaches the extension bundle (ETag changes, 304 when unchanged) and the audit trail, department override, rule creation (also reaches the bundle), TOPIC text never reaches a Department Admin, unsafe regular expression refused, deactivate/reactivate lock-out round trip, self-protection, departments (duplicate name refused).
- **rtl-a11y.spec**: `lang`/`dir`, language switch and persistence, sidebar side, Western digits, axe (WCAG 2.0/2.1/2.2 A and AA tags) on every screen of every role in the light theme and in Arabic, the public pages also in English, four admin screens in the dark theme, the approve, manage and rule dialogs while open, skip link, charts have names and table alternatives, badges carry text, keyboard-operable log rows, 375 px reflow (no horizontal scrolling), drawer focus handling.

## 3. Accessibility audit

Method: axe-core in a real browser on every screen of every role (light theme, Arabic), the public pages also in
English, four admin screens in the dark theme, and the three kinds of dialog while open; plus the keyboard, focus and
reflow checks listed above. English and dark-theme coverage of the role screens is partial.

Problems the audit found, all fixed in this batch:

| Finding | Fix |
| --- | --- |
| Every dialog was pushed half off-screen in Arabic (centred with a `translate` that goes the wrong way in RTL), so its buttons could be unreachable on a short window | Dialogs are centred with `inset: 0` and automatic margins; a test checks the dialog is inside and centred |
| Phone width: tables made the whole page scroll sideways (visually hidden header text escaped the scroll container) | Scroll containers are positioned; a test checks 375 px reflow |
| Colour contrast below 4.5:1: secondary text, the primary button (white on cyan), risk and success badges, and the primary button in dark theme | Tokens changed centrally (`--ink-4`, `--accent`, `--risk-high`, `--risk-none`, dark `--accent-ink`) |
| Accessible names that did not contain the visible text (language button, logo link, user menu) — WCAG 2.5.3 | Names now start with the visible text; avatar initials are drawn by CSS |
| After closing the mobile drawer the focus was lost | Focus returns to the menu button, or to the page content after choosing a destination |
| Input borders and the toggle were about 1.4:1 against their background (WCAG 1.4.11); the focus style of fields was only a thin border; the danger button was unreadable in dark theme; Arabic text was letter-spaced; the password reveal button was on the wrong side in RTL | `--control-line` token (3:1 or more), a 3 px focus ring, `--danger-ink`/`--danger-hover`, `letter-spacing: 0` for Arabic on the base text, titles and display numbers (components that add their own Tailwind `tracking-*` class are not covered), the button follows the page direction |

Not done (be honest about it): no manual testing with a screen reader (NVDA, JAWS, VoiceOver, TalkBack),
no testing with browser zoom at 400 % on real devices, Chromium only. Automated rules find roughly
a third of accessibility problems; a manual pass should be done before a real deployment.

## 4. Security checks (from the outside)

- Roles: the matrix in `contract/src/capabilities.ts` is enforced by the API on every route (fail closed); the browser suite checks it for all roles and shows the screens refuse the wrong role.
- Sessions: access token in memory only; refresh token is an HttpOnly, Strict, path-scoped cookie; rotation with reuse detection; sign-out in one tab signs out the others.
- Ingestion: strict allow-list of metadata fields; no prompt text exists in the schema or the logs; idempotent by `log_id`.
- Rules: PATTERN rules are proven safe against catastrophic backtracking before they are stored; a TOPIC description is never sent to a Department Admin (checked at the API and on screen).
- Exports: administrators only, scoped like the list, formula-safe cells.
- Audit trail: append-only at the database (role privileges revoked), written in the same transaction as the change, visible to the System Admin only.
- Web server: Content-Security-Policy without inline scripts, `nosniff`, frame denial, no referrer, restrictive Permissions-Policy, immutable caching for hashed assets only, `no-store` for API answers. The production stack was loaded in a real browser with no CSP violations.

## 5. Production packaging

- `Dockerfile.api`: targets `api` (one bundled file plus production dependencies, runs as the unprivileged `node` user, health check) and `tools` (one-shot database setup).
- `Dockerfile.web`: the built web app behind nginx (unprivileged), which also proxies `/api` to the API so the browser sees one origin.
- `docker-compose.prod.yml`: `migrate` (migrations → application role → audit lock → seed, idempotent) → `api` → `web`. No database and no mail catcher: PostgreSQL is a managed service and `SMTP_HOST` must be a real mail server. Read-only root file systems, all capabilities dropped, `no-new-privileges`.
- `.env.prod.example` lists every setting; copy it to `.env.prod` (never committed).

Verified by hand on this machine (not automated): all three images build; the stack starts against an empty database, the
migration job completes, the API becomes healthy, the web container serves the app, deep links fall back to `index.html`,
sign-in works through nginx with `HttpOnly; Secure; SameSite=Strict`, and the app loaded and navigated in a real browser with
no Content-Security-Policy violation. The bundled API was also run under plain Node (login, database queries and the regex worker
thread). Repeat this with a clean `.env.prod` before a real deployment.

Hardening decided in the B15 review: the API container receives only the settings it needs (not the owner database URL or the
first-admin values); the API refuses to start in production with the example placeholder secret; nginx writes the client address
itself (`X-Forwarded-For` from the client is never forwarded; `TRUST_PROXY=1`); the web port is published on loopback by default
(`WEB_BIND`); the application role grants and the audit-trail lock run in one transaction; nested `.env` files are excluded from the
image build context; a tab left open across a deployment shows a reload prompt instead of a bare error.

Shared clusters: a PostgreSQL role belongs to the whole cluster and `api/db/roles.sql` sets its password on every run. Two
environments on one cluster need different application role names, and the owner user needs the CREATEROLE privilege (or the role is
created by hand once). The verification above used a throwaway database on the development cluster and reset the development
role's password as a side effect, which had to be restored.

What an operator must still provide: a TLS terminator in front of the web port (the cookie is `Secure` and
the API refuses a non-https `WEB_BASE_URL` in production), a managed PostgreSQL 16 with backups, strong
secrets, a real SMTP server, and `TRUST_PROXY` set to the number of proxies in front of the API.

Known limits: the request-rate windows are kept in the API's memory (one API instance, decision 27);
the extension (a separate project) is not part of this suite; the reset-password e-mail is not covered by
the browser suite (no mail server in the run).

## 6. DGA design review

An independent reviewer (read-only) compared the interface with the principles of the DGA design system and
with Arabic/RTL practice. The reviewer worked from the code and token values, not from the official site.

Fixed now: input and toggle border contrast, a real focus ring on fields, the danger button in dark theme,
no letter-spacing for Arabic, the password reveal button position in RTL, the copyright line (current year,
translated).

Follow-ups for the design refinement (they change the look, so they wait for the designs):

1. **Type size** — Arabic text is small (body 13.5 px, inputs 14 px, labels 12.5 px, table headers and chips 11 to 11.5 px). Raise the base size (inputs 16 px also avoids the iOS zoom), nothing below 12 to 13 px.
2. **Required/optional marks** on forms ("(مطلوب)" / "(اختياري)"), and a one-line note when every field is required.
3. **Phone tables** — stacked cards below 640 px instead of sideways scrolling; sticky header for long lists.
4. **Touch targets** of 40 to 44 px on coarse pointers (small buttons, the row chevron, the language and theme toggles).
5. **Dialogs** — in RTL put the confirming action first (at the start), give destructive dialogs their initial focus on Cancel, and keep one way to close (X or Cancel).
6. **Inline errors** — drop `role="alert"` on each field error (move focus to the first invalid field instead), add an icon to form alerts.
7. **Typefaces** — one family for Arabic and its numerals (the serif display numerals beside Arabic labels look mixed).
8. **Tokens** — role badge colours into tokens with dark values; one disabled style; stay on a 4/8 px spacing and radius scale.
9. **Copy** — the landing page promises "the server never receives the message text" and "cannot be edited or deleted" (audit trail); both are true in this implementation (no such field exists; the database blocks updates), keep the wording accurate if the design changes; check "24 categories" is generated from the contract; the sample rows on the landing page must stay clearly labelled as an illustration.
