#!/usr/bin/env bash
# Stellt die SQLite-Datenbank (und optional Produktbilder) aus einem Backup wieder her.
# Aufruf:  bash scripts/restore.sh <db-backup.sqlite> [uploads-backup.tar.gz]
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_BACKUP="${1:-}"
UPLOADS_BACKUP="${2:-}"

if [ -z "$DB_BACKUP" ] || [ ! -f "$DB_BACKUP" ]; then
  echo "Verwendung: bash scripts/restore.sh <db-backup.sqlite> [uploads-backup.tar.gz]"
  exit 1
fi

ZIEL_DB="$DIR/prisma/prod.db"
[ -f "$DIR/prisma/dev.db" ] && [ ! -f "$ZIEL_DB" ] && ZIEL_DB="$DIR/prisma/dev.db"

echo "Stelle Datenbank wieder her -> $ZIEL_DB"
cp "$DB_BACKUP" "$ZIEL_DB"

if [ -n "$UPLOADS_BACKUP" ] && [ -f "$UPLOADS_BACKUP" ]; then
  echo "Stelle Produktbilder wieder her"
  mkdir -p "$DIR/public"
  tar -xzf "$UPLOADS_BACKUP" -C "$DIR/public"
fi

echo "Wiederherstellung abgeschlossen. Dienst ggf. neu starten:  systemctl restart kassa"
