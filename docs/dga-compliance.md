# DGA compliance — Hares AI web

Status: **complete, pending the manual validation listed below — and not a certification claim.** The
token system, the shared components and every screen are on one identity, and the checks listed below
were run and passed. That is the whole of the evidence: nothing here is a DGA review, an audit result
or a statement that the product is DGA-compliant. Where something was not verified, this document says
so.

## Reference rules

These are the rule areas the UI is reviewed against. They live in the DGA agent package, not in this
repository.

| File | Area |
| --- | --- |
| `rule-foundations.md` | Colour, type, grid, spacing, radius, elevation, visual consistency, RTL as the base |
| `rule-typography.md` | Sizes, weights, line height, Arabic, numbers, contrast, heading order, tracking |
| `rule-ui-shell.md` | Header, sidebar, footer, skip link, mobile and tablet behaviour |
| `rule-actions-components.md` | Buttons, links, fields, selects, switches, dialogs, touch targets, loading and disabled states |
| `rule-content-display.md` | Copy, headings, tables, lists, alt text, language parity |
| `rule-data-display.md` | Tables, charts, cards, numbers, sorting, paging, data states |
| `rule-feedback.md` | Errors, success, alerts, dialogs, `aria-live` |
| `rule-loading-and-status.md` | Skeletons, spinners, loading, empty, error and status states |
| `rule-navigational.md` | Menus, links, current page, breadcrumbs, tabs, route changes |
| `rule-search-and-filters.md` | Search, filters, clear, empty results, paging |

## Design tokens

Implemented in `web/src/index.css`.

- Primary action colour: Saudi green `#006C35`; hover `#00552A`; soft `#EAF7EF`.
- Dark theme primary: `#34D399` with `#052E1A` text.
- Neutral text scale: `#0F172A` / `#334155` / `#475569` / `#5B6B80`.
- Control border: `#64748B` (4.8:1 on white, ≥3:1 on every surface).
- Semantic: success `#166534` on `#E6F5EB`, danger `#B91C1C` on `#FEE9E9`,
  warning `#92400E` on `#FEF2DC`, info `#1D4ED8` on `#EAF0FF`.
- `--success` / `--warning` / `--danger` / `--info` (and their `-soft` values) are aliases of
  those, so a component says what a colour *means*. Risk colours are for risk levels only: a data
  category, a status or a warning takes the semantic name.
- Radius: 4 / 8 / 10 / 12 / 16 px; cards use 12 px with a visible border and no resting shadow
  (`--shadow-sm: none`); shadows are reserved for overlays.
- Headings: weight 600, no serif; Arabic headings use IBM Plex Sans Arabic at 600.
- Touch target: `--target-min: 44px`, applied to `.btn`, `.btn-sm`, `.nav-link`,
  `.field input/select`, `.control` and the `Toggle` button (44×44 hit area with a compact visible track).
- Sidebar breakpoint: **900px**.
- Table system: one `table.h-table` (header 12.5px at weight 600 on the `--surface-2` band, body 13.5px
  at 1.45 line-height, row hover on `--surface-3`) with cell helpers — `.cell-muted`, `.cell-nowrap`,
  `.cell-figures`, `.cell-num` (end-aligned with tabular figures) and `.cell-actions` (a 44px control sets
  the row height, not its padding). Arabic table text takes no tracking.
- Pills: `.h-pill` at 11.5px with risk, status and role variants, plus `.h-pill-neutral` for a value
  that is neither a status nor a risk level.
- Inline messages: `.err` (12.5px, danger colour, inside or outside a `.field`) and `.hint` (12px, muted).

## Contrast table (WCAG 2.1 AA)

