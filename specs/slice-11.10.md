# Slice 11.10 — Visual polish (design-award pass)

Web-only. Implements the Designer's polish kit end-to-end: `polish-audit.md` (24 items),
`chart-spec.md` + `chart-tokens.css`, `motion-standard.md`, `illustrations.tsx` —
plus a full-app pixel sweep and a Lighthouse audit. No new runtime dependencies.
No backend, schema, auth, or money-logic changes (§1.4 not triggered).

## Acceptance

- Every polish-audit item implemented (or explicitly owner-gated / documented).
- Charts app-wide on the validated `--chart-1..5` tokens; zero hardcoded chart hexes.
- Motion standard applied exactly (durations, recipes, DON'T list respected).
- 8 spot illustrations render correctly in light + dark (verified visually).
- Pixel sweep of every panel at 360×740 + 1280×800, light + dark, reviewed;
  defects fixed; zero horizontal page overflow.
- Lighthouse ≥90 A11y / Best-Practices / SEO on the audited route; Performance reported honestly.
- typecheck / lint / build green; 323-test web baseline + new tests pass; api untouched (378); e2e 5/5.

## Audit checklist (polish-audit.md)

| # | Item | Status |
|---|---|---|
| P1-1 | Dashboard chart hexes → chart/status tokens (2.54:1 dark failure) | ✅ `SEV_HEX`/`REVENUE_HEX`/`COST_HEX` deleted; `ui/chart.ts` `severityColor()` + `CHART_SERIES` |
| P1-2 | Dialog off-center animation | ✅ `slide-in-from-left-1/2` + `slide-in-from-top-[48%]` (+ closed pairs), overlay 200/150ms |
| P1-3 | AA-failing small colored text | ✅ `--success/warning/accent-ink` tokens (light) + dark aliases; Badge/TrendChip/ColdGauge/Circularity on `text-*-ink`; dark `--destructive` → `4 70% 62%` (foreground flipped dark so fills still pass) |
| P1-4 | No press feedback | ✅ Button base: `transition duration-150 active:scale-[0.98] active:duration-100`; icon buttons `active:scale-95` |
| P1-5 | Touch targets <44px | ✅ Dialog/Toast closes, weather refresh, onboarding dismiss → 36px visual + `after:-inset-1.5` extended hit area; finance period switcher → segmented control with `min-h-9` + vertical hit extension |
| P1-6 | Invisible keyboard focus | ✅ Shared `FOCUS_RING` on KPI tiles, quick-action cards, Today links, risk rows, inline links; sidebar nav + collapse get `ring-accent/70` (gold reads on pine) |
| P2-7 | Recharts ignores reduced motion | ✅ `chartAnim()` (`isAnimationActive: !prefersReducedMotion()`, 600ms ease-out) on every Bar/Pie/Line/Area |
| P2-8 | Two ad-hoc tooltips on wrong surface | ✅ `ui/ChartTooltip` (+`ChartTooltipFrame`) on popover tokens; Dashboard/Cold/Market/Circularity adopted |
| P2-9 | MarketBars two-hue value gradient | ✅ solid `hsl(var(--chart-1))`; 8% floor kept + documented (real value label at right) |
| P2-10 | Three inset sub-surface treatments | ✅ standardized on `bg-secondary/60` (Today groups, Panel sub-pill; SubPanel already) |
| P2-11 | `rounded-xl` not token-coupled | ✅ app-wide `rounded-xl` → `rounded-md` (identical 12px today; now tracks `--radius`) |
| P2-12 | Skeletons mismatch content heights | ✅ finance h-48, donut h-[150px], cold h-[88px], alerts h-44; empty states share the same fixed heights |
| P2-13 | Dropdown/Tooltip exits + origins | ✅ Radix transform origins, exit zoom, per-side slides, 150/100ms |
| P2-14 | Toast exit timing mismatch | ✅ `data-[state=closed]:duration-200` matches `EXIT_MS` |
| P2-15 | Three focus-ring dialects | ✅ controls = `ring-ring` + offset-2; inset contexts (rows/tabs/cards) = `ring-ring/60 ring-inset` |
| P2-16 | DataTable sticky header dead | ✅ wrapper is now the scroll container (`max-h-[70vh] overflow-auto`) so the header actually sticks |
| P2-17 | Generic empty icon; `text-success` empties | ✅ EmptyState `illustration` prop + 8 spots wired app-wide; `allClear` only for genuinely-good empties, rest muted |
| P3-18 | KPI hover shadow without lift | ✅ `motion-safe:hover:-translate-y-0.5` on small clickable tiles only |
| P3-19 | Onboarding gradient meter | ✅ solid `bg-primary` on `bg-muted` track |
| P3-20 | Gold hairline Panel is Dashboard-local | ✅ promoted to `ui/Card` `lined` variant; Dashboard Panel consumes it |
| P3-21 | Period switcher without container | ✅ segmented control (`rounded-full bg-secondary/60 p-0.5`, active `bg-primary`) |
| P3-22 | Sidebar active rail pops | ✅ rail fades in (`motion-safe:animate-in fade-in-0 duration-150`) |
| P3-23 | Alert timeline dot always primary | ✅ dot colored by delivery status (FAILED→destructive, PENDING→warning, else primary) |
| P3-24 | `farm/DashboardPanel.tsx` dead code | ⚠️ flagged only — file deletion is §3 (owner approval); unchanged |

Also from the kit:
- Section-mount fade (motion §3.1) in `AppLayout`; KPI-row stagger (§3.2, 40ms steps,
  `fill-mode-backwards`); `useCountUp` (§5) on profit hero + 4 KPI numerals
  (display-only, `.tabular` held; never feeds calculations — §0 money rule).
- Optimistic task-completion check zooms in 200ms (§4).
- DON'T list respected: no DataTable row animations, nothing >300ms (chart draw-in
  600ms is the sanctioned exception), no layout-property animation, no infinite motion.
