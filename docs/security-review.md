# Security Review — IFM (Phase 9)

Maps the Brief §7 security requirements to where they're implemented, plus open findings.
Re-run this checklist each hardening pass.

## Controls in place

| Control | Status | Where |
|---|---|---|
| Password hashing (Argon2id) | ✅ | `auth/password.ts` (`@node-rs/argon2`); cheap params only under `NODE_ENV=test` |
| JWT access (HS256, 15m) | ✅ | `auth/tokens.ts` (`jose`) |
| Refresh tokens (opaque, SHA-256 hashed, rotated, revocable) | ✅ | `auth/tokens.ts`, `RefreshToken` |
| Prod secret guard (no dev placeholder) | ✅ | `env.ts` (throws in prod if `JWT_ACCESS_SECRET` is the dev default) |
| RBAC (role gates per route) | ✅ | `auth/middleware.requireRole` |
| Tenant isolation / farm-scoping (no IDOR) | ✅ | `requireFarmAccess` + `farmScope`; every `/api/farm/*` query filters `farmId` |
| Input validation (Zod on every input) | ✅ | per-module `schemas.ts`; `ZodError → 400` in `errors.ts` |
| Security headers | ✅ | `helmet()` in `app.ts` |
| CORS | ✅ | `cors()` in `app.ts` (tighten `origin` allowlist before prod — see findings) |
| Rate limiting (auth brute-force) | ✅ | `security/rate-limit.ts` → `/api/auth/*` (10 / 15 min; relaxed under test) |
| Readiness probe (DB) | ✅ | `GET /api/health/ready` |
| Money as integer paise (no float) | ✅ | BigInt across all money fields |
| Reversible migrations (down.sql) | ✅ | enforced by test (slice 9.3) |
| Secrets in env only (never committed) | ✅ | `.env` gitignored; `.env.example` template; no provider keys in repo |

## Open findings (tracked debt)

1. **Audit log not yet wired on every write.** `AuditLog` table exists but writes are not
   universally recorded. *Recommendation:* add audit middleware on mutating `/api/farm/*`
   routes (auth, money, RBAC changes first). Severity: medium.
2. **CORS is permissive (`cors()` default).** Before prod, restrict to the web origin via an
   allowlist env (`WEB_ORIGIN`). Severity: medium (prod-blocking).
3. **No account lockout / MFA.** Rate limiting mitigates brute force; lockout + optional MFA
   are post-MVP. Severity: low.
4. **Notification/market/weather provider creds** are owner-gated and unset; real wiring is a
   separate §3 checkpoint. No secrets in repo. Severity: n/a (by design).

## Pre-prod must-do (gate the production deploy)
- [ ] Set a strong `JWT_ACCESS_SECRET` in `/opt/ifm/.env` (env guard enforces non-dev).
- [ ] Restrict CORS origin to the deployed web host.
- [ ] TLS/HTTPS termination + HSTS at the edge (nginx/Cloudflare).
- [ ] Automated DB backups enabled (see `docs/monitoring.md`, `scripts/backup.sh`).
