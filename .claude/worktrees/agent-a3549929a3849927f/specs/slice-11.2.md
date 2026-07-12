# Slice 11.2 — Shell UX: per-panel routes, command palette, notification bell, mobile tab bar

> Web-only slice (apps/api untouched). Builds on the 11.1 kit (TanStack Query, Radix
> Dialog/Tabs/Toast, Skeleton, Kbd) and consumes two endpoints merged after the original
> spec was written: `GET /api/farm/search` (#56) and `GET /api/farm/due` (#57) — the
> adjustments below supersede the draft spec where they differ.

## Scope

### A. Per-panel routing + section tabs
- `components/router.ts` (still dependency-free): `pathForSection(key, panel?)`,
  `panelFromPath`, pure `resolveRoute(pathname, visibleSections)` and
  `useRoute() → { pathname, key, panel, navigate(key, { panel?, replace? }) }`.
- Canonicalisation contract: bare section path IS canonical for a section's **first**
  panel (`/finance` = feed); `/finance/feed` → replaceState `/finance`; unknown panel →
  first panel; unknown or role-hidden section → `/`. **All 10 Phase-10 URLs stay valid
  with no redirect.**
- AppLayout renders a Radix Tabs bar (triggers = real `<a>`s, manual activation,
  modified-click passthrough) for multi-panel sections and mounts **only the active
  panel** (perf: a section switch no longer fires every panel's queries).
- `document.title` = `Panel · Section · Brand` (single-panel: `Section · Brand`),
  language-reactive. Scroll/focus reset fires on panel change too.
- i18n: `nav.panels.*` — 27 keys, en + hi.

### B. Command palette + shortcut registry (new dep: `cmdk` v1.1.1, MIT)
- `components/commands.ts`: CommandItem registry (`buildCommands(role)` — sections,
  panels of multi-panel sections, and 6 v1 navigation actions: new batch, record
  expense, daily log, attendance, new invoice, record temperature), double-gated by
  action-role list AND destination-section visibility; `SHORTCUTS` + `GOTO` tables;
  pure `nextChord` reducer (1 s g-sequence window).
- `CommandPalette.tsx` (cmdk inside the 11.1 Dialog): matches on active-language AND
  English labels; ≥2 chars triggers a 250 ms-debounced `GET /api/farm/search` rendered
  as a Results group whose rows deep-link via the route hints; Enter runs + closes.
- `useHotkeys.ts`: one window listener — Ctrl/Cmd+K toggle (works with palette open),
  `/` open, `?` help, `g`+letter jumps (hidden section = no-op); ignores
  input/textarea/select/contenteditable and open dialogs; Esc left to Radix.
- `ShortcutHelp.tsx`: `?` cheat-sheet rendering the same registry with `Kbd` chips.

### C. Notification bell (v1 — client-composed, no new API)
- Two polled queries (60 s interval / 55 s staleTime): `GET /api/farm/risk?status=OPEN`
  + `GET /api/farm/due?days=7` (composed vaccinations/maintenance/EMI/insurance/tasks).
- Pure `bell.ts`: `normalizeBell` (undated vaccinations/tasks pin to today's IST
  midnight; reminders grade WARNING when due/overdue, INFO when upcoming),
  `unreadCount(items, lastSeen, now)` — future-dated items are listed under
  *Upcoming* but never counted; `groupBell` (Today / Earlier / Upcoming, IST days).
- Unread = per-farm `localStorage['ifm.bell.lastSeen.<farmId>']`; opening (or "Mark all
  seen") writes it. Badge caps at 9+.
- Rows: severity Badge + i18n text + `Intl.RelativeTimeFormat` time; click deep-links
  via the router; inline risk **Acknowledge** (OWNER/MANAGER, matching the server gate)
  through `useApiMutation` (toast + invalidate). Loading skeleton / error+retry /
  friendly empty states. Capped at 20 items with a "+n more" footer.
- Sidebar reuses the risk query (same key — deduped) for an attention dot on the
  section containing open risks.

### D. Role-filtered nav + mobile bottom tab bar
- `Section.roles?: Role[]` + `visibleSections(role)` per the spec matrix (LABOUR =
  overview/livestock/daily/health/sales/maintenance; BUYER = overview only; VET and
  ACCOUNTANT per matrix). Applied to sidebar, drawer, palette, tab bar and route
  resolution. **UX only — server RBAC remains the real guard.**
- `MobileTabBar.tsx` (`lg:hidden`): role-aware 4 primary sections + More (opens the
  existing drawer); real `<a>`s, `aria-current` active state, safe-area padding;
  `<main>` gets `pb-24 lg:pb-6`.
- Collapsed sidebar rail swaps `title` attrs for the 11.1 Tooltip.

### E. i18n per-namespace split (enabler for 11.6 parallel agents)
- `src/i18n/{en,hi}.ts` → `src/i18n/{en,hi}/<namespace>.ts` + index (39 en / 19 hi
  files; pure move, every key preserved). New namespaces `palette`, `shortcuts`,
  `bell` added to `CORE_NS` (parity-enforced en + hi).

## Acceptance criteria — all verified

- [x] `/finance/invoices` cold-load shows Finance/Invoices tab; refresh/back/forward
      keep it (verified live: Back `/finance/invoices` → `/finance` reselects Feed).
- [x] 10 legacy URLs unchanged & canonical; `/finance/feed` → `/finance`;
      `/finance/nope` → `/finance`; `/nope` → `/`; hidden-role URL → `/` (live:
      LABOUR `/finance` → `/`). Router tests cover the full §A2 matrix + round-trips.
- [x] Only the active panel mounts.
- [x] `document.title` `Invoices · Feed & Finance · Samagra Krishi`; switches with
      language (live: `मौसम · सूचना · समग्र कृषि`).
- [x] Ctrl/Cmd+K + `/` open the palette; typing filters; Enter navigates; role gates
      hold (live: LABOUR palette = 6 sections, 2 actions, no invoice/finance); `g f`
      jumps to Finance; `?` opens the cheat-sheet; typing contexts ignored.
- [x] Global search: typed `br` → batch results from `/api/farm/search`; clicking a
      hit navigated to Livestock/Batches.
- [x] Bell: badge 4 → open → grouped items with severity + relative time; mark-seen
      persisted per farm (badge cleared); ack → toast + refetch (row count 4→3); row
      click deep-linked to Intelligence; empty/loading/error states implemented.
- [x] Mobile (<lg, live at 961px + jsdom tests): bottom bar with role tabs + More →
      drawer; active state; `pb-24` keeps content clear; no horizontal scroll.
- [x] LABOUR sees no Finance/Settings/Reports/Intelligence anywhere (sidebar, drawer,
      palette, tab bar, direct URL).
- [x] typecheck / lint / build green; **152 web tests** (93 baseline + 59 new: router
      canonicalisation, visibleSections matrix, commands + chord reducer, bell unread/
      normalize/grouping, palette hotkey/filter/search/role, tabs, bottom bar, bell
      component incl. ack + mark-seen); i18n parity green (19 hi namespaces); zero raw
      palette classes.
- [x] New dep noted: `cmdk` 1.1.1 (MIT, actively maintained — powers Linear/shadcn
      Command). No API/schema changes; non-§1.4.

## Deferred / notes
- True 360 px pixel pass was blocked by an OS-pinned browser window during the live
  check (mobile layout verified at 961 px + component tests); covered again at the
  Phase-11 end-of-phase staging sweep.
- Palette "create" actions open the target panel (navigation-only v1); in-place create
  dialogs arrive with the 11.6 panel sweep. Unified notification inbox API supersedes
  the client-composed bell in a later slice.
