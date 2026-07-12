# Spec — Slice 0.5: App shell + design system + i18n + PWA shell

**Phase:** 0 · **Branch:** `phase-0/slice-0.5-shell-pwa` · **Not a §1.4 trigger** (frontend only)

## User story
As a **user on a low-end phone**, I want an installable, responsive app shell with consistent UI and a language toggle, so the app feels like a real product and works offline at least for its shell.

## Scope
**In:** design tokens + shadcn-style UI primitives (`cn`, Button, Input, Card, Badge) on Tailwind; a responsive **AppShell** (header: brand, farm switcher, language toggle, sign out) working at 360px; refactor existing panels onto the primitives; **i18n** language toggle (English + a Hindi seed, fallback to en); **PWA** via vite-plugin-pwa (manifest + service worker, offline app-shell precache, installable) with icons.
**Out:** offline *write* queue / background sync (Phase 2), full shadcn component library, Lighthouse/a11y deep pass (0.8), Playwright e2e (added when offline-sync lands in Phase 2).

## Acceptance criteria (Given/When/Then)
1. **Design system** — buttons/inputs/cards render from shared primitives with consistent tokens (brand color, radius, 44px targets); no ad-hoc button styling left in panels.
2. **App shell** — when authenticated, a header (brand + farm switcher + language + sign out) and content area render cleanly at **360px** (no overflow); login screen unchanged for unauthenticated.
3. **i18n toggle** — switching language updates visible copy live; Hindi shows seeded keys, missing keys fall back to English; **no hard-coded strings**.
4. **PWA** — `pnpm --filter @ifm/web build` emits a service worker + `manifest.webmanifest` referencing 192/512 icons; manifest has name, theme color, `display: standalone`, start_url; app shell is precached for offline load.
5. **Regression** — typecheck/lint/build green; existing auth + farm/unit flows still work.

## Verification
- Build output contains `sw.js`/`workbox-*` + `manifest.webmanifest` + icons (grep dist).
- Manual: app renders at 360px; language toggle flips copy. *(Full install/offline + Lighthouse → 0.8; Playwright e2e → Phase 2.)*

## DoD
Per CLAUDE.md §2. Staging deploy deferred to 0.6.
