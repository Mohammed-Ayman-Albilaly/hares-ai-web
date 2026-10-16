# Hares AI — Web & Backend API Specification

> Document: `docs/SPEC-WEB.md` · Version 1.4 (draft) · Part of the Hares AI graduation project (web scope).
> **Source of truth:** `docs/DECISIONS.md`. Where the source project report (`docs/source/hares-report.txt`) conflicts with DECISIONS.md, DECISIONS.md wins; conflicts are recorded in Section 8.
> **Conventions:** Requirements are atomic and testable. IDs are `WEB-FR-###` (functional) and `WEB-NFR-###` (non-functional). Each requirement states an actor, a “shall” statement, measurable acceptance criteria, and a Source. Sources are a report requirement ID (e.g. `6.1.4.2`), a report test-case ID (e.g. `TC-9`), `DECISIONS.md #n`, or `NEW`. No technology, library, or database is chosen in this document.

## 1. Purpose and scope

**Purpose.** Define what the Hares AI web frontend and its backend API must do, so product, design, and engineering can implement and test against one contract.

**In scope.**

- Public pages: landing, register, login, forgot password.
- Role dashboards: User, Department Admin, System Admin.
- Activity log review and CSV export.
- Policy and Custom Detection Rules management.
- User and department administration; account lifecycle.
- User profile self-service (view profile, change own password).
- Backend API for the web UI and the extension-facing endpoints (login, policy bundle fetch, log ingestion).
- Audit trail of administrator actions.

**Out of scope.**

- Browser extension internals, input interception, detection logic, and revision generation (built separately). Only the extension-facing API contract is specified (Section 4.6).
- Technology, library, or database selection (defined by the architect) — deliberately not named here.
- Detection accuracy/algorithm details (extension-side).

## 2. Actors and roles

**Actors.**

- **Visitor** — unauthenticated public user; can register.
- **User** — standard role; scoped to their own data.
- **Department Admin** — privileged, scoped to one department.
- **System Admin** — organization-wide administrator.
- **Extension (system actor)** — the browser extension calling the API (login, policy bundle, log ingestion). Not a human; has no interactive permissions.