| Pair | Ratio | Result |
| --- | --- | --- |
| `#006C35` on `#FFFFFF` | 6.6:1 | AA normal text, AAA large text |
| White on `#006C35` | 6.6:1 | AA normal text |
| `#00552A` on `#FFFFFF` | 9.0:1 | AAA |
| `#006C35` on `#EAF7EF` | 6.0:1 | AA |
| `#0B5C6B` on `#FFFFFF` | 7.6:1 | AAA |
| `#0F172A` on `#FFFFFF` | 17.9:1 | AAA |
| `#334155` on `#FFFFFF` | 10.4:1 | AAA |
| `#475569` on `#FFFFFF` | 7.6:1 | AAA |
| `#5B6B80` on `#FFFFFF` | 5.4:1 | AA |
| `#5B6B80` on `#F1F5F9` | 4.8:1 | AA |
| `#64748B` as a control border on `#FFFFFF` | 4.8:1 | ≥3:1 non-text |
| `#166534` on `#E6F5EB` | 6.3:1 | AA |
| `#B91C1C` on `#FEE9E9` | 5.6:1 | AA |
| `#92400E` on `#FEF2DC` | 6.4:1 | AA |
| `#1D4ED8` on `#EAF0FF` | 5.9:1 | AA |
| `#34D399` on `#0F172A` (dark) | 9.3:1 | AAA |
| `#F87171` on `#0F172A` (dark) | 6.5:1 | AA |
| `#94A3B8` on `#0F172A` (dark) | 7.0:1 | AAA |

`#94A3B8` on white is 2.6:1 and is **not** used for text or control borders.

## What changed, phase by phase

| Step | What changed | Rule areas |
| --- | --- | --- |
| Phase 1 | Tokens in `index.css` (Saudi green and its dark value, neutrals, semantic and risk colours, `--target-min: 44px`); `IconButton`, `Textarea`, `Checkbox`; `Toggle` at 44×44; RTL and i18n fixes; `RouteAnnouncer` | foundations, typography, actions-components, navigational |
| Phase 2 | Sidebar, top bar, account menu and phone drawer; `Page` (linked breadcrumb, one actions row, the single `main#main`); `Card`/`Section`/`Stat`/`FilterBar`; `PaginationBar`; `DataState`, skeletons, empty and error states; `Modal`/`ConfirmModal` (44px close, Info icon for a non-destructive action); badges with dots | ui-shell, navigational, data-display, feedback, loading-and-status |
| Group 1 | Landing page and 404 on the new identity: IBM Plex display headings, Saudi-green accent, cards, a way home that knows the role | foundations, typography, content-display |
| Group 2 | Auth screens on the shared `Card` (`AuthShell`, public header and footer, `AuthMark` state icons, direction-aware back links) | content-display, navigational, typography |
| Hotfix | One `TableScroller` for every table scroll region: focusable, named after the caption (axe `scrollable-region-focusable`) | data-display, navigational |
| Group 3 | Charts on the tokens: shared frame/axis/legend helpers, counts in Saudi green, risk colours with decal patterns on the donut, the chart table view in a focusable scroller, a note instead of an empty chart, "show as table" as a plain action | data-display, foundations, typography |
| Group 4 | USER screens: the `h-table` header and cell system, neutral category pills, a 44px row-expand control in its own cell, one shared inline error style, semantic success/danger on the profile page, a real heading instead of a duplicated page title | data-display, typography, feedback, content-display, actions-components |
| Group 5 | DEPARTMENT_ADMIN screens: numeric columns end-aligned with tabular figures, cell helpers instead of inline styles, policy rows that announce their save (`aria-busy` and a polite status cell), rule definitions aligned to their column in Arabic (the wrapper takes the cell alignment, the code keeps its own direction), the user filter that explains why it is unavailable, the TOPIC warning on the warning token | data-display, typography, RTL, feedback, loading-and-status, search-and-filters |
| Group 6 | SYSTEM_ADMIN screens: a named account-menu trigger, one `DepartmentSelect` with a visible load-failure message used by five screens, cell helpers across the users, pending, audit, departments and rules tables, numeric columns in the comparison matrix and the chart tables end-aligned, the audit date-range error wired to its field, email cells aligned to their column in both directions | actions-components, ui-shell, data-display, typography, feedback, search-and-filters |
| Group 7 | Error and loading screens: the forbidden page on the 404 identity with its own `main#main` and document title, the full-page loading screen announced once, the route error offering both a reload and a way home, the sidebar account email aligned like the rest | content-display, feedback, loading-and-status, navigational, ui-shell |
| Group 8 | 404 gains `main#main` and a document title; the two route-guard tests get a 10s timeout (they render the whole router and can pass 5s under parallel load); this document | navigational, content-display |

## What was checked automatically

