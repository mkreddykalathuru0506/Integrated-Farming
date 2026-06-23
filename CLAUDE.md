# CLAUDE.md — Integrated Farm Manager (IFM / *Samagra Krishi*)

> Project memory for Claude Code. Generated from `BUILD_BRIEF.md` (the single source of truth).
> If anything here conflicts with `BUILD_BRIEF.md`, the brief wins — update this file to match.

**Target market:** India (multi-state, Tier-2/3 farms, mixed connectivity).
**Build method:** Agentic loop — Plan → Design → Build → Self-verify → Test → Review → Checkpoint → Deploy, per thin vertical slice.

---

## 0. Rules I must NEVER break (hard constraints)

1. **Verify, don't assert.** Never claim "done" without showing the command output that proves it (test run, build log, curl/HTTP response). Treat my own success claims as hypotheses to disprove.
2. **Small commits.** One slice ≈ one branch ≈ conventional-commit history. **Never commit to `main` directly. Never `git push --force`.**
3. **Ask before** (human checkpoint, see §3): schema migrations / data backfills, destructive ops (drop/truncate/bulk delete/update/file deletion), production deploys, spending on any paid API / third-party service, changing auth/RBAC/money/billing logic, or deviating from the brief's data model or tech stack.
4. **Money is integers.** Store **paise** (₹1 = 100 paise) as integers. Never use floats for currency.
5. **No hard-coded UI strings.** Everything goes through i18n (English + Hindi seed; structure for more).
6. **Enforce farm-scoping on every endpoint.** `farm_id` tenant scope on every entity; query middleware so no endpoint can leak across farms. No IDOR.

---

## 1. Tech stack (Brief §7) — do not deviate without a checkpoint

**Frontend**
- React + TypeScript + Vite, Tailwind CSS, shadcn/ui
- TanStack Query, React Hook Form + Zod, Recharts
- **PWA** via vite-plugin-pwa — offline cache + background sync for daily-logging screens; lazy-load image-heavy screens
- i18n via i18next (English + Hindi seed)

