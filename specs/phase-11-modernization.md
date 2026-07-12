# Phase 11 — Modern SaaS migration (owner-directed, 2026-07-11)

> Owner directive (verbatim intent): modernize the frontend to MNC-grade UI/UX with the
> latest customer-experience patterns, make the app fully functional end-to-end with great
> performance and no bugs, add market-competitive features, complete all SDLC stages without
> waiting for per-step approval. Payments stay mocked; other services (OTP etc.) are real
> (free/self-hosted providers; paid providers stay owner-gated per §3).
>
> This directive pre-approves for this phase: the schema migrations listed below (all
> reversible), auth-surface additions (OTP/reset/sessions/profile), and deletion of the
> confirmed-dead `farm/DashboardPanel.tsx`. Destructive data ops and production deploys
> remain out of scope.

## Evidence base

Built from an 11-agent mapping + research workflow (2026-07-11) over the full codebase plus
modern-SaaS UX and farm-software competitor research. Key verified findings:

- Brief-mandated frontend stack missing: no TanStack Query / React Hook Form / Zod anywhere in apps/web.
- 72 `.catch(() => undefined)` sites across 27 panels — mutations fail silently; no toasts; no confirm dialogs on cull/close/delete.
- Session is memory-only (reload = logout; 15-min access TTL kills the app mid-session; refresh endpoint exists but is never called).
- No register/forgot-password/OTP/profile/sessions UI or API; no membership management API (roles unreachable outside seed).
- No pagination/search/sort on any list (API or UI); rows truncated with `.slice(0, 8)` — older records unreachable.
- No table primitive, no skeletons, no empty-state CTAs, no command palette, no notification center, no global search, no activity feed (AuditLog is write-only).
- 27 panels share 10 URLs (sections stack panels vertically; no per-panel routes/tabs).
- i18n: language not persisted; one 740-line i18n.ts; a few hardcoded strings.
- Offline queue: no farmId/userId scoping (cross-tenant flush bug), no occurredAt (timestamps corrupted), poison items block the queue.
- No component tests (no jsdom/testing-library); e2e = 1 spec, non-gating.

## Slices (each: branch → PR → CI green → merge; auto-merge per standing owner directive)

### 11.1 Foundation — web data layer, session, UI kit (no API changes)
- Deps (all MIT): `@tanstack/react-query`, `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@radix-ui/react-toast`, `@radix-ui/react-tabs`.
- Typed `ApiError {status, code, message}`; `encodeURIComponent` on all query params; `res.ok` checks in blob helpers; split `farm/api.ts` into per-domain modules with query-key factories.
- Session persistence + silent refresh: persist refresh token (localStorage), boot-time restore via existing `POST /api/auth/refresh`, 401 → refresh-and-replay interceptor, logout clears storage.
- QueryClientProvider + `useFarmApi()`; toast system (Radix Toast on Harvest tokens) + `useApiMutation` wrapper (pending-disable, success/error toasts, invalidation).
- UI kit additions: `Dialog` (centered modal + AlertDialog-style confirm), `Tabs`, `Table`/`DataTable` (TanStack Table: sort, client pagination, search box, column alignment, sticky header, mobile card collapse), `Skeleton` (+Table/Card variants), `EmptyState` (icon+copy+CTA), `Tooltip` wrapper (dep already installed), `Switch`-less for now, `Textarea`, `Label`/`FormField` (RHF-integrated), `Kbd`, `Spinner`; `Button loading` prop; `fmtDate` (DD-MM-YYYY), `fmtInr`/`InrInput` (paise-safe).
- Shell fixes: ErrorBoundary with reload recovery; per-section `document.title`; scroll-to-top + focus reset on nav; persist selected farm (`ifm.farm`) & language (`ifm.lang`); Suspense fallbacks = skeletons; self-host fonts; PWA manifest → Harvest colors.
- i18n: split `i18n.ts` into per-namespace resource files (en+hi) so later slices can add keys without conflicts; parity test still enforced.

