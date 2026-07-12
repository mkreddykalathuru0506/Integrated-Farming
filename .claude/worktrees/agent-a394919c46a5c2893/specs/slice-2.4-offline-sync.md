# Spec — Slice 2.4: Offline write-queue + background sync + e2e

**Phase:** 2 · **Branch:** `phase-2/slice-2.4-offline-sync` · No schema change

## User story
As a field worker on flaky rural connectivity, I want my daily logs saved even when offline and synced automatically when I'm back online — without duplicates.

## Scope
**In:** IndexedDB (`idb`) write-queue for daily logs; flush on submit, on `online` event, and on load; idempotent replay via `clientLogId`; pending-count UI; deterministic queue unit test (fake-indexeddb); Playwright e2e (offline log → reconnect → synced); a seeded demo batch so logging has a target.
**Out:** offline queue for other entities (logs only for now), conflict resolution beyond idempotent create.

## Behaviour
- `enqueueLog(payload)` → persist to IndexedDB, then `flush()`.
- `flush()` → POST each queued item; on success remove it; on network error, keep it (retry later). Replays are safe (server upserts on `clientLogId`).
- `window` `online` event + app load both trigger `flush()`.

## Acceptance (Given/When/Then)
1. **Unit (fake-indexeddb):** with fetch failing, `enqueueLog` keeps the item (pending=1); when fetch succeeds, `flush` drains it (pending=0); replaying the same `clientLogId` does not duplicate.
2. **E2E (Playwright):** log in → go offline → submit a feed log (shows pending) → go online → the log syncs (pending clears / appears in recent).

## Verification
- Queue unit test runs in CI (deterministic, no browser).
- Playwright e2e run locally for proof; CI e2e wired as a separate workflow.

## DoD
Per CLAUDE.md §2. Completes Phase 2 → end-of-phase checkpoint. New deps: idb, fake-indexeddb, @playwright/test (MIT).
