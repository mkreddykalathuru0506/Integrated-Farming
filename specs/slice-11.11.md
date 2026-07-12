# Slice 11.11 — Landing front door (marketing page for logged-out users)

## Problem

The logged-out experience is a bare centered sign-in card. First impression does not match
the modern app behind it. Replace it with a proper product landing page on the Harvest
design language.

## Scope (web-only, non-§1.4)

1. **Landing page** at `/` for unauthenticated users (`apps/web/src/landing/`):
   top bar (brand, language toggle, theme toggle, Sign in), HERO (headline/subline,
   "Get started" + "Sign in" CTAs, coded product mock built from kit components/tokens —
   no bitmaps), four feature sections with inline stroke-style artwork in the
   "inked field-sketch" family (1.75px currentColor strokes, one gold accent each),
   a factual stats/credibility strip, and a footer with no dead links.
2. **Auth continuity**: CTAs switch to the existing PreAuth views ("Get started" →
   register, "Sign in" → login) with a Back affordance to the landing; deep links to app
   routes still land on the auth card as before; signing out returns to the landing
   (logout resets the URL to `/`). DEV demo-login stays reachable on the sign-in view.
3. **i18n**: every string in a new `landing` namespace, en + hi, registered in both
   locale index files and added to `CORE_NS` (parity-enforced).
4. **Craft bar**: token-driven light+dark, responsive 360px→desktop, Fraunces display
   headlines, motion per `motion-standard.md` (hero entrance stagger + one-shot
   motion-safe scroll reveals ≤300ms; `prefers-reduced-motion` respected — reveals fall
   back to immediate display), semantic landmarks (`header`/`main`/`footer`,
   `aria-labelledby` sections), keyboard/focus clean.

## Acceptance criteria

- **Given** an unauthenticated visit to `/`, **when** the page loads, **then** the
  landing renders (hero, 4 feature sections, stats strip, footer) instead of the auth
  card, in the active language and theme.
- **Given** the landing, **when** "Sign in" is clicked, **then** the existing login card
  renders (with DEV demo-login in dev builds); **when** "Get started" is clicked,
  **then** the register card renders; a Back control returns to the landing.
- **Given** an unauthenticated deep link (e.g. `/finance`), **then** the auth card
  renders directly (unchanged behaviour).
- **Given** an authenticated user, **when** they sign out, **then** they land back on
  the landing page at `/`.
- **Given** language = hi, **then** every landing string resolves in Hindi
  (parity test guards key-for-key en/hi equality).
- All claims on the page are factual (no invented customers/testimonials).

## Tests

- Component: landing renders hero + sections + CTAs; CTAs switch to the auth views
  (gate test); i18n keys resolve in en and hi.
- Parity: `landing` namespace added to `CORE_NS` → covered by `i18n.parity.test.ts`.
- E2E: shared `loginAsOwner` helper gains a visibility-guarded "click through the
  landing" step so all 5 journeys stay green pre/post-merge.

## Constraints honoured

- No new dependencies; no index.html/meta changes; no `ui/*` file changes (landing
  artwork + reveal hook live inside `apps/web/src/landing/`); no farm panel changes;
  i18n edits limited to the new namespace + index/CORE_NS registrations.