### 11.2 Shell UX — routes, palette, bell, mobile
- Per-panel routes (`/finance/invoices`) + section Tabs; nav registry gains panel labels.
- Command palette (`cmdk`): navigate + actions + (11.4) global search; shortcuts `/`, `g then x`, `?` help overlay; shortcut registry shared palette/help.
- Notification bell in Topbar over existing risk/alerts/reminder endpoints (unified inbox API lands in 11.4).
- Mobile bottom tab bar (role-aware, safe-area) + drawer for "More"; sidebar tooltips (collapsed rail); role-filtered nav; count badges from dashboard rollup.

### 11.3 Auth & account (API + web) — schema migration: OtpToken table + RefreshToken ip/userAgent columns
- API: `POST /api/auth/otp/request` + `/otp/verify` (login/verify channels: email via nodemailer SMTP when configured, else NotificationService mock/log; hashed OTP at rest, 10-min expiry, 5-attempt cap, 60s resend cooldown, rate-limited), `POST /api/auth/forgot` + `/reset` (same OTP infra), `POST /api/auth/change-password` (revokes other sessions), `PATCH /api/me` (name/phone/locale), `GET/DELETE /api/me/sessions` + sign-out-all (RefreshToken rows gain ip/userAgent).
- Web: Register page; Forgot/Reset flow; OTP-login option; Account page (profile, change password, active sessions with revoke, language); demo-credential prefill removed (DEV-gated quick-login instead).

### 11.4 Team, activity, search (API + web)
- API: membership lifecycle (`POST/PATCH/DELETE /api/farm/members` — invite existing-or-new user by email, change role, deactivate; OWNER only; invite message via NotificationService), `GET /api/farm/audit` (paginated activity), `GET /api/farm/search?q=` (typed groups: batches, animals, invoices, customers, lots, workers; farm-scoped).
- Web: Team settings page; Activity feed panel; search wired into command palette.

### 11.5 API completeness — pagination envelope, missing reads, lifecycle, aggregates
- Additive pagination/search on the big lists (`?page/pageSize/q/status/from/to` → `{items, total}` envelope alongside legacy keys).
- Missing reads: mortality/movements GET, invoice detail JSON, cold-store temp history, market history, monthly finance summary, farm-wide due-this-week rollup, per-batch performance (FCR trend, mortality curve, cost).
- Lifecycle: expense PATCH/soft-DELETE, customer/vendor PATCH, feed-item PATCH, asset PATCH, invoice mark-paid/void, report-schedule pause/delete, risk resolve. Task assignee (schema column, migration).
- Proactive intelligence: daily BullMQ weather+market pull raising risk flags + THI-based heat-stress bands with actionable advice; mortality-spike rule.

### 11.6 Panel modernization fan-out (web) — the big sweep
Every panel rebuilt on the 11.1 kit: useQuery/useMutation, DataTable with search/filter/pagination, create/edit in Dialogs, RHF+Zod forms with labels + inline errors, toasts, skeletons, EmptyState CTAs, confirm dialogs on destructive actions, full API field surface (multi-line invoices w/ GSTIN, batch breed/unit, hatchery fertile/candling, worker phone, maintenance cost/vendor…), detail views (invoice, order→dispatch CTA, lot trace, batch drill-down, animal timeline), DD-MM-YYYY everywhere, i18n en+hi parity, cross-links between flows, QR enlarge/print. Delete dead `DashboardPanel.tsx`.

### 11.7 Dashboard & product intelligence
Onboarding checklist (derived, dismissible); "Today" due-this-week panel; role-aware dashboard defaults; period selector; server-side cost aggregation; themed chart tooltips; deep-linked KPIs; market target-price alert setting.

### 11.8 QA hardening & verification
jsdom + @testing-library component tests for the critical panels; Brief §11 e2e journeys (add batch, invoice, order→dispatch, withdrawal block) gating on PR; coverage on domain logic; offline-queue hardening (farm/user scoping, occurredAt, poison-item handling, shell-level flush); full in-browser verification pass against seeded data; bug-fix loop.

## Out of scope (unchanged)
Payments (mocked only), paid notification providers (Twilio/WhatsApp real delivery — owner-gated), production VPS deploy, buyer portal, IoT ingest, marketplace features.
