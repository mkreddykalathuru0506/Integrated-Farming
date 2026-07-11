# Slice 11.3-WEB — auth & account UI (register, OTP login, password reset, profile, sessions)

> Web-only companion to slice 11.3-API (PR #55). **Depends on #55 — the API endpoints this UI
> calls (`otp/request`, `otp/verify`, `forgot`, `reset`, `change-password`, `PATCH /api/me`,
> `/api/me/sessions*`, `sessionId` in login/refresh responses) are NOT on `main` yet.
> Merge order: #55 first, then this PR.** Component tests mock `fetch`, so CI is green
> independently of #55.

## Scope

### 1. Pre-auth experience (`PreAuth` in App's CenterShell)
Client-state view switch between **Sign in / Create account / Forgot password**:

- **Sign in** (`components/LoginForm.tsx`): password visibility toggle (`auth/PasswordInput`),
  "Sign in with a code instead" (email OTP), "Forgot password?" link, create-account link.
  Demo quick-login stays dev-only.
- **OTP sign-in** (`auth/OtpLogin.tsx`): email → `POST /api/auth/otp/request {purpose:'LOGIN'}`
  → 6-digit code entry (`auth/OtpCodeInput`: single input, `inputMode="numeric"`,
  `autoComplete="one-time-code"`, digits-only 6-char mask) → `POST /api/auth/otp/verify` →
  session applied via `AuthContext.loginWithOtp`. Resend button with countdown seeded from the
  server's `retryAfterSec` (`auth/useCountdown`); "use a different email" back-step.
  The issuance response is enumeration-proof → the "sent" note is deliberately generic.
- **Create account** (`auth/RegisterForm.tsx`): RHF + zod (name / email / phone optional
  `^\+?[0-9]{8,15}$` / password min 8 + live strength hint `auth/passwordStrength`), i18n'd zod
  messages, `EMAIL_TAKEN` mapped; success auto-signs-in via the existing login endpoint and
  lands in the app.
- **Forgot password** (`auth/ForgotPasswordForm.tsx`): email → `POST /api/auth/forgot` →
  generic confirmation ("if an account exists…") → code + new password (min 8) →
  `POST /api/auth/reset` → success toast → back to sign-in. Resend with countdown.
- All flows: loading buttons, `ApiError`-code-mapped messages (`auth/errors.ts` — `OTP_INVALID`,
  `EMAIL_TAKEN`, 429, 401, NETWORK), 360 px-friendly (single-column `max-w-sm` card), en + hi.

### 2. Account dialog (user menu → Account, `account/AccountDialog.tsx`)
New item in the Topbar user DropdownMenu opens a Dialog with Tabs:

- **Profile**: name / phone / language form (RHF + zod) → `PATCH /api/me` with **dirty fields
  only** (blank phone never clobbers the stored number — the public user shape doesn't include
  phone). Locale change also calls `i18n.changeLanguage` (persists `ifm.lang`, `<html lang>`
  follows) and the in-memory user is synced via `AuthContext.updateUser`.
- **Security**: change-password (current + new min 8) via `AuthContext.changePassword`;
  note explains other devices are signed out; success toast "Password changed — other sessions
  signed out"; `INVALID_CREDENTIALS` mapped to "Current password is incorrect".
- **Devices** (sessions): DataTable of `GET /api/me/sessions` — device from light client UA
  parsing (`account/device.ts`, browser + OS words, no dependency), IP, signed-in / last-active
  (`fmtDateTime`), **"This device" badge** by matching the `sessionId` captured from
  login/refresh/otp-verify responses. Per-row revoke behind a danger `ConfirmDialog`
  (`DELETE /api/me/sessions/:id`; the current row shows no revoke action) + "Sign out all other
  devices" (`POST /api/me/sessions/revoke-others`) behind its own ConfirmDialog. Loading
  skeleton, empty state, error + retry.

### 3. AuthContext (additive only)
- Captures `sessionId` from login / refresh / otp-verify responses; exposed for the devices tab.
- New methods: `loginWithOtp`, `updateUser`, `changePassword`, `revokeOtherSessions` — the two
  session-identifying calls read the refresh token internally so it **never leaves the provider**.
- Session persistence from 11.1 (boot restore, single-flight 401 refresh-replay) untouched.

## i18n
- `auth` namespace extended (otp / register / forgot / password-toggle keys), new `account`
  namespace — both complete in **en + hi** and added to `CORE_NS` (parity-enforced: 20 tests).

## Acceptance criteria (all demonstrated by component tests, mocked fetch)
- Register happy path: `POST /api/auth/register` payload correct (blank phone omitted) →
  auto-login → refresh token persisted. `EMAIL_TAKEN` → clear message. Short password blocked
  client-side with no network call.
- Forgot → reset: generic confirmation shown; `POST /api/auth/reset {email, code, newPassword}`;
  `onDone` fires + success toast; `OTP_INVALID` mapped and flow stays on the reset step.
- OTP login: request `{email, purpose:'LOGIN'}` → verify `{email, purpose:'LOGIN', code}` →
  session + `sessionId` stored; resend disabled during the server-seeded countdown, re-enabled
  after it elapses and issues a fresh request; `OTP_INVALID` mapped.
- Account: PATCH sends only dirty fields + success toast; sessions render with parsed device
  labels + "This device" badge and revoke only fires after ConfirmDialog confirmation;
  revoke-others sends the presenting refresh token; change-password validates client-side
  (no network call) and sends `{currentPassword, newPassword, refreshToken}`.

## Verification (2026-07-11)
- `pnpm --filter @ifm/web typecheck` / `lint` / `build` — green.
- `pnpm --filter @ifm/web test` — **25 files, 166 tests** (baseline 21/152; +4 files, +13 slice
  tests +1 parity test for the new `account` namespace).
- Root `pnpm typecheck` — green.
- No live-browser step by design: the endpoints aren't on `main` until #55 merges; the
  consolidated live pass happens after both PRs merge.

## Deferred / known limitations
- Profile phone field starts blank (the API's public user shape has no `phone`); blank = keep
  current, explained by the field hint.
- OTP is email-only (matches #55; SMS/WhatsApp channels stay owner-gated behind
  `NotificationService`).
- No Playwright e2e for these flows (component tests only; e2e workflow remains manual,
  offline-sync only).
- Live demo of register → OTP → reset → sessions against a running API happens post-#55-merge.
