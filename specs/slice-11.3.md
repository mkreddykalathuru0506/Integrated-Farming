# Slice 11.3-API — OTP login, password lifecycle, profile & session management

> API-only slice. The web UI for these features is a separate later slice.
> Touches auth logic + a schema migration → **§1.4/§3 owner checkpoint: the PR is not merged
> until the owner reviews and merges it.**

## Scope

- **OTP by email**: request + verify one-time 6-digit codes for `LOGIN` and `RESET_PASSWORD`
  (enum also reserves `VERIFY_EMAIL` for later).
- **Password lifecycle**: forgot → reset (OTP-gated, revokes all sessions), authenticated
  change-password (revokes all *other* sessions).
- **Profile**: `PATCH /api/me` (name / phone / locale).
- **Sessions**: refresh tokens now carry `ip` / `userAgent` / `lastUsedAt`; users can list and
  revoke their own sessions. `login` / `refresh` / `otp verify` responses additively include
  `sessionId` (existing fields unchanged).
- **Delivery**: `nodemailer` mailer — real SMTP when `SMTP_HOST` is set, otherwise
  `jsonTransport` (nothing leaves the box) + a dev-console `[otp]` log outside production.

Out of scope: web UI, SMS/WhatsApp OTP channels (behind `NotificationService`, owner-gated),
email verification flow, i18n of email templates (English-only text mail for now).

## Endpoint table

| Method | Path | Auth | Body (Zod-validated) | Success | Failure |
|---|---|---|---|---|---|
| POST | `/api/auth/otp/request` | — (rate-limited 5/15min/IP + global auth limiter) | `{email, purpose: LOGIN\|RESET_PASSWORD}` | **always** `200 {ok:true, retryAfterSec:60}` | `400 VALIDATION`, `429 RATE_LIMITED` |
| POST | `/api/auth/otp/verify` | — | `{email, purpose:'LOGIN', code}` | `200 {accessToken, refreshToken, sessionId, user}` | `401 OTP_INVALID` (uniform) |
| POST | `/api/auth/forgot` | — (rate-limited 5/15min/IP) | `{email}` | same generic 200 as otp/request | `429 RATE_LIMITED` |
| POST | `/api/auth/reset` | — | `{email, code, newPassword ≥8}` | `200 {ok:true}`; revokes ALL refresh tokens; audits `user.password.reset` | `401 OTP_INVALID` |
| POST | `/api/auth/change-password` | Bearer | `{currentPassword, newPassword ≥8, refreshToken}` | `200 {ok:true}`; revokes all OTHER tokens; audits `user.password.change` | `401 INVALID_CREDENTIALS` |
| PATCH | `/api/me` | Bearer | `{name?, phone? (\+?[0-9]{8,15}), locale?}` | `200 {user}` (same public shape as getMe) | `409 PHONE_TAKEN`, `400 VALIDATION` |
| GET | `/api/me/sessions` | Bearer | — | `200 {sessions:[{id, createdAt, lastUsedAt, ip, userAgent}]}` newest first | `401` |
| DELETE | `/api/me/sessions/:id` | Bearer | — | `200 {ok:true}` (own row only) | `404 NOT_FOUND` (incl. foreign rows — no IDOR) |
| POST | `/api/me/sessions/revoke-others` | Bearer | `{refreshToken}` | `200 {revoked:n}` | `401` |

Existing `login`/`refresh` responses gain `sessionId`; all previously existing fields untouched.

## Schema (migration `20260711100149_otp_and_session_metadata`, up + down.sql)

- `enum OtpPurpose { LOGIN, RESET_PASSWORD, VERIFY_EMAIL }`
- `OtpToken` — `userId (FK cascade)`, `purpose`, `channel`, `destination`, `codeHash`,
  `expiresAt`, `consumedAt?`, `attempts (default 0)`, `createdAt`; index `(userId, purpose)`.
- `RefreshToken` + `ip?`, `userAgent?`, `lastUsedAt?` (all nullable — no backfill needed).
- Down rehearsed transactionally (BEGIN → down.sql → ROLLBACK) against a scratch DB.

## Security decisions

