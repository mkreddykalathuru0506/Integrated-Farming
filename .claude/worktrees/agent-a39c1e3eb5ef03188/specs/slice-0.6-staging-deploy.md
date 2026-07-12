# Spec — Slice 0.6: Staging deploy on Hostinger VPS

**Phase:** 0 · **Branch:** `phase-0/slice-0.6-staging-deploy` · **⚠️ touches owner's VPS — confirm before connecting**

## Decision (owner)
Mirror the **company portal** deployment process: a **self-hosted GitHub Actions runner on the VPS** (Hostinger drops inbound SSH from GitHub runners), which rsyncs the repo to `/opt/ifm` and runs `docker compose -f infra/docker/docker-compose.prod.yml build && up -d`. Docker is already installed. Reachable via **VPS IP:port over HTTP**.

## Scope
**In:** production `infra/docker/` (Dockerfile.api, Dockerfile.web + nginx, docker-compose.prod.yml), a self-hosted-runner `deploy.yml` gated on the CI `build` check, `.env.staging.example`, runbook (deploy/rollback/backup/runner setup), post-deploy smoke. **Local verification** of the full production stack.
**Out:** HTTPS/domain + reverse-proxy (later), prod hardening/backups automation (Phase 9). Auto-migrate-on-deploy is fine for **staging**; prod stays checkpoint-gated.

## Architecture (mirrors portal)
- `web` = nginx serving the built SPA, proxying `/api/` → `api:4000` (same-origin; SPA built with `VITE_API_URL=""`), `/healthz` for healthcheck. Published on host `${WEB_PORT:-8095}`.
- `api` = Node/tsx container; on start runs `prisma migrate deploy` then the server.
- `postgres` + `redis` internal only (named volumes). Container logs capped (json-file 10m×3).
- Deploy: self-hosted runner (`[self-hosted, ifm-vps]`) → wait for `build` check → rsync to `/opt/ifm` (excludes `.env*`) → flock shared `/tmp/vps-deploy.lock` → compose build (sequential) + up -d → smoke `curl :WEB_PORT/api/health`.

## Acceptance criteria
1. **Images build** — `docker compose -f infra/docker/docker-compose.prod.yml build` succeeds for api + web.
2. **Stack runs** — `up -d`; postgres/redis healthy; api applies migrations; web healthy.
3. **Same-origin routing** — `GET http://localhost:<WEB_PORT>/healthz` → `ok`; `GET /api/health` (via nginx proxy) → `200`.
4. **End-to-end through proxy** — register + login via `http://localhost:<WEB_PORT>/api/auth/*` → `200` (nginx→api→postgres).
5. **Deploy machinery** — `deploy.yml` + runbook present; exact owner setup steps documented.
6. **Secrets** — server-only `.env` (gitignored); `.env.staging.example` committed; no secrets in the repo.

## What the owner must do (no secrets in chat)
- Register a **self-hosted runner** on the VPS for this repo with label `ifm-vps` (systemd, like the portal's).
- Create `/opt/ifm` and an `/opt/ifm/.env` from `.env.staging.example` (strong `JWT_ACCESS_SECRET`, `POSTGRES_PASSWORD`).
- Pick the host port (default 8095) and open it on the VPS firewall.

## Verification
Local: build + up the prod compose, smoke health + register/login through nginx. *(Actual VPS cutover happens after the owner sets up the runner + `/opt/ifm/.env`; I will not connect to the VPS.)*

## DoD
Per CLAUDE.md §2 (staging deploy criterion satisfied locally; live VPS deploy is owner-gated).
