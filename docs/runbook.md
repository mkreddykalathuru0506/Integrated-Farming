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

## Backup (staging, manual)
```bash
docker compose -f infra/docker/docker-compose.prod.yml exec -T postgres \
  pg_dump -U ifm ifm | gzip > ifm-$(date +%F).sql.gz
```
(Automated daily backups + monitoring land in Phase 9.)

## Troubleshooting
- **api restarts / boot fails:** `docker compose ... logs api` — usual cause: `JWT_ACCESS_SECRET` missing or starts with `dev_only` (prod guard), or `POSTGRES_PASSWORD` blank.
- **web 502 on /api:** api not healthy yet; check `docker compose ... ps` and api logs.
- **deploy never starts:** the `ifm-vps` runner is offline — `systemctl status` the runner service on the VPS.
- **.env wiped after deploy:** ensure `.env` stays excluded in `deploy.yml` rsync (it is) — never store it in the repo.

## Production note
This is **staging** (auto-migrate on deploy is acceptable). Production deploys are **checkpoint-gated**: backup first, review migration SQL, then `migrate deploy` (brief §1.4). Prod hardening/runbook expand in Phase 9.
