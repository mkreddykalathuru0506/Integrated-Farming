# Spec — Slice 0.2: Auth (register/login, JWT access + refresh)

**Phase:** 0 · **Branch:** `phase-0/slice-0.2-auth` · **⚠️ §1.4 checkpoint: auth logic**

## User story
As a **user**, I want to register and log in and stay logged in securely, so that the app can identify me on every request and protect endpoints.

## Scope
**In:** password hashing (Argon2id), JWT **access** tokens, opaque **refresh** tokens with rotation + revocation (stored hashed in `RefreshToken`), `requireAuth` middleware, auth routes, audit-log on login/register, a minimal web login form wired end-to-end, idempotent demo Owner seed.
**Out:** RBAC role-gating + farm-scoping middleware (0.3), full routed/protected pages (0.3/0.4), password reset / email verification (later), httpOnly-cookie transport (noted as future hardening).
**No schema change** — uses existing `User` + `RefreshToken` tables.

## Acceptance criteria (Given/When/Then)

1. **Register**
   - Given a unique email, When `POST /api/auth/register {email,name,password}`, Then `201` and the user is persisted with an Argon2 `passwordHash` (never the plaintext).
   - Given a duplicate email, When register, Then `409 {error.code:"EMAIL_TAKEN"}`.
   - Given a weak/invalid body, When register, Then `400 {error.code:"VALIDATION"}`.
2. **Login**
   - Given valid credentials, When `POST /api/auth/login`, Then `200` with `{accessToken, refreshToken, user}` and an audit row `user.login`.
   - Given a wrong password, When login, Then `401 {error.code:"INVALID_CREDENTIALS"}` (same message for unknown email — no user enumeration).
3. **Protected route**
   - Given a valid access token, When `GET /api/auth/me` with `Authorization: Bearer`, Then `200` with the user profile.
   - Given no/invalid/expired token, When `/me`, Then `401 {error.code:"UNAUTHORIZED"}`.
4. **Refresh rotation**
   - Given a valid refresh token, When `POST /api/auth/refresh`, Then `200` with a new access + new refresh token, and the **old refresh token is revoked** (reusing it → `401`).
5. **Logout**
   - Given a refresh token, When `POST /api/auth/logout`, Then `200` and that refresh token is revoked (subsequent refresh → `401`).
6. **Web**
   - Given the login form, When the seeded Owner logs in, Then the app shows the authenticated user (from `/me`); a wrong password shows an inline error; loading + error states present.

## Security notes
- Passwords: **Argon2id** via `@node-rs/argon2` (prebuilt, no native compile). Never logged/returned.
- Access token: JWT (HS256, `jose`), `sub=userId`, short TTL (15m).
- Refresh token: 256-bit random, stored as **SHA-256 hash** (lookup), rotated on every use, revocable; TTL 7 days.
- No user enumeration (identical error for bad email vs bad password).
- Production guard: refuse to boot with the dev-default JWT secret when `NODE_ENV=production`.
- Tokens returned in JSON body for 0.2 (PWA + future mobile); httpOnly-cookie transport noted as future hardening.

## i18n
- Web strings via i18next keys: `auth.login.*`, `auth.errors.*`. No hard-coded copy.

## Tests
- **Unit:** Argon2 hash/verify (match + mismatch); access-token sign→verify (+ tampered → reject).
- **Integration (DB):** register → login → `/me` (+401 no-token) → refresh (old revoked) → logout (revoked). Self-cleaning test user; skipped if no `DATABASE_URL`.
- CI gains a Postgres service + `prisma migrate deploy` so integration tests run.

## DoD
Per CLAUDE.md §2. Staging deploy deferred to 0.6.
