# Integrated Farm Manager — Master Build Brief for Claude Code
**Working title:** *Samagra Krishi* (समग्र कृषि — "Integrated Farming") · internal code: **IFM**
**Target market:** India (multi-state, Tier-2/3 farms, mixed connectivity)
**Build method:** Agentic loop — Plan → Design → Build → Self-verify → Test → Review → Checkpoint → Deploy, repeated per vertical slice.

> This document is the single source of truth. Drop it into the repo as `BUILD_BRIEF.md`, generate `CLAUDE.md` from Section 1, and run the kickoff prompt in Section 13. Do not skip the checkpoints in Section 1.4.

---

## 0. How to use this document

1. Create an empty repo. Save this file as `/BUILD_BRIEF.md`.
2. Run the **Phase 0** kickoff prompt (Section 13). It tells Claude Code to read this brief, set up project memory, and produce a plan for your approval *before writing any feature code*.
3. Approve/adjust the plan. Then let the loop run slice by slice. You only act at the **checkpoints**.
4. Confirm the **open decisions** in Section 14 first — they change the data model.

---

## 1. Operating model — the agentic build loop

### 1.1 Roles (subagents)
Define these as Claude Code subagents (one markdown file each under `.claude/agents/`). Each has a narrow job and a checklist it must satisfy before handing off.

| Agent | Owns | Must produce |
|---|---|---|
| **Orchestrator** (main session) | The phase plan, the loop, the todo list, git hygiene | Slice plan, checkpoint requests, status |
| **Analyst** | Turning requirements into user stories + acceptance criteria | `specs/<slice>.md` with Given/When/Then |
| **Architect** | Data model, API contracts, ADRs, folder layout | Prisma schema diffs, OpenAPI stub, ADR note |
| **Designer (UI/UX)** | Design system, layout, component inventory, a11y | Tokens, wireframe notes, component list |
| **Builder** | Implementation of the slice (FE + BE) | Working code on a feature branch |
| **Reviewer** | Code review vs checklist (security, perf, conventions) | Review report, blocking/non-blocking findings |
| **QA/Tester** | Unit + integration + e2e tests, coverage, regression | Passing test run + coverage report |
| **DevOps** | CI, migrations, envs, staging deploy, smoke tests | Green pipeline, deployed staging URL |

> One agent is active at a time per slice. The Orchestrator decides handoffs and is the only one allowed to request a human checkpoint.

### 1.2 The per-slice loop
Work in **thin vertical slices** (one usable capability end-to-end), never horizontal layers. For each slice:

```
PLAN     Analyst writes spec + acceptance criteria  ──┐
DESIGN   Architect + Designer agree contract & UI     │
BUILD    Builder implements FE + BE                   │
SELF-VERIFY  typecheck + lint + build + run locally   │  ← if any fails,
TEST     QA writes/runs unit+integration+e2e          │     loop back to BUILD
REVIEW   Reviewer runs the checklist                  │     (max 3 auto-iterations,
FIX      Builder addresses blocking findings  ────────┘     then escalate to human)
CHECKPOINT  Orchestrator asks YOU to approve
MERGE    Conventional commit, PR-style summary, merge to main
DEPLOY   DevOps deploys to staging, runs smoke tests
DEMO     Orchestrator posts a short "what changed + how to test it" note
→ next slice
```

### 1.3 Definition of Done (a slice is NOT done until all are true)
- [ ] Acceptance criteria in the spec all pass (demonstrated, not asserted).
- [ ] `typecheck`, `lint`, `build` all green.
- [ ] Unit + integration tests for the slice pass; e2e for the primary happy path passes.
- [ ] No secrets in code; inputs validated; authz enforced on every new endpoint.
- [ ] DB changes are a reversible migration (up **and** down).
- [ ] Loading, empty, and error states exist in the UI (no dead ends).
- [ ] Works on a 360px-wide screen and offline-reads where applicable.
- [ ] Reviewer report attached; all blocking findings resolved.
- [ ] Staging deploy succeeded and smoke test passed.

### 1.4 Human checkpoints — STOP and ask the owner before:
- Any **schema migration** or data backfill.
- Any **destructive operation** (drop, truncate, bulk delete/update, file deletion).
- Any **deploy to production**.
- Spending on any **paid API / third-party service**.
- Changing **auth, RBAC, or money/billing logic**.
- Deviating from this brief's data model or tech stack.

