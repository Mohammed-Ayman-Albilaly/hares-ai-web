# Hares AI — UI Screen Design Briefs

---

## Public / Auth Screens

---

### 1. Landing Page
**Who uses it:** Any visitor (unauthenticated)
**Purpose:** Introduce Hares AI, explain value proposition, drive sign-up or login.
**Elements:**
- Top navigation bar: Logo (left), nav links (Features, How It Works, About), CTA buttons: "Sign Up" and "Log In" (right)
- Hero section: Large headline ("Protect your data before it leaves your hands"), one-line sub-headline, primary CTA button "Get Started Free", secondary link "Learn More"
- Feature highlights row: 3 icon-cards — Real-Time Detection, Risk Classification, Audit Logs
- How It Works section: 3-step horizontal flow — Install Extension → Prompt is Scanned → Risk is Flagged
- Footer: copyright, links to Privacy Policy and Terms of Use

**Style:** Clean, minimal, professional. Primary brand color accent on CTA buttons. White background, dark text. No clutter.

---

### 2. Login Screen
**Who uses it:** Registered users (any role)
**Purpose:** Authenticate the user and direct them to their role-appropriate dashboard.
**Elements:**
- Centered card layout
- Logo at top of card
- Form fields: Email, Password
- "Forgot Password?" link below password field
- Primary button: "Log In"
- Divider + link: "Don't have an account? Sign Up"
- Inline validation errors below each field (e.g., "Email is required", "Invalid credentials")

**Style:** Single-column centered card, subtle shadow, light grey background. Form labels above inputs, not placeholder-only.

---

### 3. Registration Screen
**Who uses it:** New users self-registering
**Purpose:** Create a new user account under an organization.
**Elements:**
- Centered card layout
- Form fields: Full Name, Work Email, Organization (dropdown or text), Password, Confirm Password
- Password strength indicator bar
- Checkbox: "I agree to the Terms of Use and Privacy Policy"
- Primary button: "Create Account"
- Link: "Already have an account? Log In"
- Inline validation errors per field

**Style:** Same card style as Login. Step-by-step feel — all fields visible but logically grouped (Identity → Organization → Security).

---

### 4. Forgot Password Screen
**Who uses it:** Any registered user who forgot their password
**Purpose:** Initiate password reset via email.
**Elements:**
- Centered card
- Instructional text: "Enter the email address associated with your account."
- Field: Email
- Button: "Send Reset Link"
- Confirmation state (same card): success icon, message "Check your inbox — a reset link has been sent."
- Link: "Back to Login"

**Style:** Minimal, single-field focus. Clear confirmation feedback after submission.

---

## Normal User Screens (Platform — Web App)

---

### 5. User Personal Dashboard
**Who uses it:** Normal User (logged in)
**Purpose:** Give the user a personal overview of their Hares AI activity.
**Elements:**
- Top navigation bar: Logo, page title "My Dashboard", profile avatar + dropdown (Profile, Settings, Logout)
- Left sidebar: navigation links — Dashboard, Activity Log, Blocked Messages, Prompt Revision, Profile & Settings
- Summary stat cards (row): Total Prompts Scanned, High Risk Blocked, Medium Risk Warned, Prompts Revised
- Risk Distribution chart: Donut or bar chart showing breakdown of risk levels over time
- Recent Activity table: columns — Date/Time, Platform, Risk Level (colored badge), Action Taken (Blocked / Warned / Allowed)
- Quick Actions: button "View Full Log", button "Revise a Prompt"

**Style:** Dashboard grid layout. Stat cards with icon + number. Risk level badges use color coding: red = High, amber = Medium, blue = Low, green = None. Neutral white/light grey panels.

---

### 6. User Activity Log
**Who uses it:** Normal User
**Purpose:** Browse the full personal history of scanned prompts and outcomes.
**Elements:**
- Page title: "My Activity Log"
- Filter bar: Date Range picker, Platform dropdown (ChatGPT / Gemini / Claude / All), Risk Level multi-select, Search bar (prompt text keyword)
- Results table: columns — #, Timestamp, Platform, Prompt Preview (truncated), Detected Entities, Risk Level badge, Action Taken
- Row click → expands or opens modal with full prompt text and full detection breakdown
- Pagination controls (or infinite scroll)
- Export button: "Export CSV"

**Style:** Clean data table. Alternating row shading. Risk badges color-coded. Filters in a compact top bar, not a sidebar.