**Backend**
- Node.js + Express *(or NestJS — see Open Decision #10)* + TypeScript
- REST + WebSocket (Socket.IO) for live alerts/dashboards
- Zod/DTO validation on every input
- Job scheduler: **BullMQ on Redis** (recurring task engine, reminders, report generation, market/weather pulls)

**Data**
- **PostgreSQL + Prisma** (migrations both ways — up *and* down)
- **Redis** for cache/queues/sessions
- Object storage: S3-compatible (local in dev) for photos, bills, certificates

**Auth & security**
- JWT (access + refresh) or session; bcrypt/argon2
- RBAC middleware; rate limiting; **audit log table on every write**
- Least-privilege DB user; secrets in env only

**Integrations — adapters behind interfaces (each with a mock impl for tests)**
- `MarketRateProvider`, `WeatherProvider`, `NotificationService` (SMS/WhatsApp/email/push), `StorageService`, `InvoicePdf`
- Degrade gracefully to manual entry; always show "as of `<timestamp>`, source `<x>`"

**Tooling**
- ESLint + Prettier; Vitest/Jest (unit); Supertest (API); Playwright (e2e)
- GitHub Actions CI; Docker Compose for local (Postgres + Redis + API + web)
- `.env.example` checked in; **real secrets never committed**

**Repo layout:** monorepo (`/apps/web`, `/apps/api`, `/packages/shared`) or two repos — Architect decides and records in an ADR (pending checkpoint).

---

## 2. Definition of Done (Brief §1.3) — a slice is NOT done until ALL are true

- [ ] Acceptance criteria in the spec all pass (**demonstrated, not asserted**).
- [ ] `typecheck`, `lint`, `build` all green.
- [ ] Unit + integration tests for the slice pass; e2e for the primary happy path passes.
- [ ] No secrets in code; inputs validated; **authz enforced on every new endpoint**.
- [ ] DB changes are a **reversible migration** (up **and** down).
- [ ] Loading, empty, and error states exist in the UI (no dead ends).
- [ ] Works on a **360px-wide** screen and offline-reads where applicable.
- [ ] Reviewer report attached; all blocking findings resolved.
- [ ] Staging deploy succeeded and smoke test passed.

---

## 3. Human checkpoints (Brief §1.4) — STOP and ask the owner before:

- Any **schema migration** or data backfill.
- Any **destructive operation** (drop, truncate, bulk delete/update, file deletion).
- Any **deploy to production**.
- Spending on any **paid API / third-party service**.
- Changing **auth, RBAC, or money/billing logic**.
- Deviating from the brief's data model or tech stack.

**At a checkpoint, present:** what's about to happen · why · the diff / migration SQL · the rollback plan · a one-line **"type APPROVE to proceed."**

Only the Orchestrator may request a human checkpoint.

---

## 4. Working rules (Brief §1.5)

- **Plan before code.** Use plan mode per slice; show the plan; wait for go.
- **Track work** with a live todo list; keep it current.
- **Keep `CLAUDE.md` updated** with conventions, commands, and gotchas as they're learned.
- **Ask, don't guess** on the §14 open decisions.
- **No new dependency** without noting why in the commit and checking license + maintenance status.
- **Idempotent seeds & migrations.** Re-running setup must not corrupt data. Mark each seed row `system-default` vs `user-edited` so updates don't clobber customizations.

---

## 5. The agentic loop (Brief §1.2) — per thin vertical slice

```
PLAN     Analyst writes spec + acceptance criteria  ──┐
DESIGN   Architect + Designer agree contract & UI     │
BUILD    Builder implements FE + BE                   │
SELF-VERIFY  typecheck + lint + build + run locally   │  ← if any fails,
TEST     QA writes/runs unit+integration+e2e          │     loop back to BUILD
REVIEW   Reviewer runs the checklist                  │     (max 3 auto-iterations,
FIX      Builder addresses blocking findings  ────────┘     then escalate to human)
CHECKPOINT  Orchestrator asks the owner to approve
MERGE    Conventional commit, PR-style summary, merge to main
DEPLOY   DevOps deploys to staging, runs smoke tests
DEMO     Orchestrator posts "what changed + how to test it"
→ next slice
```

One agent is active at a time per slice. Work in **thin vertical slices** (one usable capability end-to-end), never horizontal layers. Subagents live in `.claude/agents/`.

---

## 6. India domain rules to bake in (Brief §3)

- **Currency:** INR (₹), Indian digit grouping (lakh/crore), **money as integer paise**.
- **Units:** weight kg/g; eggs trays(30)/dozens/units; feed kg/quintal(100kg)/MT; area acre/guntha/cent/sqft (configurable per state).
- **Dates:** DD-MM-YYYY display; timezone **Asia/Kolkata**.
- **FSSAI:** store 14-digit license + tier; **print on every invoice/bill/cash memo**; renewal reminders.
- **Cold chain:** fresh meat 0–7°C, frozen ≤ −18°C; temperature log + out-of-range alerts; refrigerated-transport flag.
- **Withdrawal periods:** an animal/batch under medication withdrawal **MUST be blocked** from sale-ready/slaughter until it elapses. Hard domain rule.
- **GST:** capture GSTIN; compliant invoice numbering; HSN/SAC codes; CGST/SGST/IGST split; turnover threshold is a **setting**, not hard-coded.

---

## 7. Common commands

> Monorepo = pnpm workspaces (`@ifm/web`, `@ifm/api`, `@ifm/shared`). Run from repo root. Keep this in sync.

| Purpose | Command |
|---|---|
| Install deps (+ generates Prisma client) | `pnpm install` |
| Dev (api :4000 + web :5180) | `pnpm dev` |
| Typecheck (all) | `pnpm typecheck` |
| Lint (all) | `pnpm lint` |
| Unit + API tests (all) | `pnpm test` |
| E2E tests (Playwright) | _added in a later slice_ |
| Build (all) | `pnpm build` |
| Prisma migrate (dev) | `pnpm db:migrate` |
| Prisma migrate (deploy/prod) | `pnpm db:migrate:deploy` |
| Rollback (dev) | `pnpm db:reset` · (prod: backup-first + `down.sql`, see ADR-0001) |
| Seed (idempotent) | `pnpm db:seed` |
| Local infra (Postgres + Redis) | `pnpm docker:up` / `pnpm docker:down` |

**Ports (this machine):** api `4000`, web `5180`, Postgres `5432`, Redis `6382` (6379–6381 taken by other projects). Host ports are overridable in `.env` (`POSTGRES_PORT`, `REDIS_PORT`); web port in `apps/web/vite.config.ts`.
**Env:** root `.env` (gitignored) loaded into api/Prisma via `dotenv-cli` (`-e ../../.env`). Template: `.env.example`.

---

## 8. Testing strategy (Brief §11)

- **Unit:** domain logic — money math, FCR, withdrawal gating, status transitions, cost rollups, incubation date math. Aim **≥80% coverage on domain logic**.
- **Integration (API):** auth/RBAC, farm-scoping (no cross-farm leak), invoice GST math, order→dispatch→stock, byproduct transfer credits.
- **E2E (Playwright):** add batch, daily log offline+sync, raise compliant invoice, take+dispatch order, withdrawal block.
- **Contract/mocked:** market/weather/notification adapters tested against mocks; **never hit paid/live APIs in CI**.
- **Gates:** PR can't merge if typecheck/lint/build/tests fail. QA re-runs the full suite each phase before checkpoint.

---

## 9. Phase map (Brief §10) — checkpoint at the end of every phase

| Phase | Goal | Exit/demo |
|---|---|---|
| 0 | Foundation: repo, CI, Docker Compose, Prisma init, auth+RBAC, farm/unit setup, design system + app shell, i18n + PWA shell | Log in per role; create farm+unit; CI green; staging up |
| 1 | Livestock core: species pages, batch & individual, lifecycle state machine, mortality/culling, QR | Add chicken batch + cow; move/cull; species page |
| 2 | Daily ops: scheduler/task engine, daily logging (offline+sync), labour attendance | Labour logs feeds offline, syncs; tasks auto-generate |
| 3 | Health & breeding: health records, vaccination/deworming + reminders, withdrawal gating, breeding, hatchery+incubation | Reminder fires; medicated batch blocked; incubation timeline |
| 4 | Feed & finance: feed inventory + FCR, purchases, expenses, cost rollups, bills, GST+FSSAI invoice PDF, P&L | Buy feed → cost flows; compliant invoice PDF; batch P&L |
| 5 | Sales & frozen meat: sales orders + dispatch, buyers, processing → products → cold-store temp log + traceability | Order → dispatch w/ cold-chain; trace lot to batch |
| 6 | Maintenance & byproducts: asset register + maintenance, byproduct transfers + nursery loop, circularity panel | Schedule service; litter→compost→nursery; see savings |
| 7 | Intelligence: market-rate + weather adapters, alert routing (SMS/WhatsApp), rule-based risk flags, dashboards | Live rate shows; heat-stress + price-drop alert with reason |
| 8 | Reports & polish: reports (PDF/Excel) + scheduled delivery, dashboard refinement, a11y/perf, 2nd language | Scheduled weekly report; Lighthouse/perf pass |
| 9 | Hardening & prod: backups, monitoring, load sanity, security review, prod runbook | Prod deploy (checkpoint) + rollback rehearsed |

---

## 10. Resolved open decisions (Brief §14) — owner-confirmed 2026-06-22

1. **Granularity / identification:** cattle/buffalo/breeding-stock = **individual**, poultry/quail/rabbit/broiler/goat/sheep = **batch** (default). Individuals support **both ear-tag AND QR** identification. *(Phase 1 schema.)*
2. **Hosting:** owner has a **Hostinger VPS in the India region** — staging & prod deploy there via Docker. Build cloud-agnostic; **confirm before touching the VPS** (needs SSH/credentials).
3. **Notifications:** channels = **Twilio (SMS) + WhatsApp + n8n webhook + email**, all behind `NotificationService` with a mock for tests. Real providers = paid → checkpoint.
4. **Market data:** fetch **live from the internet** (Agmarknet/data.gov.in API + egg/broiler best-effort) behind `MarketRateProvider`; **manual-entry fallback**; cache daily; show "as of `<ts>`, source `<x>`".
5. **Weather:** use a **free service** behind `WeatherProvider` — recommend **Open-Meteo** (free, no API key); fall back to a **placeholder/mock** if none suitable. Paid tier (e.g., OpenWeather) = checkpoint.
6. **Languages:** **English first**; i18n structure in place for Hindi/Telugu/etc. later. No hard-coded strings regardless.
7. **Buyer portal:** **later** (post-MVP, gated).
8. **GST/FSSAI:** **placeholders / settings only** — `fssaiLicenseNo`, `fssaiTier`, `gstin`, GST threshold all configurable per farm, never hard-coded.
9. **Frozen meat:** start with **lot traceability + temperature log**; simple cuts first, full yield modelling later.
10. **Stack:** **Express + TypeScript**, **monorepo** (`/apps/web`, `/apps/api`, `/packages/shared`). Package manager **pnpm** (ADR-001).

## 11. Current status

- **Phase:** 0 (Foundation), in progress.
- **Repo:** public at `github.com/mkreddykalathuru0506/Integrated-Farming`; feature-branch → PR per slice; CI green on `main`.
- **Slice 0.1 (skeleton + CI):** ✅ merged to `main`.
- **Slice 0.2 (auth):** ✅ merged. Argon2id passwords; JWT access (15m) via `jose`; opaque refresh tokens stored SHA-256-hashed, rotated + revocable; CI runs a Postgres service + `migrate deploy` for integration tests.
- **Slice 0.3 (RBAC + farm-scoping):** ✅ merged. Tenant routes under `/api/farm/*` (auth + `X-Farm-Id` → membership; `requireRole`; `farmScope`); user routes `/api/me/*`. Seed: 6 role users + second farm; dev password `Passw0rd!` (ADR-0002).
- **Slice 0.4 (farm/unit CRUD + settings):** ✅ merged. `POST /api/farms`; `/api/farm` GET/PATCH; `/api/farm/settings` GET/PUT; `/api/farm/units` CRUD (soft-delete). Money: `gstThresholdPaise` BigInt → string transport.
- **Slice 0.5 (app shell + design system + i18n + PWA):** ✅ merged. `apps/web/src/ui` primitives (cva); `AppShell`; `LanguageToggle` (en + hi); PWA via `vite-plugin-pwa`.
- **Slice 0.6 (staging deploy):** built & verified locally — on branch `phase-0/slice-0.6-staging-deploy`, **awaiting end-of-slice checkpoint + merge**. Mirrors the company-portal deploy (owner decision): `infra/docker/` (Dockerfile.api [Node/tsx], Dockerfile.web [nginx serving SPA + proxying /api → api:4000], `docker-compose.prod.yml`), self-hosted-runner `deploy.yml` (rsync → `/opt/ifm` → compose build+up, gated on CI `build`, shared `/tmp/vps-deploy.lock`), `.env.staging.example`, `docs/runbook.md`. Local proof: prod images build, stack healthy, register/login work through nginx, SPA+PWA served. **Live VPS cutover is owner-gated** (register `ifm-vps` runner + create `/opt/ifm/.env`).
- **Deferred:** install/Lighthouse/visual a11y → 0.8; offline-write + Playwright e2e → Phase 2; HTTPS/domain + automated backups → Phase 9.
- **Next:** finish Phase 0 (merge 0.6 + owner VPS setup), then Phase 1 (livestock core).
