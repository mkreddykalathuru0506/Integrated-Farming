# Slice 11.1 — Foundation: web data layer, session, UI kit (no API changes)

> Phase 11 (see `specs/phase-11-modernization.md`). Two sub-slices on one branch
> (`phase-11/slice-11.1-foundation`): **11.1a data layer** and **11.1b UI kit**.
> `apps/api` is not modified; everything here is `apps/web` + `specs/`.

## Why

The brief mandates TanStack Query + RHF + Zod on the frontend; none were present.
Session was memory-only (reload = logout, 15-min access TTL kills the app mid-use),
mutations failed silently (72 `.catch(() => undefined)` sites), query params were
interpolated unencoded, and blob downloads saved JSON error bodies as PDFs. 11.1 lays
the shared foundation every later slice (11.2–11.8) builds on.

## 11.1a — Data layer (this sub-slice)

### Scope

1. **Deps (all MIT, active maintenance):** `@tanstack/react-query`, `@tanstack/react-table`,
   `react-hook-form`, `@hookform/resolvers`, `zod`, `@radix-ui/react-toast`,
   `@radix-ui/react-tabs`, self-hosted `@fontsource/{fraunces,hanken-grotesk,jetbrains-mono,noto-sans-devanagari}`
   (wired by 11.1b); dev: `jsdom`, `@testing-library/{react,dom,user-event,jest-dom}`.
2. **Typed HTTP core** `src/lib/http.ts`: `ApiError {status, code, details}` (code from
   body `error.code`, status-based fallback, `NETWORK` on fetch failure), `qs()` with
   `encodeURIComponent` on every param, single `request<T>()`/`requestBlob()` used by all
   API calls, single `API_URL` constant.
3. **Session persistence + silent refresh** (`auth/AuthContext.tsx`, `auth/api.ts`):
   refresh token persisted to `localStorage['ifm.auth.rt']`; boot-time restore via
   `POST /api/auth/refresh` (rotates + returns the user — no extra `/me` round-trip);
   `authedFetch` injects the current access token and, on 401, performs ONE single-flight
   refresh and replays the original request once; refresh failure → global logout +
   storage cleared + query cache cleared. Context stays backward-compatible
   (`user`, `accessToken`, `login`, `logout`) and gains `restoring`, `authedFetch`.
4. **Farm API client rework** (`farm/api.ts`): all existing exports kept 100%
   source-compatible (27 panels compile unchanged) but routed through `request`;
   `res.ok` enforced everywhere incl. `openInvoicePdf`/`downloadReport` (throw `ApiError`
   instead of downloading a JSON error as a PDF); all query params encoded.
5. **Query layer:** `QueryClientProvider` (staleTime 30 s, retry 1, refetchOnWindowFocus)
   in `main.tsx`; `api/keys.ts` query-key factory (`farmKeys.all/list/detail`);
   `api/FarmContext.tsx` (`FarmProvider` + `useFarmApi()` → `{farmId, fetchJson}` — token
   threading ends here); exemplar hooks `useUnits/useBatches/useSpecies/useCreateUnit/useDeleteUnit`
   in `api/hooks.ts`; **UnitsPanel** converted end-to-end as the reference pattern.
6. **Toast system + mutation wrapper:** `ui/Toast.tsx` (Radix Toast on Harvest semantic
   tokens only; success/error/warning/info; viewport bottom-right, stacked,
   swipe-to-dismiss, 5 s auto-dismiss, a11y via Radix); `lib/useApiMutation.ts`
   (success toast via i18n key, `invalidateQueries` list, error toast mapped
   `errorKeyByCode[code]` → `errors.<code>` → `errors.generic`); new `errors` i18n
   namespace (en+hi) seeded with transport + known domain codes.
7. **i18n restructure:** `src/i18n.ts` → `src/i18n/{index,en,hi}.ts` (pure move, every
   key preserved — parity test still green); language persisted to
   `localStorage['ifm.lang']` and restored at init; `<html lang>` sync kept.
8. **Farm selection persistence:** `localStorage['ifm.farm']`, restored when the farm
   still exists in the member list.
9. **Login UX:** demo-credential prefill removed; DEV-only demo-login button; errors
   distinguished via `ApiError` (401 invalid / 429 rate-limited / NETWORK offline).
10. **Component-test infra:** `vitest.config.ts` (jsdom + jest-dom setup); tests for
    boot-restore, 401 single-flight replay, Toast render/auto-dismiss/variants,
    useApiMutation success/error mapping, UnitsPanel smoke (mocked fetch).

### Acceptance criteria (11.1a)

- Given a logged-in user who reloads the page, when a refresh token is stored, then the
  session is restored silently (loading state shown, no login screen flash), the rotated
  refresh token is persisted, and a failed refresh lands on a clean logged-out state.
- Given any API call that receives 401, when a refresh token exists, then exactly one
  refresh happens (even for N concurrent 401s) and each original request is replayed once.
- Given an API error response, when a panel mutation fails, then `ApiError.code` is
  available and `useApiMutation` shows a translated toast (mapped → `errors.<code>` →
  `errors.generic`); success shows a toast and invalidates the given query keys.
- Given `openInvoicePdf`/`downloadReport` against a failing endpoint, then an `ApiError`
  is thrown and no JSON-as-PDF file is downloaded.
- Given a selected farm and language, when the app reloads, both are restored.
- All existing web tests (21) still pass; new component tests pass; typecheck, lint and
  build are green; `apps/api` untouched.

## 11.1b — UI kit (companion sub-slice, same branch)

Kit components on Harvest tokens: `Dialog`/confirm, `Tabs`, `Table`/`DataTable`
(TanStack Table: sort, client pagination, search, sticky header, mobile collapse),
`Skeleton` (+ variants), `EmptyState`, `Tooltip` wrapper, `Textarea`, `Label`/`FormField`
(RHF-integrated), `Kbd`, `Spinner`, `Button loading` prop; `fmtDate` (DD-MM-YYYY),
`fmtInr`/`InrInput` (integer-paise-safe); self-hosted fonts wired via `@fontsource/*`;
ErrorBoundary + per-section `document.title` + scroll/focus reset on nav; PWA manifest
colours onto Harvest palette. Acceptance: kit components render in both themes at 360 px,
i18n en+hi parity, all gates green.

## Out of scope (lands later)

Per-domain split of `farm/api.ts` and the 27-panel conversion sweep (11.6), per-panel
routes/tabs (11.2), auth/account API surface (11.3), pagination envelope (11.5).