1. **Enumeration-proof issuance** — `otp/request` and `forgot` return one constant
   byte-identical `200 {ok:true, retryAfterSec:60}` whether the account exists, is inactive,
   or is inside the resend cooldown. Proven byte-identical in tests.
2. **Codes are peppered HMACs** — `HMAC-SHA256(code, OTP_PEPPER)` hex is stored, never the
   code. A DB leak alone cannot be replayed without the env-only pepper. `OTP_PEPPER`
   defaults to `dev-pepper` outside production; production boot **fails** on the placeholder
   (same pattern as `JWT_ACCESS_SECRET`).
3. **Attempt cap counted before comparison** — attempts increment atomically first; after 5
   attempts the code is dead even if guess #6 is correct. 6 digits × 5 attempts ≈ 5·10⁻⁶
   guess probability per code.
4. **Constant-time comparison** — `crypto.timingSafeEqual` over the two HMACs.
5. **Uniform failure** — every verify failure (unknown user, no active code, expired, cap,
   wrong code) is the same `401 OTP_INVALID`.
6. **Single active code** per (user, purpose): a new issue retires previous unconsumed codes;
   60s resend cooldown limits mail spam per account; codes expire after 10 min and are
   single-use (`consumedAt`).
7. **Rate limiting** — dedicated 5/15min/IP limiter on `otp/request` + `forgot` in addition
   to the existing global `/api/auth` limiter; 429 uses the standard error envelope.
8. **Session revocation semantics** — reset revokes ALL sessions (credential may be
   compromised); change-password keeps only the presenting session; session delete/revoke
   endpoints operate strictly on the caller's own rows (foreign ids → plain 404, no IDOR).
9. **Audit** — `/api/auth` + `/api/me` sit outside the `auditWrite` middleware, so
   `user.password.reset`, `user.password.change`, `user.profile.update`,
   `user.session.revoke`, `user.session.revoke_others` (and OTP `user.login`) write their
   `AuditLog` rows directly, best-effort (failure never breaks the served request).
10. **Delivery is best-effort** — a mail outage does not change the HTTP response (still the
    generic 200) and never leaks whether an account exists.

## Acceptance criteria (all demonstrated by tests / live run)

- Given a registered user, when they request a LOGIN OTP and verify the emailed code, then
  they receive `accessToken` + `refreshToken` + `sessionId` that work on protected endpoints,
  and the code cannot be used twice.
- Given 5 wrong verify attempts, when the correct code is submitted, then it is rejected.
- Given an expired code, verify fails with `OTP_INVALID`.
- Given a second request inside 60s, no new code/row is created but the response is the same
  generic 200; after the cooldown a new request invalidates the previous code.
- Given an unknown email, `otp/request` and `forgot` return byte-identical 200 bodies and
  create nothing.
- Given forgot → reset, the old password stops working, the new one works, ALL prior refresh
  tokens are revoked, and a `user.password.reset` audit row exists.
- Given change-password with the wrong current password → 401; with the right one, every
  other session dies while the caller's refresh token still rotates.
- `PATCH /api/me` round-trips name/locale; a duplicate phone yields `409 PHONE_TAKEN`.
- `GET /api/me/sessions` lists ip/userAgent; `DELETE :id` kills exactly that token (foreign
  id → 404); `revoke-others` leaves only the presenting session.
- The 6th OTP request in 15 min from one IP → `429 RATE_LIMITED`.
- Every migration still has up + non-empty down (`migrations.down.test`); the entire
  pre-existing API suite stays green.

## Verification (2026-07-11)

- `pnpm --filter @ifm/api typecheck` / `lint` / `build` — green (1 pre-existing lint warning
  in `market/service.ts`, untouched).
- `pnpm --filter @ifm/api test` — **63 files, 254 tests passed** (baseline was 58/232;
  +5 files/+22 tests from this slice).
- Live run on a scratch DB: OTP request (known + unknown email → identical 200), console
  `[otp]` code, verify → tokens + sessionId, sessions list with ip/userAgent, PATCH /api/me,
  single-use rejection, audit rows — all observed over HTTP.

## New dependency

- `nodemailer` ^6.9.16 (+ dev `@types/nodemailer`) — MIT, de-facto standard Node mailer,
  actively maintained. Chosen for the free `jsonTransport` (CI-safe, no network) and plain
  SMTP support without any paid service.