---

### 7. Blocked Messages View
**Who uses it:** Normal User
**Purpose:** Review only the prompts that were blocked (High Risk) with reasoning.
**Elements:**
- Page title: "Blocked Messages"
- Same filter bar as Activity Log (pre-filtered to High Risk by default)
- Table: Timestamp, Platform, Prompt Preview, Blocked Entities list (highlighted keywords), Block Reason
- Row expand or modal: full prompt, full list of flagged entities with classification, explanation of why each entity was flagged
- "Revise This Prompt" button per row — opens Prompt Revision view with that prompt pre-loaded

**Style:** Same table style. Red-tinted row highlight or left border accent for blocked items.

---

### 8. Prompt Revision View
**Who uses it:** Normal User
**Purpose:** Get a sanitized / restructured version of a previously blocked or flagged prompt.
**Elements:**
- Page title: "Prompt Revision"
- Left panel: "Original Prompt" — read-only text area showing original text, flagged entities highlighted in red/amber
- Right panel: "Revised Prompt" — editable text area showing the AI-generated cleaned version
- Below right panel: "Suggested Structured Version" — alternate structured rewrite shown as a separate read-only block
- Action bar: "Copy Revised", "Use This Version", "Edit Manually", "Submit to [Platform]"
- Status label: shows which risk entities were removed/replaced

**Style:** Two-column side-by-side layout. Clear visual separation. Flagged entity highlights in original panel. Clean sans-serif font for readability.

---

### 9. User Profile & Settings
**Who uses it:** Normal User
**Purpose:** Manage personal account details and notification preferences.
**Elements:**
- Section: Personal Information — Full Name (editable), Email (read-only), Organization (read-only)
- Section: Change Password — Current Password, New Password, Confirm New Password, Save button
- Section: Notification Preferences — toggles for: Email alerts for High Risk blocks, Weekly activity summary
- Section: Extension Settings — toggle "Show Low Risk info banners" (synced with extension)
- Danger zone section: "Delete My Account" (with confirmation dialog)

**Style:** Vertical sections with clear headings and dividers. Save buttons scoped per section. Toggles use standard switch component.

---

## Department Admin Screens (Platform — Web App)

---

### 10. Department Dashboard
**Who uses it:** Department Admin
**Purpose:** Overview of risk activity within their specific department.
**Elements:**
- Top nav + left sidebar (same structure as normal user but with Department Admin links)
- Sidebar links: Department Dashboard, Department Log Review, User Management
- Summary stat cards: Total Users in Dept, Total Prompts Scanned (dept), High Risk Incidents, Avg Risk Level
- Risk trend line chart: daily/weekly risk incidents over time (filterable by range)
- Top Risky Users table: columns — User Name, High Risk Count, Medium Risk Count, Last Activity
- Platform usage breakdown: small bar chart — which AI platforms are used most by the department

**Style:** Same dashboard grid. Charts use chart.js or similar. Neutral palette with accent for risk severity.

---

### 11. Department Log Review
**Who uses it:** Department Admin
**Purpose:** Browse and audit all prompts submitted by users in their department.
**Elements:**
- Page title: "Department Log Review"
- Filter bar: User dropdown (all dept users), Date Range, Platform, Risk Level, Search
- Table: columns — Timestamp, User Name, Platform, Prompt Preview, Risk Level badge, Action Taken
- Row expand / modal: full prompt details, detection entities, Gemini AI analysis result (if used)
- Export button: "Export CSV" (dept-scoped)

**Style:** Same log table style. User column distinguishes this from personal log.

---

### 12. Department User Management
**Who uses it:** Department Admin
**Purpose:** View and manage users within the department (activate/deactivate, not role assignment).
**Elements:**
- Page title: "User Management — [Department Name]"
- Search bar + Status filter (Active / Inactive / All)
- Users table: columns — Name, Email, Status badge, Last Active, Actions (Activate / Deactivate button)
- Deactivate confirmation dialog: "Are you sure you want to deactivate [Name]? They will no longer be able to log in."
- User count summary at top: "12 Active · 2 Inactive"

**Style:** Standard admin table. Status badges: green = Active, red = Inactive. Action buttons are inline, small, secondary style.

---

## System Admin Screens (Platform — Web App)

---

