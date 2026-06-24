# Monitoring, Backups & Load Sanity — IFM (Phase 9)

## Health endpoints
- **Liveness:** `GET /api/health` → `200 {status:"ok"}` (process is up).
- **Readiness:** `GET /api/health/ready` → `200 {status:"ready",checks:{db}}` or `503` when the
  DB is unreachable. Use this for load-balancer / orchestrator gating.

## Container healthchecks (`infra/docker/docker-compose.prod.yml`)
- `postgres`, `redis`: built-in healthchecks (existing).
- `api`: Node `fetch` against `/api/health/ready` (gates on DB). `web` waits for `api`
  `service_healthy`.
- `web`: `wget --spider http://localhost:80/`.
- `restart: unless-stopped` on every service; JSON file logging with rotation (`*default-logging`).

Check status: `docker compose -f infra/docker/docker-compose.prod.yml ps` (look for `healthy`).

## Backups (`scripts/backup.sh` / `scripts/restore.sh`)
- **Backup:** `DATABASE_URL=… ./scripts/backup.sh [outdir]` → timestamped `ifm-<ts>.sql.gz`
  (gzipped `pg_dump`), pruned to the newest `BACKUP_RETENTION` (default 14).
- **Restore (destructive):** `DATABASE_URL=… ./scripts/restore.sh ./backups/ifm-<ts>.sql.gz`.
  Always rehearse on a scratch DB first.
- **Cadence (VPS cron, owner-gated setup):**
  ```cron
  # daily 02:30 IST — adjust path/DATABASE_URL
  30 2 * * *  cd /opt/ifm && DATABASE_URL="$DATABASE_URL" ./scripts/backup.sh /opt/ifm/backups >> /var/log/ifm-backup.log 2>&1
  ```
- Store dumps off-box (object storage / rsync) before relying on them for DR.

## Load sanity (`scripts/load-sanity.mjs`, dependency-free)
- `node scripts/load-sanity.mjs <url> <concurrency> <seconds>` → throughput + p50/p95/p99.
- Local smoke (not a benchmark) to catch gross regressions before/after a deploy. Example:
  `node scripts/load-sanity.mjs http://localhost:4000/api/health 20 5`.

## Suggested external monitoring (post-cutover)
- Uptime ping on `/api/health/ready` (e.g. UptimeRobot / Better Uptime) with alert routing.
- Disk + memory alerts on the VPS; alert if a daily backup file is missing.
- Ship container logs to a central sink if/when scale warrants.