- `useCountUp` deviates from the kit in one line (bug fix): the animation start is
  anchored to the FIRST rAF timestamp instead of `performance.now()` — rAF timestamps
  only guarantee a shared origin with each other, not with the caller's clock.
- Mortality line stays `--destructive` (status semantics, not a series-identity slot) — deliberate.
- Illustration render-check: all 8 spots rendered at 108px in light AND dark via a
  temporary static-gallery harness (react-dom/server + built CSS + Playwright shot),
  inspected visually — strokes/washes/gold accents all correct, no geometry glitches.
  Harness removed after the check.
- Remaining hex in live code: `AnimalsPanel` QR canvas `#ffffff` — functional
  (QR quiet zone must be white), not a UI color.

## Pixel sweep (`e2e/screenshots.e2e.ts`, skipped by default)

`SCREENSHOT_SWEEP=1 pnpm --filter @ifm/web e2e screenshots` — logs in as the seeded
owner, screenshots all 29 panel routes at 360×740 + 1280×800 in light + dark
(116 shots) into `apps/web/e2e/.screens/` (gitignored), and soft-asserts zero
horizontal page overflow per route.

Reviewed all 116 shots (Read the PNGs). Defects found → fixed:

| # | Defect (viewport/theme) | Root cause | Fix |
|---|---|---|---|
| S1 | Dark-theme shots rendered in the light theme (harness bug — not a UI defect, but it hid real dark defects) | `ThemeToggle` only reflects the `.dark` class set pre-paint; the harness set `localStorage` after the first load and never reloaded (SPA nav) | Seed `localStorage['ifm.theme']` via `page.addInitScript` so the no-flash script applies `.dark` at first paint |
| S2 | Login-screen shots mid-sweep (mobile, both themes) | full `page.goto()` per route re-ran refresh-token rotation and occasionally raced it, dropping the session | Navigate via `pushState` + `popstate` (what the in-app router listens to) — one real load, no rotation races |
| S3 | **Topbar right cluster overflowed 6px at 360px on every route** (real UI defect) | farm-switcher `max-w-[9rem]` + bell + theme + avatar summed past 360px | farm switcher → `max-w-[7.5rem]` at mobile (`sm:max-w-[14rem]` unchanged) |
| S4 | **Dashboard added ~124px horizontal scroll at 360px** (real UI defect) | decorative 560px contour SVG (`absolute right-0`) spills past the left edge | `overflow-x-clip` on the dashboard root (Radix menus are portaled — safe) |

After S3/S4: **zero horizontal overflow on all 29 routes × 2 viewports × 2 themes** (116/116 shots,
soft-assert green). No wrap/truncation/contrast defects found in the reviewed panels — charts render
on the series tokens in both themes, status text uses the AA `-ink` tokens, illustrations render
cleanly in light and dark.

## Lighthouse

Production build (`pnpm --filter @ifm/web build`) served via `vite preview`; audited the
login/landing route (the authed dashboard needs the API + a live session — out of scope
for a static route audit). `npx lighthouse --preset=desktop` and the mobile default,
`--chrome-flags="--headless=new"`.

| Route / form-factor | Performance | Accessibility | Best-Practices | SEO |
|---|---|---|---|---|
| Login · **desktop** · before | 100 | 98 | 96 | 91 |
| Login · **desktop** · after | **100** | **100** | **100** | **100** |
| Login · **mobile** · after | 88 | **100** | **100** | **100** |

Cheap wins implemented (before → after):
- **A11y 98→100:** wrapped the pre-auth `CenterShell` content in a `<main>` landmark
  (`landmark-one-main`); the `-ink` text tokens already covered contrast.
- **SEO 91→100:** added `robots.txt` + `<meta name="description">` in `index.html`.
- **BP 96→100:** the console 404 was the missing favicon — added `favicon.svg`
  (`<link rel="icon">`) + `<meta name="color-scheme" content="light dark">`.

Performance reported honestly: **desktop 100**; **mobile 88** — mobile is throttled
(simulated slow 4G + 4× CPU); FCP 2.9s / LCP 3.2s on the SPA entry bundle. Not a
regression from this slice (visual-polish is CSS/token/motion, no bundle growth of
note) and above the ≥90 target for A11y/BP/SEO; the mobile-perf entry-bundle work is a
separate performance slice. `llms-txt` is the only remaining <1.0 audit (an unweighted
agentic-browsing hint, not one of the four scored categories).

## Verification

- `pnpm typecheck` — green (web + api + shared).
- `pnpm lint` — green.
- `pnpm test` — **web 336** (323 baseline + 13 new: `lib/motion.test.ts` ×5, `ui/chart.test.tsx` ×8),
  **api 378** (untouched).
- `pnpm --filter @ifm/web build` — green (PWA precache regenerated).
- `pnpm --filter @ifm/web e2e` — 5/5 journeys green (the sweep spec is skipped by default).
- Zero raw palette classes in live code (grep) — only remaining hex is `AnimalsPanel`
  QR canvas `#ffffff` (functional white quiet-zone, not a UI color).
