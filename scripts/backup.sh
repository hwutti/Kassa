#!/usr/bin/env bash
# Sichert die SQLite-Datenbank und die hochgeladenen Produktbilder.
# Aufruf:  bash scripts/backup.sh [zielverzeichnis]
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ZIEL="${1:-$DIR/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$ZIEL"

DB="$DIR/prisma/prod.db"
[ -f "$DB" ] || DB="$DIR/prisma/dev.db"

if [ ! -f "$DB" ]; then
  echo "Keine Datenbank gefunden ($DB)."
  exit 1
fi

# Konsistente SQLite-Sicherung (nutzt .backup, falls sqlite3 vorhanden).
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" ".backup '$ZIEL/db-$STAMP.sqlite'"
else
  cp "$DB" "$ZIEL/db-$STAMP.sqlite"
fi

# Produktbilder mitsichern (falls vorhanden).
if [ -d "$DIR/public/uploads" ]; then
  tar -czf "$ZIEL/uploads-$STAMP.tar.gz" -C "$DIR/public" uploads
fi

echo "Backup erstellt in: $ZIEL (db-$STAMP.sqlite)"