**Roles** (from DECISIONS #3/#4 and the report glossary):

- `SYSTEM_ADMIN`: highest level; approves/rejects accounts, assigns roles and departments, manages departments, configures org-wide policy and custom rules, grants/revokes `SYSTEM_ADMIN`, sees all logs and dashboards.
- `DEPARTMENT_ADMIN`: restricted to one department; department dashboard and logs; deactivates users within the department. **Cannot approve new users.** **Read-only** on organization policy, department policy overrides, custom rules, and departments (DECISIONS #14).
- `USER`: standard; own dashboard, own activity log, own blocked messages.

Roles are mutually exclusive; an approved user has exactly one role.

### Permission matrix (capability × actor)

| Capability                                    | Visitor | User |  Dept Admin   | System Admin |   Extension   |
| --------------------------------------------- | :-----: | :--: | :-----------: | :----------: | :-----------: |
| Register (self)                               |    ✓    |  —   |       —       |      —       |       —       |
| Login / logout                                |    ✓    |  ✓   |       ✓       |      ✓       | ✓ (API login) |
| Reset password                                |    ✓    |  ✓   |       ✓       |      ✓       |       —       |
| View own profile / change own password        |    —    |  ✓   |       ✓       |      ✓       |       —       |
| View own dashboard                            |    —    |  ✓   |       ✓       |      ✓       |       —       |
| View own activity log / blocked messages      |    —    |  ✓   |       ✓       |      ✓       |       —       |
| View department dashboard & logs              |    —    |  —   |       ✓       |      ✓       |       —       |
| View org-wide dashboard & logs                |    —    |  —   |       —       |      ✓       |       —       |
| Export activity log (CSV)                     |    —    |  —   |   ✓ (dept)    |   ✓ (org)    |       —       |
| Approve / reject pending users                |    —    |  —   |       ✗       |      ✓       |       —       |
| Assign role / change department               |    —    |  —   |       ✗       |      ✓       |       —       |
| Deactivate a user                             |    —    |  —   | ✓ (own dept)  |   ✓ (any)    |       —       |
| Reactivate a user                             |    —    |  —   |       ✗       |      ✓       |       —       |
| Grant / revoke SYSTEM_ADMIN                   |    —    |  —   |       ✗       |      ✓       |       —       |
| Manage departments (create/rename/deactivate) |    —    |  —   |       ✗       |      ✓       |       —       |
| Create / edit custom detection rules          |    —    |  —   | ✗ (view only) |      ✓       |       —       |
| Manage org-wide policy                        |    —    |  —   | ✗ (view only) |      ✓       |       —       |
| Manage department policy overrides            |    —    |  —   | ✗ (view only) |      ✓       |       —       |
| Fetch policy bundle                           |    —    |  —   |       —       |      —       |       ✓       |
| Ingest activity log (idempotent)              |    —    |  —   |       —       |      —       |       ✓       |
| View audit trail of admin actions             |    —    |  —   |       ✗       |      ✓       |       —       |

Legend: ✓ allowed · ✗ explicitly denied (must be enforced) · — not applicable.

> Notes: DECISIONS #14 makes Department Admin **read-only** on policy, custom rules, and departments. DECISIONS #17 forbids anyone from deactivating or demoting their own account (enforced for all roles).

## 3. Account lifecycle

**Status enum:** `PENDING`, `ACTIVE`, `REJECTED`, `DEACTIVATED`.

**Transitions.**

- Visitor registers → `PENDING`. Account has **no** department, **no** role, **no** access.
- System Admin **approves** (must select a department and a role) → `ACTIVE`.
- System Admin **rejects** → `REJECTED` (terminal; cannot log in).
- `ACTIVE` → `DEACTIVATED` (System Admin org-wide, or Department Admin within their department).
- `DEACTIVATED` → `ACTIVE` (re-activation by System Admin; see WEB-FR-053, DECISIONS #20).
- `REJECTED` → re-registration is **not** allowed through the normal register flow while the record exists (see WEB-FR-062).
- `PENDING`, `REJECTED`, `DEACTIVATED` accounts **cannot log in** or use the extension.

**Pending Approvals flow.**

1. System Admin opens “Pending Approvals”.
2. The list shows all `PENDING` accounts: name, email, registration timestamp.
3. For each, the System Admin either:
   - **Approve** — choose a department and a role (`DEPARTMENT_ADMIN` or `USER`; **not** `SYSTEM_ADMIN`) → status `ACTIVE`.
   - **Reject** — confirm → status `REJECTED`.
4. A Department Admin **cannot** access this screen (enforced, WEB-FR-012).
5. A `PENDING` account cannot log in until approved.

> The first System Admin is created by a seed process (DECISIONS #3), not through Pending Approvals. Additional System Admins are created by an existing System Admin (WEB-FR-060).

**Onboarding and re-registration rule (WEB-FR-062).** Registration is rejected when the email is already registered (WEB-FR-002). A `REJECTED` account remains terminal and **cannot** re-register with the same email through the register page; the affected user must contact a System Admin, who may re-open the account (set it back to `PENDING`) or confirm the rejection.

## 4. Functional requirements

### 4.1 Accounts and onboarding

**WEB-FR-001 Register.** The system SHALL allow an unauthenticated visitor to create an account by providing a full name, a unique email, and a password, producing an account in `PENDING` status with no department, no role, and no access. **Actor:** Visitor.
_Acceptance:_ Given a visitor on the register page, when they submit a valid full name, a not-yet-used email, and a password meeting policy, then the system creates a User with status `PENDING`, department NULL, role NULL, and no session; the page confirms and directs to login. **Source:** 6.1.1.1, DECISIONS.md #3.

**WEB-FR-002 Unique email.** The system SHALL reject registration when the submitted email already exists. **Actor:** Visitor.
_Acceptance:_ Given an existing email, when a visitor submits registration with that email, then the system returns “email already in use” and creates no account. **Source:** DECISIONS.md #3, 6.1.1.1.

**WEB-FR-003 Login.** The system SHALL authenticate a user with an `ACTIVE` account using email and password and redirect them to the dashboard matching their role. **Actor:** User (all roles).
_Acceptance:_ Given valid credentials and status `ACTIVE`, when the user submits login, then the system grants a session and redirects to the role dashboard. **Source:** 6.1.1.2, 8.2.1 (step 6).

**WEB-FR-004 Login validation.** The system SHALL respond with a “complete all required fields” message when either field is omitted, and an “invalid credentials” message when credentials are wrong. **Actor:** User.
_Acceptance:_ Given an empty email or password, when login is submitted, then an error asks to complete all required fields and no session is created. Given wrong credentials, when login is submitted, then “invalid credentials” is shown and no session is created. **Source:** 8.2.1 (2a.1, 4a.1).

**WEB-FR-005 Login denied for non-ACTIVE accounts.** The system SHALL deny login for accounts that are not in `ACTIVE` status, returning a status-appropriate message, and SHALL NOT issue a session. **Actor:** User.
_Acceptance:_ Given status `DEACTIVATED`, when login is attempted, then access is denied with an “account inactive” message and no session. Given status `PENDING` or `REJECTED`, when login is attempted, then access is denied with a no-access message and no session. **Source:** 8.2.1 (4b.1), DECISIONS.md #3; PENDING/REJECTED messaging **Source:** NEW.

**WEB-FR-006 Logout.** The system SHALL allow an authenticated user to log out, invalidating the session. **Actor:** User (all roles).
_Acceptance:_ Given an authenticated user, when they click logout, then the session is terminated and they are redirected to the login page; protected pages are no longer reachable. **Source:** 6.1.1.3.

**WEB-FR-007 Password reset request.** The system SHALL provide a password reset mechanism initiated from the login page that lets a user request a reset using their email. **Actor:** User.
_Acceptance:_ Given a forgot-password page, when a user submits a registered email, then the system responds success and initiates the reset flow; the response does not reveal whether the email exists. **Source:** 6.1.1.4, Figure 17; mechanism (single-use email link, 30-minute expiry, rate limited) **Source:** DECISIONS.md #15.

**WEB-FR-008 Bootstrap first System Admin.** The system SHALL provision one initial `SYSTEM_ADMIN` account through a seed process at deployment time. **Actor:** System (deployment).
_Acceptance:_ Given a fresh deployment with no users, when the seed runs, then exactly one `SYSTEM_ADMIN` account exists with `ACTIVE` status and can log in. **Source:** DECISIONS.md #3.

**WEB-FR-009 Pending approvals list.** The system SHALL allow a System Admin to view a list of all `PENDING` accounts with name, email, and registration timestamp. **Actor:** System Admin.
_Acceptance:_ Given at least one `PENDING` account, when the System Admin opens “Pending Approvals”, then the list shows each with name, email, and registration timestamp. **Source:** DECISIONS.md #3.

**WEB-FR-010 Approve pending user.** The system SHALL allow a System Admin to approve a `PENDING` account by assigning a department and a role, transitioning it to `ACTIVE`. **Actor:** System Admin.
_Acceptance:_ Given a `PENDING` account, when the System Admin selects a department and a role (`DEPARTMENT_ADMIN` or `USER`; `SYSTEM_ADMIN` is not selectable here — see WEB-FR-060) and approves, then the account becomes `ACTIVE` with those values and can log in; only an `ACTIVE` department can be selected. **Source:** DECISIONS.md #3.

**WEB-FR-011 Reject pending user.** The system SHALL allow a System Admin to reject a `PENDING` account, transitioning it to `REJECTED`. **Actor:** System Admin.
_Acceptance:_ Given a `PENDING` account, when the System Admin rejects with confirmation, then the status becomes `REJECTED` and it cannot log in. **Source:** DECISIONS.md #3.

**WEB-FR-012 Department Admin cannot approve.** The system SHALL prevent a Department Admin from accessing or performing the approve/reject actions on pending accounts. **Actor:** Department Admin.
_Acceptance:_ Given a Department Admin session, when they request the pending-approvals resource or an approve/reject action, then the request is denied (403) and no state changes. **Source:** DECISIONS.md #4.

**WEB-FR-053 Reactivate user.** The system SHALL allow a System Admin to reactivate a `DEACTIVATED` account, transitioning it to `ACTIVE`. **Actor:** System Admin.
_Acceptance:_ Given a `DEACTIVATED` user, when the System Admin reactivates with confirmation, then the status becomes `ACTIVE`, the user can log in again, and the action is recorded in the audit trail. **Source:** DECISIONS.md #20.

**WEB-FR-057 View own profile.** The system SHALL allow an authenticated user to view their own name, email, department, and role. **Actor:** User (all roles).
_Acceptance:_ Given an authenticated user, when they open their profile page, then the page shows their name, email, department (or “none” if pending), and role. **Source:** NEW.

**WEB-FR-058 Change own password.** The system SHALL allow an authenticated user to change their own password by providing their current password and a new password meeting policy. **Actor:** User (all roles).
_Acceptance:_ Given an authenticated user, when they submit their current password and a new password meeting policy, then the new password is stored (WEB-NFR-004), all existing access and refresh tokens of the user are revoked (WEB-FR-059), and a new session is issued for the current device. Given an incorrect current password or a new password violating policy, then the change is rejected with a message. **Source:** NEW.

**WEB-FR-062 Re-registration after REJECTED.** The system SHALL not allow a `REJECTED` account to re-register with the same email through the register page; the email remains reserved, and a System Admin must re-open the account to allow access. **Actor:** Visitor, System.
_Acceptance:_ Given an email on a `REJECTED` record, when a visitor attempts to register with that email, then registration is rejected with “email already in use”. Given a `REJECTED` account, when a System Admin re-opens it, then the status becomes `PENDING` and the normal approval flow applies. **Source:** DECISIONS.md #24.

### 4.2 Users and departments

**WEB-FR-013 List users (scoped).** The system SHALL allow a System Admin to list all users and a Department Admin to list users within their department, showing name, email, department, role, and status. **Actor:** System Admin, Department Admin.
_Acceptance:_ Given an authenticated admin, when they open user management, then the list shows users within their allowed scope with the specified columns, paginated. **Source:** Figures 25, 28; pagination **Source:** NEW.

**WEB-FR-014 Deactivate user (System Admin).** The system SHALL allow a System Admin to deactivate any user account, changing status to `DEACTIVATED`. **Actor:** System Admin.
_Acceptance:_ Given an `ACTIVE` user, when the System Admin deactivates with confirmation, then status becomes `DEACTIVATED`, the user cannot log in, its extension token is revoked (WEB-FR-059), and the action is recorded in the audit trail. **Source:** 6.1.6.4, TC-10.

**WEB-FR-015 Deactivate user (Department Admin).** The system SHALL allow a Department Admin to deactivate a user within their own department. **Actor:** Department Admin.
_Acceptance:_ Given an `ACTIVE` user in the department admin's department, when they deactivate with confirmation, then status becomes `DEACTIVATED` and the user cannot log in. Given a user outside the department, when they attempt deactivation, then it is denied. **Source:** 6.1.7.2, TC-10.

**WEB-FR-016 Change user department.** The system SHALL allow a System Admin to change a user's department to another department. **Actor:** System Admin.
_Acceptance:_ Given a user, when the System Admin assigns a different department, tthen the user's department is updated and the change is recorded in the audit trail; only an `ACTIVE` department can be selected.hen the user's department is updated and the change is recorded in the audit trail. **Source:** 6.1.6.5.

**WEB-FR-017 Assign role.** The system SHALL allow a System Admin to assign a user the `DEPARTMENT_ADMIN` or `USER` role. **Actor:** System Admin.
_Acceptance:_ Given a user, when the System Admin assigns the `DEPARTMENT_ADMIN` or `USER` role, then the role is updated and the user's next login redirects to the corresponding dashboard; the change is recorded in the audit trail. (`SYSTEM_ADMIN` is assigned via WEB-FR-060, not here.) **Source:** 6.1.6.6, TC-9/TC-10.

**WEB-FR-018 Role-based access control.** The system SHALL enforce role-based access control on every admin API endpoint and screen so a user can only perform capabilities permitted by their role. **Actor:** System.
_Acceptance:_ Given a User session, when they request a Department Admin or System Admin endpoint, then the request is denied (403). Given a Department Admin session, when they request a System Admin-only endpoint, then the request is denied (403). **Source:** 6.1.1.5, 6.2.2.3.

**WEB-FR-019 Department management (read).** The system SHALL allow a System Admin to view the list of departments (name and member count). **Actor:** System Admin.
_Acceptance:_ Given the departments page, when the System Admin opens it, then all departments are listed. **Source:** DECISIONS.md #1, Figure 30.

**WEB-FR-054 Create department.** The system SHALL allow a System Admin to create a department with a name. **Actor:** System Admin.
_Acceptance:_ Given the departments page, when the System Admin creates a department with a valid, unique name, then the department is persisted and appears in the department list. **Source:** DECISIONS.md #18, Figure 30.

**WEB-FR-055 Rename department.** The system SHALL allow a System Admin to rename a department. **Actor:** System Admin.
_Acceptance:_ Given an existing department, when the System Admin renames it, then the new name is persisted and the change is recorded in the audit trail. **Source:** DECISIONS.md #18, Figure 30.

**WEB-FR-056 Deactivate department.** The system SHALL allow a System Admin to deactivate a department, and deactivating a department SHALL block log ingestion for its users. **Actor:** System Admin.
_Acceptance:_ Given an `ACTIVE` department, when the System Admin deactivates it with confirmation, then the department is deactivated, ingested events from that department's users are rejected at ingestion, and the action is recorded in the audit trail. Given an already-deactivated department, when logs for its users are posted, then they are rejected. Historical logs of the department remain visible until purged by the retention rule (WEB-FR-067). **Source:** DECISIONS.md #18, #23.

**WEB-FR-060 Grant / revoke SYSTEM_ADMIN.** The system SHALL allow an existing System Admin to grant or revoke the `SYSTEM_ADMIN` role to or from another `ACTIVE` user, enabling multiple System Admins. **Actor:** System Admin.
_Acceptance:_ Given an `ACTIVE`, non-System-Admin user, when a System Admin grants `SYSTEM_ADMIN`, then the user becomes a System Admin and can access System Admin features. Given a System Admin, when another System Admin revokes the role, then the user loses System Admin access; the revoking System Admin SHALL choose the new role (`DEPARTMENT_ADMIN` or `USER`) and an `ACTIVE` department for that user. **Source:** DECISIONS.md #17.

**WEB-FR-061 Cannot deactivate or demote self.** The system SHALL prevent any user from deactivating or demoting their own account. **Actor:** System (enforced).
_Acceptance:_ Given an authenticated user, when they attempt to deactivate or demote their own account (including a System Admin revoking their own `SYSTEM_ADMIN`), then the operation is denied (403) and no state change occurs. **Source:** DECISIONS.md #17.

**WEB-FR-063 Role hierarchy for deactivation.** The system SHALL prevent a Department Admin from deactivating any account whose role is `DEPARTMENT_ADMIN` or `SYSTEM_ADMIN`. **Actor:** System (enforced).
_Acceptance:_ Given a Department Admin session, when they attempt to deactivate a Department Admin or System Admin, then the request is denied (403) and no state changes. **Source:** NEW.

**WEB-FR-064 System Admin department.** The system SHALL allow a `SYSTEM_ADMIN` account to have no department; log events from such an account are recorded with a null department and are visible to System Admins only. **Actor:** System.
_Acceptance:_ Given a System Admin with no department, when their events are ingested, then they are stored with department null and appear only in organization-wide views. **Source:** NEW.

### 4.3 Activity logs and CSV export

**WEB-FR-020 Record risk level.** The system SHALL record the risk level for every ingested activity event. **Actor:** System (via extension ingestion).
_Acceptance:_ Given an ingested log event with a risk level, then the stored log contains that risk level. **Source:** 6.1.5.1, DECISIONS.md #2.

**WEB-FR-021 Review activity logs (System Admin).** The system SHALL allow a System Admin to review organization-wide activity logs. **Actor:** System Admin.
_Acceptance:_ Given a System Admin session, when they open log review, then logs across all departments are shown. **Source:** 6.1.5.3, 8.2.3.

**WEB-FR-022 Review activity logs (Department Admin).** The system SHALL allow a Department Admin to review activity logs limited to their department. **Actor:** Department Admin.
_Acceptance:_ Given a Department Admin session, when they open log review, then only logs whose department matches theirs are shown. **Source:** 8.2.3 (2a.1).

**WEB-FR-023 Review activity logs (User).** The system SHALL allow a User to view their own activity log only, of which “Blocked Messages” is the subset with action = `BLOCKED`. **Actor:** User.
_Acceptance:_ Given a User session, when they open “My Activity Log”, then only rows for their own user are shown and no prompt text appears. **Source:** 6.1.8.4, 6.1.5.1, TC-5.

**WEB-FR-024 Filter logs.** The system SHALL allow an administrator to filter activity logs by date range, user, risk level, data category, and platform. **Actor:** System Admin, Department Admin.
_Acceptance:_ Given a log review screen, when the user sets a combination of date range, user, risk level, category, and platform filters, then only matching rows are returned. **Source:** 8.2.3 (input), TC-5.

**WEB-FR-025 Export CSV.** The system SHALL allow an administrator to export the filtered activity logs to a CSV file. **Actor:** System Admin, Department Admin.
_Acceptance:_ Given filtered results, when an administrator clicks “Export CSV”, then a CSV file is downloaded containing only the filtered rows and only the allowed metadata columns (Section 6), with no prompt text. **Source:** 6.1.5.4, 8.2.3 (6a.1), TC-6 (resolved in Section 8).

**WEB-FR-026 Log columns.** The system SHALL display the following columns in the log table: timestamp, user identifier, data category(ies), risk level, platform, and action taken. **Actor:** System Admin, Department Admin, User.
_Acceptance:_ Given the log review, when rows are rendered, then the listed columns appear and no column contains prompt text. **Source:** 8.2.3 (step 3), DECISIONS.md #2.

**WEB-FR-027 No-results and error states.** The system SHALL show a “no results” message when no logs match the filters, and an error message with a retry action when log retrieval fails. **Actor:** System Admin, Department Admin.
_Acceptance:_ Given filters that match nothing, the UI shows a no-results message. Given a retrieval failure, the UI shows an error and a retry control. **Source:** 8.2.3 (5a.1, 2b.1).

**WEB-FR-066 Show and filter user decision.** The system SHALL display `user_decision` as a column in the log table and allow filtering by it; dashboards SHALL show the override rate (share of WARNED/BLOCKED events with `SUBMITTED_ANYWAY`). **Actor:** System Admin, Department Admin.
_Acceptance:_ Given log review, when the admin filters by `user_decision = SUBMITTED_ANYWAY`, then only matching rows are returned; the dashboard shows the override rate for its scope. **Source:** TC-2, DECISIONS.md #21.

**WEB-FR-067 Retention purge.** The system SHALL delete activity log records older than the retention period (90 days) and SHALL keep aggregate dashboard counters for purged periods. **Actor:** System.
_Acceptance:_ Given a log older than 90 days, when the purge job runs, then the record is deleted and totals for that period remain available in aggregates. The audit trail is never purged. **Source:** DECISIONS.md #11.

### 4.4 Dashboards per role

**WEB-FR-028 System Admin organization dashboard.** The system SHALL provide an organization-wide dashboard for the System Admin with summary statistics and charts. **Actor:** System Admin.
_Acceptance:_ Given a System Admin session, when they open the org dashboard, then it shows summary statistics (total users, total intercepted prompts, total blocked prompts, total warnings, percentage of high-risk detections), a chart of most-used AI platforms per department, and a chart of most frequently leaked sensitive-data categories per department. **Source:** 6.1.6.1–6.1.6.3, 6.1.6.7, 8.2.4, TC-8.

**WEB-FR-029 System Admin risk summary across departments.** The system SHALL provide the System Admin a summary of risks across all departments, including a risk-trend chart and a per-department risk-distribution chart. **Actor:** System Admin.
_Acceptance:_ Given org activity data, when the System Admin reviews the risk section, then a risk-trend chart over time and a stacked per-department risk chart are shown with accurate, current values. **Source:** 6.1.6.7, TC-8.

**WEB-FR-030 Department Admin dashboard.** The system SHALL provide a department dashboard for the Department Admin showing the risk summary, most-used AI platforms, and most-leaked sensitive-data categories for their department. **Actor:** Department Admin.
_Acceptance:_ Given a Department Admin session, when they open the department dashboard, then it shows the department risk summary and the platform/category charts scoped to their department. **Source:** 6.1.7.1, 6.1.7.3–6.1.7.5.

**WEB-FR-031 User dashboard.** The system SHALL provide a dashboard for a User showing their own AI usage, detected risk activity, and the categories of sensitive data leaked in their events. **Actor:** User.
_Acceptance:_ Given a User session, when they open their dashboard, then it shows their risk activity and the leak categories; only their own data is shown. **Source:** 6.1.8.1–6.1.8.3.

**WEB-FR-032 Blocked messages list (User).** The system SHALL show a User a list of their own blocked messages, which is the activity log filtered to action = `BLOCKED` and scoped to that user. **Actor:** User.
_Acceptance:_ Given a User with blocked events, when they open “Blocked Messages”, then only their own events with action `BLOCKED` are listed and no prompt text is shown. **Source:** 6.1.8.4, TC-7 (resolved in Section 8).

**WEB-FR-033 No-data state.** The system SHALL show a “no activity recorded” message when a dashboard has no data, and an error with retry when data retrieval fails. **Actor:** System Admin, Department Admin, User.
_Acceptance:_ Given no activity data, when the dashboard loads, then a no-data message is shown. Given a retrieval failure, then an error with retry is shown. **Source:** 8.2.4 (2a.1, 2b.1).

### 4.5 Policy and Custom Detection Rules

**WEB-FR-034 Create custom detection rule.** The system SHALL allow a System Admin to create a Custom Detection Rule with a name, a definition, a risk level, an action, a scope (organization-wide or specific departments), an enabled flag, and a kind. **Actor:** System Admin.
_Acceptance:_ Given the rules page, when the System Admin creates a rule with valid kind, name, definition, risk level, action, scope, and enabled, then the rule is persisted and becomes part of the next policy bundle version. **Source:** DECISIONS.md #5.

**WEB-FR-035 Rule kinds.** The system SHALL support exactly three rule kinds: `PATTERN` (regular expression), `KEYWORD` (word list), and `TOPIC` (natural-language description). **Actor:** System Admin.
_Acceptance:_ Given the rules form, when creating a rule, then the kind selector offers PATTERN, KEYWORD, and TOPIC, and each kind validates its definition accordingly. **Source:** DECISIONS.md #5.

**WEB-FR-036 Regex validation.** The system SHALL validate that a `PATTERN` rule expression is a valid regex, is length-limited, and is not susceptible to ReDoS, rejecting invalid or unsafe patterns. **Actor:** System Admin.
_Acceptance:_ Given a PATTERN rule with an invalid, over-length, or catastrophic-backtracking expression, when saved, then the system rejects it with a validation error; a safe, in-length pattern is accepted. **Source:** DECISIONS.md #5.

**WEB-FR-037 TOPIC warning.** The system SHALL display a warning in the UI advising administrators not to put real secrets in TOPIC rule examples. **Actor:** System Admin.
_Acceptance:_ Given the TOPIC rule form, when the admin views it, then the warning is shown. **Source:** DECISIONS.md #5.

**WEB-FR-038 Edit/disable rules.** The system SHALL allow a System Admin to edit a rule's fields and to enable or disable a rule. **Actor:** System Admin.
_Acceptance:_ Given an existing rule, when the System Admin edits it or toggles enabled, then the change is persisted and reflected in the next policy bundle version. **Source:** DECISIONS.md #5.

**WEB-FR-039 List rules.** The system SHALL display the list of Custom Detection Rules with their name, kind, risk level, scope, enabled state, and action. **Actor:** System Admin.
_Acceptance:_ Given the rules page, when opened, then all rules are listed with the specified attributes and enabled state. **Source:** DECISIONS.md #5, TC-11.

**WEB-FR-040 Department policy (category → action).** The system SHALL allow a System Admin to configure, per department, for each sensitive-data category an action (allow / warn / block) and whether the category is enabled. **Actor:** System Admin.
_Acceptance:_ Given a department, when the System Admin sets a category action and enabled state, then the policy is persisted and included in the policy bundle for that department. **Source:** DECISIONS.md #6.

**WEB-FR-041 Policy bundle versioning.** The system SHALL maintain a versioned policy bundle and assign a new version whenever policy or custom rules change. **Actor:** System.
_Acceptance:_ Given a policy/rule change, when published, then a new bundle version is created and the version identifier is incremented; the bundle endpoint serves the new version. **Source:** DECISIONS.md #5, #7.

**WEB-FR-042 Policy bundle fetch (extension).** The system SHALL provide an endpoint that returns the current policy bundle for a user as one resolved policy (one entry per data category, with the organization defaults and the user's department overrides already applied), the applicable enabled custom rules, and a version identifier. **Actor:** Extension.
_Acceptance:_ Given a version check, when the extension requests the bundle, then the latest applicable bundle and version are returned; a request using the current version returns the same version without duplication. **Source:** DECISIONS.md #7.

**WEB-FR-065 Organization default policy.** The system SHALL allow a System Admin to configure an organization-wide default policy (category → action and enabled flag) that applies to every department without an override. **Actor:** System Admin.
_Acceptance:_ Given no department override for a category, when the policy bundle is built, then the organization default applies. The default action per risk level is HIGH→block, MEDIUM→warn, LOW→allow with info, NONE→allow, unless changed. **Source:** DECISIONS.md #6, 15.3, 15.5.

#### Precedence semantics

When several categories or rules match a single event, the system SHALL apply the following precedence (highest wins), and the most restrictive action wins. **Source:** NEW.

- **Risk level:** the highest risk level among all matching categories/rules wins (HIGH > MEDIUM > LOW > NONE).
- **Action:** the most restrictive action wins (BLOCK > WARN > ALLOW).
- **Scope:** a department policy override beats the organization default for that department.
- **Custom rules:** a custom rule's own configured action is applied, unless the department policy is stricter, in which case the stricter department action applies.
- **Policy bundle version:** the policy bundle version is **global** (single version counter per organization). Any change to organization policy, a department policy override, or a custom rule produces a new bundle version that is served to all extensions.

### 4.6 Extension-facing API

**WEB-FR-043 Extension login.** The system SHALL allow the extension to authenticate a user via email and password and return a short-lived access token and a rotating refresh token scoped to that user (DECISIONS #30). **Actor:** Extension.
_Acceptance:_ Given valid `ACTIVE` credentials, when the extension requests login, then an access token (1 hour or less) and a refresh token are returned for the user; `PENDING`/`REJECTED`/`DEACTIVATED` accounts are denied. **Source:** 6.1.1.2, 8.2.1, DECISIONS.md #12, #30.

**WEB-FR-044 Policy bundle endpoint.** The system SHALL provide the policy bundle fetch endpoint used by the extension (see WEB-FR-042). **Actor:** Extension.
_Acceptance:_ Given an authenticated extension session, when it calls the bundle endpoint, then the applicable resolved policy bundle with its version is returned. **Source:** DECISIONS.md #5–#7.

**WEB-FR-045 Log ingestion endpoint.** The system SHALL accept activity log events from the extension via an ingestion endpoint. **Actor:** Extension.
_Acceptance:_ Given a well-formed log event, when the extension posts it, then the event is persisted and an acknowledgement is returned. **Source:** 6.1.5.1, DECISIONS.md #2.

**WEB-FR-046 Strict allowlist.** The system SHALL reject any log ingestion payload containing a field not in the documented allowlist (Section 6), including any prompt-text field. **Actor:** Extension.
_Acceptance:_ Given a payload with a non-allowlisted field (e.g., any prompt text field), when posted, then it is rejected with a validation error and nothing is stored. **Source:** DECISIONS.md #2.

**WEB-FR-047 Idempotent ingestion.** The system SHALL make log ingestion idempotent by event `log_id` (UUID generated by the extension); a duplicate `log_id` SHALL NOT create a duplicate record. **Actor:** Extension.
_Acceptance:_ Given an already-received `log_id`, when the same event is posted again, then no new record is created and the prior record is acknowledged. **Source:** DECISIONS.md #8.

**WEB-FR-048 Required log fields.** The system SHALL require the extension to supply, for each log event: `log_id`, `event_time`, `platform`, `risk_level`, `action`, `categories`, `classification_source`, `user_decision`, and `schema_version`; the system SHALL derive `user_id` and `department_id` from the authenticated access token and SHALL ignore or reject any client-supplied value for them. **Actor:** Extension.
_Acceptance:_ Given an event missing a required field, when posted, then it is rejected with a validation error. Given an event that includes a `user_id` or `department_id` different from the token's, when posted, then the stored record uses the token's identity (or the request is rejected) and no record is created for another user. **Source:** DECISIONS.md #2/#8/#21; identity derivation **Source:** NEW.

**WEB-FR-049 Invalid enum values.** The system SHALL reject an ingestion payload whose `risk_level`, `action`, `platform`, `classification_source`, or `user_decision` is not one of the allowed enum values for the current `schema_version`. **Actor:** Extension.
_Acceptance:_ Given an event with an invalid enum value, when posted, then it is rejected. **Source:** DECISIONS.md #2/#21, report 15.7.

**WEB-FR-059 Extension token revocation.** The system SHALL revoke a user's extension access tokens immediately when that account is deactivated or rejected, or when its password is changed or reset. **Actor:** System.
_Acceptance:_ Given a valid extension token, when the account is deactivated, rejected, or its password changes, then any later request with that token is denied (401). **Source:** DECISIONS.md #12; password-change revocation **Source:** NEW.

**WEB-FR-068 Extension token refresh.** The system SHALL allow the extension to exchange a valid refresh token for a new access token and a new refresh token, and SHALL revoke the whole token family when an already-used refresh token is presented again. **Actor:** Extension.
_Acceptance:_ Given a valid refresh token, when the extension requests a refresh, then a new access token (1 hour or less) and a new refresh token are returned and the old refresh token becomes unusable. Given a refresh token that was already used, when it is presented again, then the request is denied (401) and every token of that family is revoked. Given an expired or revoked refresh token, then the request is denied (401). **Source:** DECISIONS.md #30.

**WEB-FR-069 Department Admin read-only policy view.** The system SHALL allow a Department Admin to view, read-only, the effective policy and the custom detection rules that apply to their department. **Actor:** Department Admin.
_Acceptance:_ Given a Department Admin session, when they open the policy or rules page, then the effective category actions and applicable rules are listed and no create, edit, enable, or disable control is available; any write request is denied (403). **Source:** DECISIONS.md #14, permission matrix.

**WEB-FR-070 Bundle for a user without a department.** The system SHALL return, for a user with no department, a policy bundle containing only the organization default policy and the organization-wide custom rules. **Actor:** Extension.
_Acceptance:_ Given a System Admin with no department, when the extension fetches the bundle, then the bundle contains organization defaults and organization-wide rules only. **Source:** NEW (WEB-FR-064).

**WEB-FR-071 Extension logout.** The system SHALL allow the extension to sign out by presenting its refresh token, which revokes that refresh token's whole family. **Actor:** Extension.
_Acceptance:_ Given a valid refresh token, when the extension calls logout, then the whole token family is revoked, the response is 204 with no body, and any later refresh with a token of that family is denied (401). **Source:** NEW.

**WEB-FR-072 Event time validation.** The system SHALL reject a log event whose `event_time` is more than 5 minutes in the future or older than 90 days. **Actor:** System.
_Acceptance:_ Given an event with `event_time` more than 5 minutes ahead of the server clock or older than 90 days, when it is posted, then it is rejected (HTTP 400, error code EVENT_TIME_OUT_OF_RANGE) and nothing is stored. **Source:** NEW (retention basis, see DATA-MODEL L3).

### 4.7 Audit trail of admin actions

**WEB-FR-050 Record admin actions.** The system SHALL record an audit entry for each privileged administrative action: account approve/reject, reactivate, deactivate, re-opening of a rejected account, role change (including grant/revoke `SYSTEM_ADMIN`), department change, department create/rename/deactivate, policy change, and custom rule change. **Actor:** System.
_Acceptance:_ Given an admin performs one of the listed actions, when the action commits, then an audit entry is written with acting admin id, action, target, and timestamp. **Source:** DECISIONS.md #3 (AdminAuditLog), #19, TC-9.

**WEB-FR-051 View audit trail.** The system SHALL allow a System Admin to view the audit trail with timestamp, acting admin, action, and target. **Actor:** System Admin.
_Acceptance:_ Given the audit trail screen, when the System Admin opens it, then entries are listed with the specified fields. **Source:** DECISIONS.md #19.

**WEB-FR-052 Audit trail immutability.** The system SHALL not allow an administrator to modify or delete audit entries. **Actor:** System.
_Acceptance:_ Given an audit entry, when any admin attempts to edit/delete it, then the operation is denied. **Source:** DECISIONS.md #11/#19.

## 5. Non-functional requirements

**WEB-NFR-001 Encryption in transit.** The system SHALL encrypt all traffic between the web client / extension and the backend using TLS (HTTPS). **Target:** HTTPS enforced for all endpoints; no plaintext transport. **Source:** 6.2.2.1.

**WEB-NFR-002 No prompt text ever.** The backend SHALL never receive, store, log, or return any prompt text (original, masked, or revised) or placeholder values. **Target:** zero prompt-text fields in any request, storage, or response; verified by a test that posts prompt text and expects rejection (WEB-FR-046). **Source:** DECISIONS.md #2, 6.2.2.2.

**WEB-NFR-003 RBAC enforcement.** The system SHALL enforce role-based access control on every privileged API endpoint and screen so unauthorized users receive 403. **Target:** 100% of privileged endpoints reject non-authorized roles. **Source:** 6.2.2.3, DECISIONS.md #4.

**WEB-NFR-004 Password storage.** The system SHALL store passwords using a salted, one-way, computationally expensive hash and SHALL never store or return plaintext passwords. **Target:** no plaintext password persisted or returned. **Source:** 6.2.2.4.

**WEB-NFR-005 Log ingest allowlist.** The system SHALL validate log ingestion against a strict allowlist and reject anything not listed. **Target:** a payload containing any unknown field is rejected (HTTP 400) with nothing stored. **Source:** DECISIONS.md #2.

**WEB-NFR-006 Regex safety.** The system SHALL validate `PATTERN` rules for validity, length limit, and ReDoS safety before acceptance. **Target:** invalid or unsafe patterns rejected with a validation message; recommended length limit ≤ 512 characters. **Source:** DECISIONS.md #5 (length value **Source:** NEW).

**WEB-NFR-007 Dashboard load time.** The system SHALL load the admin dashboards within 3 seconds under normal network conditions for a typical dataset. **Target:** p95 dashboard load ≤ 3 s. **Source:** 6.2.1.4.

**WEB-NFR-008 Log ingestion responsiveness.** The system SHALL acknowledge a log ingestion call within 500 ms (p95) under normal load. **Target:** p95 ≤ 500 ms. **Source:** NEW.

**WEB-NFR-009 Policy bundle freshness.** The system SHALL serve the latest policy bundle version to the extension and support version-based checks, responding within 1 s under normal load. **Target:** p95 bundle fetch ≤ 1 s. **Source:** DECISIONS.md #7 (latency numeric **Source:** NEW).

**WEB-NFR-010 Near-real-time dashboards.** The system SHALL reflect ingested activity in dashboard and log views within 30 s of receipt. **Target:** 30 s maximum aggregation lag. **Source:** 15.7 (async dashboard update; numeric **Source:** NEW).

**WEB-NFR-011 Privacy of log metadata.** The system SHALL store only the allowlisted metadata fields for activity logs and SHALL not store sensitive data values or placeholder tags. **Target:** each stored log record contains only documented allowlisted fields. **Source:** DECISIONS.md #2.

**WEB-NFR-012 Bilingual UI (Arabic/English).** The web UI SHALL support Arabic and English as first-class languages with full RTL support and content parity, and SHALL provide a language switcher on every page that persists the choice. **Target:** every user-facing string translated in both languages; RTL mirrors layout; every page exposes the switcher. **Source:** DECISIONS.md #9.

**WEB-NFR-013 Accessibility.** The web UI SHALL meet WCAG 2.1 AA. **Target:** automated AA checks pass; verified by review. **Source:** DECISIONS.md #9.

**WEB-NFR-014 Mobile-first responsive.** The web UI SHALL be mobile-first and responsive across breakpoints. **Target:** usable at mobile, tablet, and desktop widths without horizontal overflow. **Source:** DECISIONS.md #9.

**WEB-NFR-015 DGA-aligned design.** The web UI SHALL follow Saudi DGA design guidelines (design tokens, typography, components, patterns) and SHALL NOT claim official DGA certification; compliance is verified by review and manual validation. **Target:** design reviewed against DGA guidance; no certification claim made. **Source:** DECISIONS.md #9.

**WEB-NFR-016 Browser accessibility (no install).** The admin dashboard SHALL be accessible from any modern web browser without additional software installation. **Target:** works on current supported browsers. **Source:** 6.2.3.3.

**WEB-NFR-017 Updateable rules without redeployment.** The system SHALL allow detection rules and policy to be updated without a full redeployment, via versioned policy bundles. **Target:** a rule/policy change takes effect on the next bundle fetch without a deploy. **Source:** 6.2.5.1, DECISIONS.md #5/#7.

**WEB-NFR-018 Modular architecture.** The system SHALL be built modularly (separation of public pages, dashboards, and API) so components can be updated independently. **Target:** a change to one component does not require updating unrelated components. **Source:** 6.2.5.2.

**WEB-NFR-019 Password policy.** The system SHALL enforce a minimum password length and a complexity requirement at registration, password change, and password reset. **Target:** minimum length 8 characters; passwords must contain at least one uppercase letter, one lowercase letter, one digit, and one non-alphanumeric character. **Source:** DECISIONS.md #22.

**WEB-NFR-020 Login throttling.** The system SHALL slow down repeated failed login attempts using a progressive delay per account and per source address, without permanently locking the account. **Target:** after 5 consecutive failures within 15 minutes, each further attempt incurs an increasing delay (doubling, capped at 15 minutes); a successful login or a password reset clears the counter; the response never reveals whether the email exists. **Source:** DECISIONS.md #22.

**WEB-NFR-021 Ingestion contract versioning.** The system SHALL version the ingestion contract with `schema_version` and SHALL reject unknown enum VALUES rather than silently dropping them. **Target:** a payload with an enum value not defined in the current `schema_version` is rejected (HTTP 400) with an actionable error so the extension can retry or alert; adding a new enum value requires a new `schema_version`. **Source:** DECISIONS.md #21, NEW.

**WEB-NFR-022 CSV injection safety.** The system SHALL neutralize spreadsheet-formula injection in CSV exports. **Target:** any exported cell beginning with `=`, `+`, `-`, `@`, tab or carriage return is prefixed so it is treated as text. **Source:** NEW.

## 6. Privacy and data rules

**Core rule** (DECISIONS #2): the backend MUST NOT receive, store, or transmit prompt text in any form — no original, no masked, no revised — and must not store placeholder tag values. It stores metadata only.

### What the backend MAY store for an activity log event (exact allowlist)

|                   Field | Type / allowed values                                                            | Notes                                                                     |
| ----------------------: | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
|                `log_id` | UUID                                                                             | generated by the extension; idempotency key (WEB-FR-047)                  |
|               `user_id` | identifier                                                                       | derived server-side from the access token; never trusted from the payload |
|         `department_id` | identifier                                                                       | derived server-side from the access token; never trusted from the payload |
|              `platform` | enum: `CHATGPT` \| `GEMINI` \| `CLAUDE`                  |                                                                           |
|            `risk_level` | enum: `HIGH` \| `MEDIUM` \| `LOW` \| `NONE`                                      |                                                                           |
|                `action` | enum: `BLOCKED` \| `WARNED` \| `ALLOWED`                                         |                                                                           |
| `classification_source` | enum: `LOCAL` \| `LOCAL_AI` \| `LOCAL_ONLY_FALLBACK`                             | from the report's LOCAL / LOCAL+GEMINI / LOCAL_ONLY_FALLBACK              |
|         `user_decision` | enum: `NONE` \| `SUBMITTED_ANYWAY` \| `EDITED` \| `REVISION_USED` \| `CANCELLED` | what the user did after a warning (DECISIONS #21)                         |
|               `rule_id` | identifier (nullable)                                                            | the custom rule that determined the final decision (the highest-precedence match); `null` otherwise (DECISIONS #21)            |
|        `schema_version` | positive integer, starts at 1                                                                  | the ingestion contract version (DECISIONS #21)                            |
|            `event_time` | UTC timestamp                                                                    | as reported by the extension                                              |
|           `received_at` | UTC timestamp                                                                    | as received by the backend                                                |
|            `categories` | list of category codes (the 24 stable codes, DECISIONS #31)                                                           | category names/codes only; no values                                      |

**Contract evolution rule.** The ingestion contract is versioned by `schema_version`. Unknown FIELDS are always rejected (WEB-FR-046). New enum VALUES are introduced only by publishing a new `schema_version`; an enum value that is not valid for the current `schema_version` is rejected with a clear, actionable error — it is **never** silently dropped — so the extension can retry or alert (WEB-NFR-021).

> The report's 6.1.9.1 (store logs replacing sensitive fields with placeholder tags) and the `RevisedPrompt`/`DetectionResult` entities are superseded by DECISIONS #2 — see Section 8.

### What the backend MAY store for a User

Full name, email, password hash, role, department_id, status, registration/approval timestamps. A `PENDING` user has department and role NULL until approval.

### What the backend MAY store for policy, custom rules, and departments

- **Policy (organization + per department):** for each sensitive-data category, an action (`allow` / `warn` / `block`) and an enabled flag, plus the policy bundle version it belongs to.
- **Custom Detection Rules:** id, kind (`PATTERN` / `KEYWORD` / `TOPIC`), name, definition, risk level, action, scope (org-wide or specific departments), enabled flag, and the bundle version it belongs to. A `TOPIC` definition is **admin-authored free text** (natural-language description) — it is not parsed or executed by the backend; the extension decides how to interpret it. The UI warning in WEB-FR-037 about not putting real secrets in TOPIC examples remains in force.
- **Departments:** id, name, active/status, and member count (derived from users).

### What the backend MAY store for admin audit

Acting admin id, action type, target user id / target resource, timestamp, and any non-sensitive detail. It must never include prompt text.

### What the backend MAY store for sessions and aggregates

- **Sessions:** hashed refresh tokens (with a family id and a used flag) and hashed password-reset tokens with their expiry. Never plaintext tokens.
- **Aggregates:** event-level and category-level counters that carry no user identity (DECISIONS #25).

### What the backend MUST NEVER store anywhere (any table, request, response, or log)

- Original prompt text
- Masked prompt text
- Revised / suggested / generated prompt text
- Placeholder tag values (e.g., `[API_KEY]`, `[PASSWORD]`, `[EMAIL]`)
- Detected sensitive values (actual email, national ID, IBAN, API key, etc.)
- Any free text that could be derived from the prompt

## 7. Reference: 24 sensitive-data categories and default risk level

Default risk levels are taken from the report's High/Medium/Low lists (glossary, section 6), and defaulted for the four categories the report left unassigned per DECISIONS #13.

|   # | Category                                          | Default risk |
| --: | ------------------------------------------------- | ------------ |
|   1 | Contact Information                               | MEDIUM       |
|   2 | Personal Identity Data                            | HIGH         |
|   3 | Financial & Banking Data                          | HIGH         |
|   4 | Authentication & Security Secrets                 | HIGH         |
|   5 | Network & System Data                             | MEDIUM       |
|   6 | Web Links & Identifiers                           | MEDIUM       |
|   7 | Location Data                                     | MEDIUM       |
|   8 | Health / Medical Data                             | HIGH         |
|   9 | Legal & Government Data                           | MEDIUM       |
|  10 | Vehicle Data                                      | MEDIUM       |
|  11 | Corporate & Document Identifiers                  | MEDIUM       |
|  12 | File & Path Data                                  | MEDIUM       |
|  13 | Digital Fingerprints & Technical Identifiers      | MEDIUM       |
|  14 | Shipping & Logistics Data                         | MEDIUM       |
|  15 | Cryptography & Certificates                       | HIGH         |
|  16 | Account & Application Data                        | MEDIUM       |
|  17 | Dates & Time Data                                 | MEDIUM       |
|  18 | Keyword-Based Sensitive Patterns                  | LOW          |
|  19 | Logs & Headers Data                               | MEDIUM       |
|  20 | Numeric Sensitive Data                            | MEDIUM       |
|  21 | Developer & Code Secrets                          | HIGH         |
|  22 | Education-Related Identifiers                     | MEDIUM       |
|  23 | Universal Identifiers                             | LOW          |
|  24 | Region-Specific Sensitive Banking & Identity Data | HIGH         |

High (7): 2, 3, 4, 8, 15, 21, 24 · Medium (15): 1, 5, 6, 7, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 22 · Low (2): 18, 23 · Unassigned (0).

## 8. Resolved conflicts (report vs. DECISIONS.md)

| #   | Item                                                                  | Report says                                                               | DECISIONS.md says                                                                  | Resolution in this spec                                                                                                               |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Prompt Preview in CSV (TC-5/TC-6)                                     | CSV includes a “Prompt Preview” column                                    | #2: no prompt text stored                                                          | CSV has no prompt/preview column; only metadata; user identity resolved from `user_id`. (WEB-FR-025, WEB-FR-026)                      |
| 2   | RevisedPrompt entity (report schema, 6.1.10, TC-7)                    | Store a RevisedPrompt record in the DB; revision persisted                | #2: revised prompt generated and shown inside the extension only; no RevisedPrompt | No RevisedPrompt entity/table; revision is extension-local; backend never stores it.                                                  |
| 3   | Expand log row to show prompt text (TC-5)                             | Expanding a row shows full prompt text with flagged entities highlighted  | #2: no prompt text of any kind                                                     | Row expansion shows metadata and category codes only; never prompt text or placeholders.                                              |
| 4   | Regex-only rules page (TC, System Configuration)                      | Admin adds only a regex detection rule                                    | #5: rules have kind PATTERN/KEYWORD/TOPIC                                          | Rules UI supports all three kinds; regex is one kind; length-limited and ReDoS-validated (WEB-FR-035, WEB-FR-036). (Test case: TC-11) |
| 5   | Store placeholder tags in logs (6.1.9.1)                              | Store logs replacing sensitive fields with placeholder tags               | #2: store metadata only; no placeholder values                                     | Logs store category codes only; no placeholder values.                                                                                |
| 6   | Log stores user's name (6.1.5.2)                                      | Log stores user's name, date, time                                        | #2: ActivityLog stores `user_id`; the name lives on the User entity                | Log stores `user_id`; display name resolved at read time.                                                                             |
| 7   | Firestore / Firebase Auth naming (8.2.1 step 3, 15.7)                 | Names specific external services                                          | Any technology named is NOT binding                                                | Treated as generic auth and persistence; no technology mandated here.                                                                 |
| 8   | Risk levels only Low/Medium/High in glossary, but algorithm uses NONE | Glossary lists Low/Medium/High                                            | #schema: `risk_level` includes NONE                                                | Adopt `NONE` as a valid risk level; NONE-risk events are logged (DECISIONS #10).                                                      |
| 9   | Suggest Compliant Revision (6.1.10, 8.2.5)                            | System displays a recommended revision; revision flows through the system | #2: revision shown in extension only; not stored or transmitted to the backend     | Revision is extension-only; the backend never receives or stores it.                                                                  |

## 9. Gaps found (implied but never specified)

The gaps identified in version 1.0 (G1–G12) have been resolved by DECISIONS #10–#21 and by the requirements added in this revision:

| #   | Was a gap                                                     | Resolved by                                           |
| --- | ------------------------------------------------------------- | ----------------------------------------------------- |
| G1  | Department CRUD (create/rename/deactivate)                    | DECISIONS #18; WEB-FR-054, WEB-FR-055, WEB-FR-056     |
| G2  | Password reset mechanism details                              | DECISIONS #15; WEB-FR-007                             |
| G3  | Extension authentication and token revocation on deactivation | DECISIONS #12; WEB-FR-043, WEB-FR-059                 |
| G4  | Log retention period / archival / deletion                    | DECISIONS #11                                         |
| G5  | Whether NONE-risk (allow/clean) events are logged             | DECISIONS #10; WEB-FR-020                             |
| G6  | Default risk level for 4 unassigned categories                | DECISIONS #13; Section 7                              |
| G7  | Who manages department-level policy                           | DECISIONS #14                                         |
| G8  | Whether Department Admin can create custom detection rules    | DECISIONS #14; WEB-FR-034                             |
| G9  | Whether a User can export their own activity log              | DECISIONS #16 (admins only)                           |
| G10 | Multiple System Admins / promote or deactivate by another     | DECISIONS #17; WEB-FR-060, WEB-FR-061                 |
| G11 | Exact fields and immutability of the admin audit trail        | DECISIONS #11/#19; WEB-FR-050, WEB-FR-051, WEB-FR-052 |
| G12 | Login brute-force / rate limiting                             | WEB-NFR-020 (DECISIONS #22)                           |

> The secondary-classification latency discrepancy (3.1.4 says 1.3 s, 6.2.1.2 says 1.2 s, 15.4 uses 800 ms) is extension-side and out of web scope; it is resolved in the extension spec, not here.

## 10. Open questions for the product owner

No open questions. All previously open items are resolved by DECISIONS #22–#24.

---

_End of SPEC-WEB.md._