Run on this machine after every step above:

- `cd web && npx tsc --noEmit` — TypeScript, no errors.
- `cd web && npx eslint src --max-warnings=0` — no problems.
- `cd web && npx vitest run` — **100 tests in 8 files pass**. This includes `jest-axe`
  checks on the login, landing, department users, activity and audit screens, the route-guard
  behaviour of every role, and `i18n.test.ts` (Arabic/English key parity, no empty value, no
  Arabic-Indic digits).
- The contrast ratios in the table above are calculated from the hex values (WCAG relative
  luminance). Two of them were also measured in a browser — see the next section.

Run by CI, not by hand on this branch:

- `.github/workflows/ci.yml` runs `pnpm -w typecheck`, `pnpm lint`, `pnpm -r --if-present test`
  and the API end-to-end suite, then **`pnpm e2e`**: the Playwright suite against a real API on a
  throwaway database, which runs axe-core (WCAG 2.0/2.1/2.2 A and AA tags) on every screen of every
  role in Arabic and the light theme, on the public pages in English, on four admin screens in the dark
  theme, and on the approve, manage and rule dialogs while open — plus the keyboard, skip-link,
  drawer-focus and 375px reflow checks.
- That browser suite was not run locally (this environment has no database: `set DATABASE_URL and
  APP_DATABASE_URL (api/.env)`). It runs in CI on pull request #1, and it has passed on every push since
  the `TableScroller` hotfix — most recently after group 7 (54 tests).

## What was measured in a browser

Only what is listed here was measured; everything else in this document is either checked by the tests
above or still open.

- **Charts (group 3)**, both themes and Arabic RTL: computed fills, decal ink, the tooltip surface, the
  gridline and axis colours, legend order, and no page overflow at 360px.
- **Tables and pills (group 4)**: header 12.5px at weight 600 in Arabic and 12px uppercase with 0.03em
  tracking in English; body 13.5px at 1.45 line-height; header contrast `#475569` on `#F3F5F3` = 6.92:1;
  neutral pill `#334155` on `#ECEFEC` = 8.94:1; row hover `#ECEFEC` in light and `#1C2946` in dark; the
  row-expand control 44×44 at 1280px and at 360px; the single focus ring (3px accent, 2px offset) on the
  control and on the table's scroll region; at 360px the page did not scroll sideways (350/350) while the
  table scrolled inside its named region (785/317); the invalid date range rendered at 12.5px in `#B91C1C`
  with `role="alert"` and `aria-invalid` on the field.
- **Error screens (groups 7 and 8)**: the forbidden page and the 404 both render the card identity
  (wordmark, 403/404, display heading), expose exactly one `main#main` that takes focus, set their own
  document title, and offer the role's home (`/dashboard` for a USER); the sidebar account email sits on the
  block's inline-start edge in Arabic.
- **Groups 5 and 6 were not measured in a browser**: the toolchain was unavailable in those sessions, so
  they rest on typecheck, lint and the unit suite.

## What still needs manual validation

1. **Screen reader pass (NVDA / VoiceOver) in Arabic.** Route announcements, the route guard screens,
   dialog focus return, the audit detail `<bdi>` rendering, the policy row that announces its save, and the
   mixed Arabic/English content.
2. **Touch targets on real devices.** Confirm 44×44 at 375px and 768px, especially the `Toggle`, table row
   actions, the modal close button and the password reveal.
3. **Zoom and reflow.** 200% zoom, reflow at 320px, and `prefers-reduced-motion` on the drawer, the dialogs
   and the chart animations.
4. **Contrast measured in a browser, outside the charts.** Only two table pairs and the chart palette were
   measured; the rest of the table above is calculated and needs a browser or axe pass in both themes.
5. **Official DGA review.** No review has been requested or received, and this document is not a claim of
   certification.

## Known gaps

- No toast component: success is shown inline next to the action that caused it.
- `web/src/features/policy/PolicyTable.tsx` is dead code — nothing imports it (`PolicyMatrix` is what the
  admin policy page renders). It was kept consistent with the other tables rather than deleted in a screen group.
- `RuleForm` carries an `id="rule-enabled-label"` that nothing references; the `Toggle` has its own
  accessible name.