### 13. Org-wide Dashboard
**Who uses it:** System Admin
**Purpose:** Top-level organizational overview of all risk activity across all departments.
**Elements:**
- Sidebar links: Org Dashboard, Full Log Review, User Management, Role Assignment, Department Management, System Configuration
- Summary stat cards: Total Users (org), Total Prompts (org), High Risk Incidents (org), Departments Count
- Stacked bar chart: risk level distribution per department (comparison view)
- Risk trend line chart: org-wide risk incidents over time
- Top Risky Departments table: Department Name, High Risk Count, Medium Count, Total Scans
- Recent High Risk Incidents list: last 10 high-risk blocks org-wide

**Style:** Wider layout to accommodate comparison charts. Same card/chart pattern. Department-level comparison is the key differentiator.

---

### 14. Full Log Review & Export
**Who uses it:** System Admin
**Purpose:** Audit all prompts across all users and departments org-wide.
**Elements:**
- Page title: "Full Activity Log"
- Filter bar: Department dropdown, User dropdown, Date Range, Platform, Risk Level, Search
- Table: columns — Timestamp, Department, User Name, Platform, Prompt Preview, Risk Level, Action Taken
- Row expand / modal: full prompt, full detection breakdown, AI analysis result
- Export button: "Export CSV" (org-wide, respects active filters)
- Bulk actions bar (appears on multi-select): Mark Reviewed, Flag for Follow-up

**Style:** Widest table in the system — consider horizontal scroll on smaller screens or collapsible columns. Filter bar is prominent.

---

### 15. User Management — All Users
**Who uses it:** System Admin
**Purpose:** Manage all user accounts across the entire organization.
**Elements:**
- Page title: "User Management"
- Filter bar: Department, Role, Status, Search
- Table: columns — Name, Email, Department, Role badge, Status badge, Last Active, Actions
- Actions per row: Edit (open edit panel), Deactivate / Activate, Delete
- Edit side-panel or modal: Name, Department assignment, Status toggle
- "Add User" button (top right): opens create user modal — Name, Email, Department, initial Role

**Style:** Same admin table pattern. Role badges color-coded: blue = System Admin, purple = Dept Admin, grey = User.

---

### 16. Role Assignment Screen
**Who uses it:** System Admin
**Purpose:** Assign or change user roles organization-wide.
**Elements:**
- Page title: "Role Assignment"
- Searchable user list: Name, Email, Current Role badge
- Inline role selector per user (dropdown: User / Department Admin / System Admin)
- "Save Changes" per row, or bulk "Apply All Changes" button
- Confirmation dialog before upgrading to System Admin: "This will grant full administrative access. Confirm?"
- Change history log (optional panel): recent role changes with admin name and timestamp

**Style:** Table-based, focused on the role column. Minimalist — not a full edit screen, just role management.

---

### 17. Department Management
**Who uses it:** System Admin
**Purpose:** Create, rename, and manage departments in the organization.
**Elements:**
- Page title: "Departments"
- Department list: Name, Member Count, Admin Assigned, Date Created, Actions (Edit, Delete)
- "Add Department" button → modal: Department Name, Assign Department Admin (user search/select)
- Edit Department modal: rename, reassign admin
- Delete confirmation: "This will unassign all users from this department. Proceed?"

**Style:** Simple list/table. Card or table row per department. Add/Edit modals are compact.

---

### 18. System Configuration
**Who uses it:** System Admin
**Purpose:** Configure global detection rules, risk thresholds, and platform settings.
**Elements:**
- Section: Detection Rules — table of active regex patterns (Pattern Name, Pattern Preview, Risk Level assigned, Status toggle), "Add Rule" button, "Edit" and "Delete" per row
- Section: Risk Thresholds — sliders or dropdowns to adjust sensitivity for each risk level category
- Section: Supported Platforms — toggles to enable/disable Hares AI enforcement on: ChatGPT, Gemini, Claude
- Section: AI Fallback (Gemini API) — toggle to enable/disable Gemini AI secondary analysis; API key input field (masked)
- Save Configuration button (sticky bottom bar)

**Style:** Vertical sections with dividers. Detection rules in a data table. Toggles and input fields for configuration values. Sticky save bar to avoid losing changes.

---

## Browser Extension UI

---

### 19. Extension Popup
**Who uses it:** Any logged-in user, via the browser extension icon
**Purpose:** Quick status check and access to key actions without opening the full web app.
**Elements:**
- Header: Hares AI logo + "Active" status indicator (green dot) or "Inactive" (grey dot)
- Logged-in user display: Name and email (small text)
- Quick stats: Today's scans count, Today's blocks count
- Toggle: "Enable / Disable Protection" (on this tab / globally)
- Link: "View My Dashboard" → opens web app in new tab
- Link: "View Activity Log" → opens web app log page
- Footer: version number, "Log Out" link