At a checkpoint, present: what's about to happen, why, the diff/migration SQL, the rollback plan, and a one-line "type APPROVE to proceed."

### 1.5 Claude Code working rules (put these in `CLAUDE.md`)
- **Verify, don't assert.** Never say "done" without showing the command output that proves it (test run, build log, curl response). Treat your own success claims as hypotheses to disprove.
- **Plan before code.** Use plan mode for each slice; show the plan; wait for go.
- **Small commits.** One slice ≈ one branch ≈ conventional-commit history. Never commit to `main` directly; never `git push --force`.
- **Track work** with a live todo list; keep it current.
- **Keep `CLAUDE.md`** updated with conventions, commands, gotchas as you learn them.
- **Ask, don't guess** on the Section 14 open decisions.
- **No new dependency** without noting why in the commit and checking license + maintenance.
- **Idempotent seeds & migrations.** Re-running setup must not corrupt data.
- **Money is integers.** Store paise (₹1 = 100 paise) as integers; never floats for currency.

---

## 2. Product vision, users, principles

**Vision.** A single, calm, mobile-first command center for an educated owner running an *integrated* farm — multiple livestock species plus mushrooms plus the byproduct/nursery loops between them — covering each animal/batch's full lifecycle from acquisition (or hatch) to sale, with costs, feed, labour, health, schedules, alerts, sales/orders, frozen-meat inventory, dashboards, market rates, and risk forecasts.

**Primary users / roles (RBAC):**
- **Owner / Admin** — everything, all units, financials, reports, settings.
- **Manager** — operations for assigned units; can't see full P&L or change billing.
- **Veterinarian** — health records, treatments, vaccination, withdrawal periods.
- **Accountant** — bills, invoices, GST, P&L, payroll; read-only on operations.
- **Labour / Field worker** — extremely simple data entry (feed given, eggs collected, mortality, attendance), big buttons, minimal typing, works offline.
- **Buyer (optional, external)** — self-service order placement portal (gated).

**Design principles:**
1. **Fast data entry beats pretty forms.** Optimize the daily logging path to <10 seconds.
2. **One screen, one job.** Don't crowd dashboards.
3. **Offline-tolerant.** Rural connectivity drops; queued writes must sync later.
4. **Explainable alerts.** Every alert says *why* and *what to do*.
5. **Bilingual from day one** (English + one regional language toggle; architecture supports more).

---

## 3. India context & constraints (bake these into the data model and UX)

**Locale & units**
- Currency **INR (₹)**, Indian digit grouping (lakh/crore), money stored as integer paise.
- Weights in **kg/g**, eggs in **trays (30) + dozens + units**, feed in **kg/quintal (100 kg)/MT**, area in **acre/guntha/cent/sq ft** (configurable per state).
- Dates: DD-MM-YYYY display; timezone **Asia/Kolkata**.

**Connectivity & devices**
- Mobile-first **PWA**, installable, works on low-end Android, **offline read + queued write** for daily-logging screens. Image-heavy screens must lazy-load.

**Language**
- i18n framework with English + Hindi seed; structure for Telugu/Tamil/Kannada/Marathi/Bengali. No hard-coded strings.

**Notifications (rural-appropriate)**
- **SMS** (transactional, e.g., MSG91/Gupshup) and **WhatsApp** (Cloud API/Twilio) as first-class channels alongside push + email. Make the provider pluggable behind one `NotificationService` interface. (You have prior WhatsApp/n8n automation — keep an n8n webhook channel as an option.)

