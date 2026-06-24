# IFM Staging Runbook (Hostinger VPS)

Mirrors the company-portal deploy model: a **self-hosted GitHub Actions runner on the VPS** rsyncs the repo to `/opt/ifm` and runs `docker compose`. No inbound SSH (Hostinger drops it); the runner dials out to GitHub over 443.

## Architecture
- `web` (nginx) serves the SPA + proxies `/api/` → `api:4000`; published on host `${WEB_PORT}` (default 8095).
- `api` (Node/tsx) runs `prisma migrate deploy` then the server.
- `postgres` + `redis` internal only, named volumes `ifm_pg_prod` / `ifm_redis_prod`.
- Reachable at `http://<vps-ip>:<WEB_PORT>`.

## One-time setup (owner)
1. **Self-hosted runner** — on the VPS, register a runner for `github.com/mkreddykalathuru0506/Integrated-Farming` with label **`ifm-vps`** (GitHub → repo → Settings → Actions → Runners → New self-hosted runner). Install it as a systemd service so it survives reboots (same pattern as the portal's `/opt/actions-runner`). The runner needs Docker access (run as root or a docker-group user).
2. **App dir + env**
   ```bash
   sudo mkdir -p /opt/ifm
   sudo cp /path/to/.env.staging.example /opt/ifm/.env   # then edit:
   #   POSTGRES_PASSWORD = strong value
   #   JWT_ACCESS_SECRET = openssl rand -base64 48   (must NOT start with "dev_only")
   #   WEB_PORT          = 8095 (or your choice)
   ```
3. **Firewall** — open the chosen `WEB_PORT` (e.g. `ufw allow 8095/tcp`).

## Deploy
- **Automatic:** merge to `main` → CI `build` runs → `deploy.yml` (on the VPS runner) waits for `build` to pass, rsyncs to `/opt/ifm`, builds + `up -d`, then smoke-tests `/api/health`.
- **Manual:** Actions → "Deploy to VPS (staging)" → Run workflow. Or on the VPS:
  ```bash
  cd /opt/ifm
  docker compose -f infra/docker/docker-compose.prod.yml --env-file .env up -d --build
  ```

## Verify
```bash
curl http://<vps-ip>:<WEB_PORT>/healthz       # nginx → "ok"
curl http://<vps-ip>:<WEB_PORT>/api/health    # proxy → api → {"status":"ok"}
docker compose -f infra/docker/docker-compose.prod.yml ps
```

## Rollback
- Staging runs cumulative `main`. To roll back: `git revert` the bad commit (→ redeploys), or on the VPS check out the previous source state and rebuild. DB migrations are forward-only — see ADR-0001 (`down.sql` per migration; restore from backup if a migration must be undone).

## Backup & restore
- **Scripted (preferred):** `DATABASE_URL=… ./scripts/backup.sh /opt/ifm/backups` (timestamped,
  gzipped, retention-pruned). Restore: `DATABASE_URL=… ./scripts/restore.sh <dump.sql.gz>`.
- **Cadence:** daily cron — see `docs/monitoring.md`. Copy dumps off-box for DR.
- **Ad-hoc via container:**
  ```bash
  docker compose -f infra/docker/docker-compose.prod.yml exec -T postgres \
    pg_dump --no-owner --no-privileges -U ifm ifm | gzip > ifm-$(date +%F).sql.gz
  ```

## Troubleshooting
- **api restarts / boot fails:** `docker compose ... logs api` — usual cause: `JWT_ACCESS_SECRET` missing or starts with `dev_only` (prod guard), or `POSTGRES_PASSWORD` blank.
- **web 502 on /api:** api not healthy yet; check `docker compose ... ps` and api logs.
- **deploy never starts:** the `ifm-vps` runner is offline — `systemctl status` the runner service on the VPS.
- **.env wiped after deploy:** ensure `.env` stays excluded in `deploy.yml` rsync (it is) — never store it in the repo.

## Monitoring
- Liveness `GET /api/health`; readiness `GET /api/health/ready` (gates on DB).
- Container healthchecks on all four services (`docker compose ... ps` → `healthy`).
- Load sanity before/after a deploy: `node scripts/load-sanity.mjs http://<host>:<WEB_PORT>/api/health 20 5`.
- Full details + external uptime/alerting suggestions: `docs/monitoring.md`.

---

# Production runbook (checkpoint-gated)

Production deploys, schema migrations, and the live VPS cutover are **§1.4 owner checkpoints**.
Do not run these without an explicit `APPROVE`.

## Pre-prod gate (must all be true)
Run the checklist in `docs/security-review.md` → "Pre-prod must-do":
- [ ] Strong `JWT_ACCESS_SECRET` in `/opt/ifm/.env` (env guard rejects the dev placeholder).
- [ ] CORS restricted to the web origin; TLS/HTTPS + HSTS at the edge.
- [ ] Automated backups enabled and a restore rehearsed on scratch.
- [ ] CI green on the release commit.

## Prod deploy procedure
1. **Backup first:** `./scripts/backup.sh /opt/ifm/backups` and copy the dump off-box.
2. **Review migration SQL:** diff new `prisma/migrations/*/migration.sql`; confirm each has a `down.sql`
   (CI test `migrations.down.test` enforces this).
3. **Deploy:** merge to `main` (gated `deploy.yml`) or manually `docker compose -f
   infra/docker/docker-compose.prod.yml --env-file .env up -d --build` (runs `migrate deploy`).
4. **Verify:** `/api/health/ready` → `ready`; `docker compose ... ps` all `healthy`; load sanity.

## Rollback procedure
1. **App rollback:** `git revert` the bad commit (redeploys) or redeploy the previous image/source.
2. **Schema rollback (only if a migration must be undone):**
   - Restore from the pre-deploy backup (cleanest): `./scripts/restore.sh <pre-deploy-dump>`, **or**
   - Apply the migration's hand-written `down.sql` (validated + rehearsed — see below), then
     redeploy matching app code.
3. Re-verify readiness + smoke.

### Rollback rehearsal (proven)
The latest `down.sql` was rehearsed transactionally against the live dev DB:
```
BEGIN; <down.sql>;  -- table dropped inside txn (exists_in_txn = f)
ROLLBACK;           -- restored, data untouched (exists_after = t)
```
This proves the down migration is valid SQL without mutating data. Every migration's `down.sql`
is also asserted non-empty by `apps/api/tests/migrations.down.test.ts`.

## Incident response (quick)
- **API down:** `docker compose ... logs api` → common causes: missing/weak `JWT_ACCESS_SECRET`,
  blank `POSTGRES_PASSWORD`, DB unreachable (`/api/health/ready` shows `db:false`).
- **DB corruption / bad data:** restore the latest good backup (`scripts/restore.sh`).
- **Brute-force / abuse:** auth is rate-limited (429); inspect logs, tighten limits if needed.
- **Runner offline (no deploys):** `systemctl status` the `ifm-vps` runner on the VPS.