**Style:** Narrow popup (380px wide). Compact, vertically stacked. Minimal — no charts. Clean white background, brand accent color on the status indicator and toggle.

---

### 20. High Risk Alert Overlay
**Who uses it:** Normal User (triggered by extension at prompt submission)
**Purpose:** Block submission and inform the user that the prompt contains high-risk sensitive data.
**Elements:**
- Modal overlay injected into the AI platform page (centered, semi-transparent dark backdrop)
- Header: red warning icon + bold label "HIGH RISK — Submission Blocked"
- Body text: "Your prompt contains sensitive information that violates your organization's data policy."
- Detected entities list: each flagged item shown as a red-highlighted tag (e.g., "Saudi National ID", "Credit Card Number")
- Action buttons:
  - Primary (red): "Edit Prompt" — dismisses overlay, returns cursor to prompt input, highlights flagged text
  - Secondary (outline): "Revise with Hares AI" — opens Revision overlay
  - Tertiary (text link): "View Full Details" — opens Activity Log entry in web app
- Footer note: "Submission has been blocked and logged."

**Style:** High-contrast red accent for header. Clean modal, not aggressive — informative tone. Flagged entity tags visually distinct. No "dismiss and submit anyway" option at High risk level.

---

### 21. Medium Risk Alert Overlay
**Who uses it:** Normal User (triggered by extension at prompt submission)
**Purpose:** Warn the user about moderately sensitive data and let them decide whether to proceed.
**Elements:**
- Modal overlay with amber/yellow accent
- Header: amber warning icon + bold label "MEDIUM RISK — Review Before Sending"
- Body text: "Your prompt may contain information that could be sensitive. Please review before submitting."
- Detected entities list: amber-highlighted tags for each flagged item
- Action buttons:
  - Primary (amber): "Edit Prompt" — return to edit
  - Secondary (green outline): "Submit Anyway" — confirms and allows submission, logs the override decision
  - Tertiary (text link): "Revise with Hares AI"
- Footer note: "Your choice will be logged for audit purposes."

**Style:** Amber accent. Same modal structure as High Risk but with the "Submit Anyway" option present. Tone is advisory, not blocking.

---

### 22. Low Risk Info Overlay
**Who uses it:** Normal User (triggered by extension at prompt submission)
**Purpose:** Inform the user of a minor detection without interrupting their workflow significantly.
**Elements:**
- Smaller, non-blocking notification banner (bottom-right corner of screen, not a full modal)
- Blue info icon + label "LOW RISK — Info"
- One-line message: "A potentially sensitive term was detected. Submission allowed."
- Detected item shown as a small blue tag
- Action: "View Details" text link, and "×" dismiss button
- Auto-dismisses after 6 seconds if no interaction

**Style:** Compact toast/banner style, not a blocking modal. Blue accent. Unobtrusive — does not prevent the user from continuing.

---

### 23. Revision Suggestion Overlay
**Who uses it:** Normal User (triggered from High Risk or Medium Risk overlay, or from Blocked Messages in web app)
**Purpose:** Present a cleaned, AI-generated version of the flagged prompt inline so the user can accept and use it without leaving the AI platform.
**Elements:**
- Modal overlay (wider than Alert overlays)
- Header: "Hares AI — Suggested Revision"
- Left column: "Original Prompt" — read-only text area, flagged entities highlighted in red/amber
- Right column: "Revised Prompt" — editable text area with sensitive data removed or replaced with generic placeholders (e.g., "[ID Number]", "[Financial Data]")
- Below right: "Structured Version" toggle — shows an alternative structured rewrite
- Action buttons:
  - Primary: "Use Revised Prompt" — replaces prompt input on the AI platform with the revised text and closes overlay
  - Secondary: "Edit Manually" — copies revised text into left panel as editable, dismisses right panel
  - Tertiary: "Cancel" — closes overlay without any change
- Risk indicator: shows which entities were removed and what they were replaced with

**Style:** Two-column side-by-side. Clean white panels with a clear divider. Flagged entity highlighting in original panel. Revised panel has a subtle green left border to indicate it is the safe version.

---

*End of UI Screen Design Briefs — Hares AI, GP1*
