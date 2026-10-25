# B9 spike: charts in Arabic/RTL and the component library

Run on 2026-10-25 in the built-in browser (desktop and a 375 px phone), with the
real fonts and the page switched between `rtl` and `ltr`. The throwaway page was
`web/src/spike/SpikePage.tsx`; the reusable parts stayed in
`web/src/components/charts/`.

## 1. Chart library: Apache ECharts (confirmed)

ECharts renders Arabic correctly. Needed and proven:

| Finding | What we do |
| --- | --- |
| ECharts has no `rtl` switch. | `applyDirection()` mirrors an option once for every chart: category axis `inverse`, value axis on the right, legend centred and reversed, bar end labels flipped, tooltip `direction`. Unit-tested. |
| In an `rtl` container the SVG text anchors flip: legend labels ran over their markers. | The chart container is always `dir="ltr"`; mirroring lives in the option. Arabic text still shapes and orders correctly inside each label. |
| ECharts measures text once. Before the web font loads, Arabic labels overlap their markers. | `EChart` waits for `document.fonts` (IBM Plex Sans Arabic 400 and 600) before creating the chart. |
| Vertical category labels broke letter by letter (`المبيع/ات`) for long Arabic names. | Comparisons across departments and categories are **horizontal bars**; they also read better on a phone. |
| Pie labels were cut (`ChatGPT: ...`). | Donut with legend and tooltip only; no outside labels. |
| Numbers. | Western digits with grouping in both languages (`Intl`, `ar-SA-u-nu-latn`), one formatter for axes, labels and tooltips. |
| Renderer. | **SVG** (real DOM text: crisp in print, inspectable by tests and assistive tools). Canvas stays available. |
| Accessibility. | Each chart is `role="img"` with a name, and **every chart is followed by a "show data as a table" disclosure** with real `<th scope>` cells (WCAG 1.1.1). That table is the fallback; Chart.js was not needed. |
| Bundle size. | Only line, bar, pie, grid, legend, tooltip, aria and the two renderers are imported (tree-shaken `echarts/core`). |

Mobile (375 px): charts fit; the line chart skips some day labels (ECharts' automatic
interval), which is acceptable because the table lists every value.

## 2. Component library: shadcn/ui pattern + Tailwind with DGA-aligned tokens

Options evaluated:

* **DGA Platforms Code (official).** Launched by the Digital Government Authority in
  November 2024. Its documentation site (`design.dga.gov.sa`) is rendered by
  JavaScript and its pages we could read did not publish token values or a package
  name; the repository listed on Wikidata (`AzamX/dga-nds`) returned 404. We could
  **not verify** official hex values, components or a license.
* **`@dev-dga/*` (npm).** A React implementation of Platforms Code. It says it is
  *not affiliated with or endorsed by DGA*, its source is private, it has 1 star and
  no releases, and its accessibility and Figma-parity claims are self-reported. Too
  risky to build a graduation project on and to defend.
* **shadcn/ui pattern (Radix UI primitives + Tailwind CSS).** Components are our own
  code in the repo (we can explain every line), Radix gives tested keyboard and
  screen-reader behaviour, and Tailwind uses CSS logical properties for RTL.

**Decision:** Radix UI primitives and our own components styled with Tailwind v4,
on a token layer that follows the DGA / government design-system structure
(primitive tokens, then semantic tokens: colour, type, spacing, radius, elevation).
The tokens live in one file (`web/src/index.css`), so adopting the official values
later, if they become available, is a change to that file only. We **do not claim
DGA certification** (decision 9); the DGA design review in B12 to B14 is a review
of our screens against DGA guidance, not a certificate.

Token mapping (all text pairs checked for WCAG 2.1 AA contrast):

| Role | Token | Value |
| --- | --- | --- |
| Primary (Hares green) | `--color-primary` / `-hover` / `-soft` | `#0d6a40` / `#0b5535` / `#effaf4` |
| Text / muted text | `--color-text` / `--color-text-muted` | `#14201a` / `#55645d` |
| Surface / page / border | `--color-surface` / `--color-bg` / `--color-border` | `#ffffff` / `#f5f7f6` / `#d7dfdb` |
| Risk high / medium / low / none | `--color-risk-*` | `#c0261b` / `#b25e09` / `#1a6aa6` / `#6b7c74` |
| Focus ring | `--color-focus` | `#0b57d0` (3 px, offset 2 px) |
| Font | `--font-sans` | IBM Plex Sans Arabic (Arabic and Latin), self-hosted via `@fontsource` |

Risk is never shown by colour alone: a text label and an icon always accompany it.

## 3. Other stack choices recorded with this spike

* Vite + React + TypeScript, React Router, TanStack Query (server state), a small
  auth context, `react-i18next`, `react-hook-form` with the **same Zod schemas as the
  API** (from `@hares/contract`), Vitest + Testing Library, Playwright in B15.
* In development the SPA runs on `:1420` and proxies `/api` to the API, so the
  browser sees one origin exactly as in production (decision 27).
