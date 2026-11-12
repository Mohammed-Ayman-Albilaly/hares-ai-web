# DGA compliance — Hares AI web

Status: **foundation only**. The token system, touch targets and shared
components are in place. This is **not** a claim of DGA certification or full
compliance; the manual and automated evidence listed under "Still needs manual
validation" has not all been produced yet.

## Reference rules

These are the rule areas the UI is reviewed against. They live in the DGA agent
package, not in this repository.

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
- Radius: 4 / 8 / 10 / 12 / 16 px; cards use 12 px with a visible border and
  no resting shadow (`--shadow-sm: none`); shadows are reserved for overlays.
- Headings: weight 600, no serif; Arabic headings use IBM Plex Sans Arabic at 600.
- Touch target: `--target-min: 44px`, applied to `.btn`, `.btn-sm`, `.nav-link`,
  `.field input/select`, `.control` and the `Toggle` button (44×44 hit area with
  a compact visible track).
- Sidebar breakpoint remains **900px** (not changed in this phase).

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

## What was checked automatically

- `pnpm --filter @hares/web typecheck` — TypeScript, no errors.
- `pnpm --filter @hares/web test` — Vitest, **99 tests in 8 files pass** after
  every phase step. This includes `jest-axe` checks on the login, landing,
  department users, activity and audit screens.
- `i18n.test.ts` — Arabic/English key parity and no Arabic-Indic digits.
- The contrast ratios above were calculated from the hex values (WCAG relative
  luminance); they have not yet been re-measured in a browser.
- Charts (DGA phase 3, group 3): every chart colour, the tooltip box, the
  gridlines and the axis text come from the tokens, so a chart follows the
  light/dark theme; counts take the Saudi-green accent and only risk levels use
  the risk colours; the risk pie carries four decal patterns so it is readable
  without colour. Measured in the browser in both themes and in Arabic RTL
  (computed fills, decal ink, tooltip surface, legend order, no page overflow
  at 360px).

## What still needs manual validation

1. **Contrast in the browser.** Verify the computed colours in both themes with
   DevTools or an axe browser run; the table above is calculated, not measured.
2. **Touch targets on real devices.** Confirm 44×44 on 375px and 768px, especially
   the Toggle, table row actions, the modal close button and the password reveal.
3. **Screen reader pass (NVDA / VoiceOver) in Arabic.** Route announcements,
   dialog focus return, the audit detail `<bdi>` rendering, and the mixed
   Arabic/English content.
4. **RTL layout pass.** Sidebar drawer, tables, date inputs, the audit detail
   pills, and the landing hero at 375px.
5. **Browser E2E.** `pnpm e2e` could not run in this environment: the database
   server was not reachable (`set DATABASE_URL and APP_DATABASE_URL (api/.env)`).
   The Playwright/axe suite must be run where a test database is available.
6. **Reduced motion and zoom.** Confirm 200% zoom, reflow at 320px, and
   `prefers-reduced-motion` on the drawer and dialogs.
7. **Official DGA review.** No certification has been requested or received.

## Known gaps after Phase 2

- No toast component; success is shown inline.
- The full-suite Vitest run showed two route-guard timeouts once under parallel
  load; both passed in isolation and in later full runs. Treat as flaky, not fixed.
