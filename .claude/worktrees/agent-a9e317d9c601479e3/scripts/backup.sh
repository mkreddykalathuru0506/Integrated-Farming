#!/usr/bin/env bash
# IFM Postgres backup — timestamped, gzipped pg_dump.
# Usage: DATABASE_URL=postgres://user:pass@host:port/db ./scripts/backup.sh [outdir]
# On the VPS, run from cron (see docs/monitoring.md). Keeps the last RETENTION dumps.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL (postgres connection string)}"
OUTDIR="${1:-./backups}"
RETENTION="${BACKUP_RETENTION:-14}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUTDIR"
OUT="$OUTDIR/ifm-$TS.sql.gz"

echo "[backup] dumping to $OUT"
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$OUT"
echo "[backup] done: $(du -h "$OUT" | cut -f1)"

# Prune old dumps beyond RETENTION (newest kept).
COUNT="$(ls -1t "$OUTDIR"/ifm-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
if [ "$COUNT" -gt "$RETENTION" ]; then
  ls -1t "$OUTDIR"/ifm-*.sql.gz | tail -n +"$((RETENTION + 1))" | while read -r old; do
    echo "[backup] pruning $old"
    rm -f "$old"
  done
fi