**Compliance (model these as features, not afterthoughts)**
- **FSSAI:** Store the farm's 14-digit FSSAI license number and **print it on every invoice, bill, and cash memo** (legally required for food businesses). License tier depends on scale (basic up to ₹12 lakh turnover; State license ₹12 lakh–₹20 crore; Central above ₹20 crore) — capture which tier the farm holds and surface renewal reminders.
- **Cold chain for frozen meat:** enforce/record storage temperatures — **fresh meat 0–7°C, frozen meat ≤ −18°C** — with a temperature log and out-of-range alerts; refrigerated-transport flag on dispatches over the threshold duration.
- **Antibiotic/veterinary-drug withdrawal:** FSSAI sets residue tolerance limits, so **an animal/batch under medication withdrawal MUST be blocked from "sale-ready"/slaughter** until the withdrawal period elapses. This is a hard rule in the domain logic.
- **GST:** capture GSTIN; GST-compliant invoice numbering, HSN/SAC codes, CGST/SGST/IGST split; GST registration generally required above the turnover threshold (~₹40 lakh for goods in most states) — make it a setting, don't hard-code.
- **Govt schemes (nice-to-have module):** track eligibility/registration for PM-Kisan, NABARD-linked loans, state livestock insurance, KCC.

**Live market-rate data sources (build an adapter layer; don't couple to one source)**
| Need | Source | Reality |
|---|---|---|
| Mandi/commodity wholesale prices (min/max/modal) | **Agmarknet via data.gov.in** JSON/CSV API | Free; default key limited (~10 commodities) → register your own API key. Cache daily. |
| Daily **egg** rates | **NECC** (National Egg Coordination Committee) | No clean official API — scrape/third-party/manual entry. |
| **Broiler / live bird** rates | State broiler councils / aggregators | Mostly no API — scrape or manual; treat as best-effort. |
| Weather + warnings (for risk) | **IMD** official APIs (IP-whitelist) or IMD wrapper; **OpenWeather** as fallback | District-level 7-day forecast, nowcast, rainfall, alerts. |

> **Design rule:** a `MarketRateProvider` and `WeatherProvider` interface with multiple implementations (api / scraper / manual-entry / cached). The app must degrade gracefully to manual entry when a feed is unavailable, and always show "as of <timestamp>, source <x>".

---

## 4. Functional scope — modules

> Every original requirement is mapped below so nothing is dropped. "(+)" marks additions beyond your list that the integrated-farming domain needs.

### 4.1 Farm & Org Setup
- Multi-**farm** → multiple **units** (Poultry, Cattle, Goatery, Rabbitry, Mushroom house, Hatchery, Frozen store, Nursery, Biogas…). (+ multi-farm)
- Roles & permissions (RBAC, Section 2). FSSAI/GST/scheme registry. Unit layout (sheds/pens/cages/coops/ponds).
- *Covers req 1 (organize farm data).*

### 4.2 Livestock & Inventory (the core)
- **Per-species pages** — each species gets its own dedicated view and species-specific fields/lifecycle (Chicken, Rabbit, Cow, Buffalo, Goat, Sheep, Quail, Turkey, Duck, Mushrooms, + extensible). *Covers req 11.*
- Track at the right granularity: **individual** (cattle/buffalo/breeding stock, with ear-tag/QR) vs **batch/flock** (broilers, quail, layers, rabbits). (+)
- Lifecycle stages per species (e.g., chick → grower → layer/finisher → cull/sale). Status machine with allowed transitions. *Covers req 8 (lifecycle).*
- Inventory counts, movements between pens/units, mortality & culling log with cause. (+ mortality/culling)
- Identification: QR/barcode labels, optional RFID/ear-tag. (+)
- *Covers req 2 (inventory management).*

### 4.3 Feed & Nutrition
- Feed inventory (purchase, stock, consumption), ration plans per stage, **Feed Conversion Ratio (FCR)** per batch (+, key profitability KPI), feed cost rollup into animal cost.
- Reorder alerts when feed stock < threshold. *Feeds into req 9 (buy feed), req 3/4 costs.*

### 4.4 Health & Biosecurity (+ heavily expanded)
- Health records, symptoms, treatments, vet visits.
- **Vaccination & deworming schedules** auto-generated per species/age; reminders. (+)
- **Medication withdrawal-period tracking** that blocks sale/slaughter (compliance, Section 3). (+)
- **Disease-outbreak / biosecurity** log with quarantine flags; seasonal risk flags (e.g., avian influenza in migratory/winter season, FMD, PPR, mastitis, coccidiosis). (+)
- Growth/weight tracking, body-condition. (+)

### 4.5 Breeding & Hatchery
- Breeding records, lineage/genealogy, expected-due dates (calving/kidding/farrowing). (+ breeding)
- **Hatchery management by breed:** set eggs → incubation schedule (temp/humidity by stage, turning, candling, lockdown, hatch), **breed-specific incubation periods** (table in Section 6), hatch-rate & fertility analytics. *Covers req 17.*

### 4.6 Schedulers & Daily Work
- **Daily systematic task list** per unit (feeding, cleaning, egg collection, health checks, temperature logs). *Covers req 6 & req 18.*
- Recurring schedule engine (cron-like) generating tasks; assign to labour; completion logging; missed-task alerts. (+ assignment)

### 4.7 Labour Management
- Worker profiles, attendance, **wages/payroll** (daily/piece-rate/monthly), advances, **payments to labour**, task assignment & completion. *Covers req 13 & "pay to labour".*

### 4.8 Procurement, Sales & Orders
- **Purchases** (feed, medicine, chicks/kids/calves, equipment) → updates inventory & cost. *Covers req 9 buy side.*
- **Sales with order-taking:** customer/buyer records, order → reserve stock → dispatch (with cold-chain flag) → invoice. Optional buyer self-service portal. *Covers req 9 sell side & req 3 (track sales).*
- **Live market rates** shown next to sale screens to guide pricing. *Covers req 15.*

### 4.9 Frozen Meat / Processing & Cold Store
- Convert live animal/batch → **processed/frozen products** (cuts, weight, packaging, batch/lot code for traceability).
- Cold-store inventory with **temperature logging & ≤ −18°C enforcement**, expiry/shelf-life, FIFO dispatch. *Covers req 10.*
- Farm-to-fork **traceability**: a product lot links back to the animal/batch, feed, and medications (supports FSSAI). (+)

### 4.10 Finance — Costs, Bills, P&L
- **Cost tracking** per unit/animal/batch (feed, labour, medicine, utilities, maintenance, capital/EMI). *Covers req 4.*
- **Bills**: vendor bills in, customer bills/invoices out (GST + FSSAI number). *Covers req 7.*
- **Profit & Loss** per unit, per species, per batch, and farm-wide; cost-per-kg, cost-per-egg, margin. *Covers req 5.*
- Loan/EMI & insurance tracking. (+)

### 4.11 Maintenance
- Asset register (sheds, incubators, vehicles, generators, chaff cutters, cold rooms).
- **Maintenance schedules + cost tracking + alerts** (service due, AMC expiry). *Covers req "maintenance schedule, alerts" & req 4 (maintenance cost).*

### 4.12 Byproducts, Wastage & the Integrated Loop (the differentiator)
- Record **wastage** (mortality, spoilage, manure, litter, spent substrate, crop residue). *Covers req 16.*
- Convert byproducts into resources and **transfer between units** (see Section 5): poultry litter → biogas/compost/fish feed; cattle dung → biogas → slurry → nursery/crops; spent mushroom substrate → cattle feed/compost; nursery output → sale.
- **Nursery module** consuming compost/slurry; track plants/saplings as sellable stock. *Covers req 16 (use byproducts in nurseries).*

### 4.13 Alerts & Notifications (cross-cutting)
- Unified alert center: feed low, vaccination due, withdrawal ending, maintenance due, temperature out of range, price target hit, weather warning, task overdue, payment due. *Covers req "alerts" + "real-time".*
- Per-channel routing (in-app/push/SMS/WhatsApp/email) with quiet hours.

### 4.14 Dashboards & Reports
- Role-based dashboards (owner overview; unit dashboards). Live KPIs: head count, mortality %, FCR, eggs/day, cost-to-date, projected P&L, alerts.
- **Reports**: daily / weekly / monthly / custom range; per unit/species/batch; export **PDF + Excel**; scheduled email/WhatsApp delivery. *Covers req 12.*

### 4.15 Risk & Market Intelligence
- **Risk prediction** combining weather (heat/cold/monsoon stress → poultry & cattle), disease seasonality, and market signals (price drops, oversupply). Start **rule-based + explainable**; leave a clean seam for an ML model later. *Covers req 14.*
- **Live market rates** screen with trends and "best mandi nearby". *Covers req 15.*

---

## 5. The integrated / circular-economy model (don't skip — it's what "integrated" means)

Model **resource flows** between units as first-class objects, not just notes:

```
Poultry ──litter──▶ Biogas/Compost ──slurry/compost──▶ Nursery/Crops ──sale──▶ $
Cattle/Buffalo ──dung──▶ Biogas ──gas──▶ Energy(self-use)   └─digestate──▶ Crops
Mushroom ──spent substrate──▶ Cattle feed / Compost
Crops/Fodder ──▶ Feed (closes the loop)
Mortality/spoilage ──▶ Rendering/Compost (with biosecurity rules)
```

Each transfer = a record: `{from_unit, to_unit, byproduct_type, qty, unit, date, cost_credit}` so the **source unit gets a cost credit** and the **receiving unit gets a cheaper input** — this is how the app proves the integration *pays*. Surface a "circularity & savings" panel on the owner dashboard.

---

## 6. Reference data to seed (idempotent seed script)

**Incubation periods (hatchery defaults; owner-editable per breed):**

| Species | Incubation (days) | Notes |
|---|---|---|
| Chicken | 21 | candling ~day 7 & 18; lockdown day 18 |
| Quail | 17–18 | high humidity at hatch |
| Duck (most) | 28 | Muscovy ~35 |
| Turkey | 28 | |
| Goose | 28–34 | breed-dependent |
| Guinea fowl | 26–28 | |

**Also seed:** species list + lifecycle stage templates; common vaccination schedules (e.g., poultry: Marek's, NDV/Ranikhet, IBD/Gumboro, fowl pox); deworming intervals; default ration stages; default maintenance intervals; FSSAI license tiers; GST tax-rate templates; unit-of-measure conversions. Mark every seed row as system-default vs user-edited so updates don't clobber customizations.

---

## 7. Architecture & tech stack

> Matches a proven, fast stack. Confirm in Section 14 if you want changes.

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form + Zod, Recharts. **PWA** (vite-plugin-pwa) with offline cache + background sync for logging screens. i18n via i18next.
- **Backend:** Node.js + Express (or NestJS if you prefer structure) + TypeScript, REST (+ WebSocket via Socket.IO for live alerts/dashboards). Zod/DTO validation. Job scheduler (BullMQ on Redis) for the recurring task engine, reminders, report generation, and market/weather pulls.
- **Data:** PostgreSQL + Prisma (migrations both ways). Redis for cache/queues/sessions. Object storage (S3-compatible / local in dev) for photos, bills, certificates.
- **Auth:** JWT (access+refresh) or session; bcrypt/argon2; RBAC middleware; rate limiting; audit log table on every write.
- **Integrations (adapters):** `MarketRateProvider`, `WeatherProvider`, `NotificationService` (SMS/WhatsApp/email/push), `StorageService`, `InvoicePdf`. All behind interfaces with a mock impl for tests.
- **Tooling:** ESLint + Prettier, Vitest/Jest (unit), Supertest (API), Playwright (e2e), GitHub Actions CI, Docker Compose for local (Postgres+Redis+API+web). `.env.example` checked in; real secrets never committed.

**Repo layout:** monorepo (`/apps/web`, `/apps/api`, `/packages/shared` for types/zod schemas), or two repos — Architect decides and records in an ADR.

---

## 8. Data model — core entities (Architect to refine, then checkpoint)

`Farm, Unit, User, Role, Animal (individual), Batch/Flock, Species, Breed, LifecycleStage, FeedItem, FeedLog, Ration, HealthRecord, Medication, VaccinationSchedule, WithdrawalPeriod, BreedingRecord, HatcheryBatch, IncubationLog, Task, ScheduleTemplate, Worker, Attendance, WageEntry, Payment, Vendor, Customer, PurchaseOrder, SalesOrder, Invoice, LineItem (HSN/GST), Product (processed/frozen), Lot (traceability), ColdStoreLog (temp), Asset, MaintenancePlan, MaintenanceLog, Expense, ByproductTransfer, NurseryStock, Alert, Notification, MarketRate, WeatherSnapshot, RiskFlag, AuditLog, Setting, Document/Media.`

Cross-cutting columns: `farm_id` (tenant scope) on everything, `created_by/updated_by`, soft-delete where appropriate, `created_at/updated_at`. Enforce farm-scoping in a query middleware so no endpoint can leak across farms.

---

## 9. Non-functional requirements
- **Security:** authz on every endpoint; input validation; no IDOR (always scope by farm + role); secrets in env; audit trail; least-privilege DB user.
- **Performance:** list endpoints paginated; dashboard KPIs cached; market/weather fetched on a schedule, not per request; images optimized.
- **Reliability:** migrations reversible; idempotent jobs; queued writes survive offline; daily DB backup in prod.
- **Accessibility:** WCAG AA basics, 44px touch targets, color-contrast, keyboard nav.
- **Observability:** structured logs, error tracking (Sentry-style), health-check endpoint.
- **i18n:** zero hard-coded UI strings.

---

## 10. Phased delivery plan (apply the Section 1 loop to each)

Each phase = one or more vertical slices. **Checkpoint at the end of every phase.** Don't start a phase before the previous one is "Done" per Section 1.3.

| Phase | Goal (vertical slices) | Exit / demo |
|---|---|---|
| **0. Foundation** | Repo, CI, Docker Compose, Prisma init, auth + RBAC, farm/unit setup, design system + app shell, i18n scaffold, PWA shell. | Log in as each role; create a farm + unit; CI green; staging up. |
| **1. Livestock core** | Species pages, batch & individual records, lifecycle status machine, mortality/culling, identification (QR). | Add a chicken batch + a cow; move/cull; see species page. |
| **2. Daily ops** | Scheduler/task engine, daily logging (feed, eggs, weight) with **offline + sync**, labour attendance. | Labour logs feeds offline, syncs; tasks auto-generate. |
| **3. Health & breeding** | Health records, vaccination/deworming schedules + reminders, **withdrawal-period gating**, breeding records, **hatchery + incubation**. | Vaccination reminder fires; medicated batch blocked from sale; incubation timeline renders. |
| **4. Feed & finance** | Feed inventory + FCR, purchases, expenses, cost rollups, bills in/out, **GST+FSSAI invoices (PDF)**, P&L per unit/batch. | Buy feed → cost flows to batch; raise a compliant invoice PDF; see batch P&L. |
| **5. Sales & frozen meat** | Sales orders + dispatch, buyer records, processing → products → **cold-store temp log (≤ −18°C)** + traceability lots. | Take an order, dispatch with cold-chain flag, trace a lot back to its batch. |
| **6. Maintenance & byproducts** | Asset register + maintenance schedules/alerts, **byproduct transfers + nursery loop**, circularity panel. | Schedule a service; transfer litter → compost → nursery; see savings. |
| **7. Intelligence** | Market-rate + weather adapters, alert center routing (SMS/WhatsApp), **rule-based risk flags**, dashboards. | Live mandi/egg rate shows; heat-stress + price-drop alert fires with reason. |
| **8. Reports & polish** | Daily/weekly/monthly reports (PDF/Excel) + scheduled delivery, dashboard refinement, a11y + perf pass, localization second language. | Owner gets a scheduled weekly WhatsApp/email report; Lighthouse/perf pass. |
| **9. Hardening & prod** | Backups, monitoring, load sanity, security review, prod deploy runbook. | Production deploy (with checkpoint) + rollback rehearsed. |

---

## 11. Testing strategy
- **Unit:** domain logic — money math, FCR, withdrawal gating, status transitions, cost rollups, incubation date math. (These are where bugs cost real money — test hard.)
- **Integration (API):** auth/RBAC, farm-scoping (no cross-farm leak), invoice GST math, order→dispatch→stock, byproduct transfer credits.
- **E2E (Playwright):** the critical journeys — add batch, daily log offline+sync, raise compliant invoice, take+dispatch order, withdrawal block.
- **Contract/mocked:** market/weather/notification adapters tested against mock impls; never hit paid/live APIs in CI.
- **Gates:** PR can't merge if typecheck/lint/build/tests fail; track coverage on domain logic (aim ≥80% there; UI lower is fine).
- **Regression:** QA agent re-runs the full suite each phase before checkpoint.

---

## 12. Deployment & DevOps
- **Environments:** local (Docker Compose) → staging (auto-deploy on merge to main) → production (manual, checkpoint-gated).
- **CI (GitHub Actions):** install → typecheck → lint → test → build → (on main) deploy to staging → smoke test.
- **Migrations** run as an explicit, logged step with a backup-first rule in prod.
- **Hosting options to propose at checkpoint:** containerized API on Render/Railway/Fly/VPS; managed Postgres + Redis; web on Vercel/Netlify/same VPS; S3-compatible object storage. Pick based on cost and your data-residency preference (India region if possible).
- **Runbook:** deploy steps, rollback steps, backup/restore, on-call alerts — written before first prod deploy.

---

## 13. Kickoff prompt — paste this into Claude Code (Phase 0)

```
You are the Orchestrator for building "Integrated Farm Manager (IFM)". 

1. Read /BUILD_BRIEF.md in full. Do NOT write feature code yet.
2. Create CLAUDE.md capturing: the tech stack (Section 7), the working rules 
   (Section 1.5), the Definition of Done (Section 1.3), the checkpoint rules 
   (Section 1.4), and the common commands once known.
3. Create the subagents from Section 1.1 as files under .claude/agents/ — each 
   with its job, inputs, outputs, and a handoff checklist.
4. List the OPEN DECISIONS (Section 14) and ask me to answer them. Wait.
5. After I answer, produce the Phase 0 plan as thin vertical slices with 
   acceptance criteria, the proposed repo layout, and the initial Prisma schema 
   for Phase 0 entities only. Present it and STOP for my approval (this is a 
   checkpoint — schema + structure).
6. On approval, run the per-slice loop in Section 1.2. After each slice, show me 
   the proof it works (command output, not claims), then continue. Request a 
   checkpoint at every point listed in Section 1.4 and at the end of every phase.

Rules you must never break: verify don't assert; small commits, never force-push, 
never commit to main directly; ask before migrations, destructive ops, deploys, 
paid APIs, or auth/billing changes; store money as integer paise; no hard-coded 
UI strings; enforce farm-scoping on every endpoint.

Begin with step 1.
```

For later phases, the recurring prompt is simply:
```
Proceed to Phase <N>. Plan the slices, show me the plan and any schema changes, 
wait for my approval, then run the loop. Show proof per slice. Checkpoint per the brief.
```

---

## 14. Open decisions for you to confirm (these change the build)
1. **Granularity:** Which species are tracked as **individuals** (ear-tag) vs **batches**? (Default: cattle/buffalo/breeding-stock = individual; poultry/quail/rabbit/broiler = batch.)
2. **Hosting & data residency:** India-region required? Budget for managed Postgres/Redis + S3?
3. **Notification providers:** Which SMS (MSG91/Gupshup) and WhatsApp (Cloud API/Twilio)? Reuse your existing n8n WhatsApp flow as a channel?
4. **Market data:** Register your own data.gov.in (Agmarknet) API key? Acceptable to **manually enter** NECC egg / broiler rates where no API exists?
5. **Weather:** Pursue IMD IP-whitelisting, use an IMD wrapper, or OpenWeather (paid tier) as fallback?
6. **Languages:** English + which regional language for the first localized pass?
7. **Buyer portal:** In scope now (self-service orders) or phase-2-later?
8. **GST/FSSAI:** Confirm the farm's license tier + GSTIN so invoice logic is correct from the start.
9. **Frozen meat depth:** Full processing yields/cuts + lot traceability, or simple finished-product inventory to start?
10. **Stack swaps:** Keep Express, or use NestJS? Monorepo or two repos?

---

### Appendix — requirement → module coverage (quick check)
1 → 4.1 · 2 → 4.2 · 3 → 4.8 · 4 → 4.10/4.11 · 5 → 4.10 · 6 → 4.6 · 7 → 4.10 · 8 → 4.2 · 9 → 4.8/4.3 · 10 → 4.9 · 11 → 4.2 · 12 → 4.14 · 13 → 4.7 · 14 → 4.15 · 15 → 4.15/4.8 · 16 → 4.12 · 17 → 4.5 · 18 → 4.6.
**Added (not in original list but important):** RBAC/multi-farm, offline PWA, biosecurity/disease-season tracking, FCR, withdrawal-period gating, traceability lots, cold-chain temp logging, breeding/lineage, govt-scheme & insurance/EMI tracking, audit log, integrated byproduct flows + circularity panel, SMS/WhatsApp alerts, i18n.
```
