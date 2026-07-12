#!/usr/bin/env bash
# IFM Postgres restore from a gzipped pg_dump. DESTRUCTIVE — overwrites the target DB.
# Usage: DATABASE_URL=postgres://... ./scripts/restore.sh ./backups/ifm-<ts>.sql.gz
# Rehearse on a scratch DB first. See docs/runbook.md (rollback).
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL (target postgres connection string)}"
DUMP="${1:?Usage: restore.sh <dump.sql.gz>}"
[ -f "$DUMP" ] || { echo "[restore] file not found: $DUMP" >&2; exit 1; }

echo "[restore] WARNING: this will apply $DUMP onto $DATABASE_URL"
echo "[restore] starting in 3s (Ctrl-C to abort)…"
sleep 3
gunzip -c "$DUMP" | psql "$DATABASE_URL"
echo "[restore] done"
