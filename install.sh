#!/usr/bin/env bash
# =============================================================================
# POS-Kasse – komplette Installation / Aktualisierung auf einem Linux-Server.
#
# Holt den Code, installiert Abhängigkeiten, richtet die Datenbank ein, baut die
# App und startet sie als systemd-Dienst (idempotent – erneut ausführbar = Update).
#
# Aufruf (als root, z. B. via sudo):
#   curl -fsSL https://raw.githubusercontent.com/hwutti/Kassa/main/install.sh | bash
#
# Optionen über Umgebungsvariablen:
#   DIR=/opt/kassa     Zielverzeichnis      (Standard: /opt/kassa)
#   PORT=3000          HTTP-Port            (Standard: 3000)
#   SEED=1             Demo-Daten einspielen (Standard: 0 = nur beim ersten Mal)
#   BRANCH=main        Git-Branch           (Standard: main)
# =============================================================================
set -euo pipefail

REPO="https://github.com/hwutti/Kassa.git"
DIR="${DIR:-/opt/kassa}"
PORT="${PORT:-3000}"
BRANCH="${BRANCH:-main}"
SEED="${SEED:-0}"
SERVICE="kassa"

log() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
err() { printf '\033[1;31mFehler:\033[0m %s\n' "$*" >&2; }

# --- 0) Node.js sicherstellen (Node 20+ nötig für Next.js 16) --------------
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed -E 's/v([0-9]+).*/\1/')" -lt 20 ]; then
  if command -v apt-get >/dev/null 2>&1; then
    log "Installiere Node.js 20 (NodeSource) …"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  else
    err "Node.js 20+ nicht gefunden und kein apt-get vorhanden. Bitte Node 20+ manuell installieren."
    exit 1
  fi
fi
command -v git >/dev/null 2>&1 || { command -v apt-get >/dev/null 2>&1 && apt-get install -y git; }

log "Node $(node -v), npm $(npm -v)"

# --- 1) Code holen bzw. aktualisieren --------------------------------------
if [ -d "$DIR/.git" ]; then
  log "Aktualisiere vorhandene Installation in $DIR …"
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" reset --hard "origin/$BRANCH"
else
  log "Klone Repository nach $DIR …"
  mkdir -p "$(dirname "$DIR")"
  git clone --depth 1 -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"

# --- 2) Umgebungsdatei (.env) ----------------------------------------------
touch .env
if ! grep -q "^DATABASE_URL=" .env; then
  echo 'DATABASE_URL="file:./prod.db"' >> .env
fi
# AUTH_SECRET bei Bedarf sicher erzeugen (für die Admin-Session).
if ! grep -q "^AUTH_SECRET=" .env; then
  SECRET="$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)"
  echo "AUTH_SECRET=\"$SECRET\"" >> .env
  log "AUTH_SECRET erzeugt."
fi
# Admin-Zugang: aus ENV übernehmen oder einmalig sicher erzeugen und ausgeben.
if ! grep -q "^ADMIN_PASSWORT=" .env; then
  ADMIN_PW="${ADMIN_PASSWORT:-$(openssl rand -base64 12 2>/dev/null || head -c 9 /dev/urandom | base64)}"
  echo "ADMIN_BENUTZER=\"${ADMIN_BENUTZER:-admin}\"" >> .env
  echo "ADMIN_PASSWORT=\"$ADMIN_PW\"" >> .env
  log "Admin-Zugang: Benutzer '${ADMIN_BENUTZER:-admin}', Passwort: $ADMIN_PW  (bitte notieren und nach dem ersten Login ändern)"
fi
# .env für die folgenden Node-Aufrufe laden.
set -a; . ./.env; set +a

# --- 3) Abhängigkeiten ------------------------------------------------------
log "Installiere Abhängigkeiten …"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

# --- 4) Datenbank: Migrationen + Erst-Admin + optional Demo-Daten -----------
log "Richte Datenbank ein …"
npx prisma generate

# migrate deploy anwenden. Schlägt es fehl (z. B. P3005: bestehende DB ohne
# Migrationsverlauf aus einem früheren "db push"), kann mit RESET_DB=1 sauber
# neu aufgesetzt werden – NUR bei einer Installation ohne echte Daten.
if ! npx prisma migrate deploy; then
  if [ "${RESET_DB:-0}" = "1" ]; then
    log "RESET_DB=1: setze Datenbank neu auf (bestehende Daten gehen verloren) …"
    rm -f prisma/prod.db prisma/prod.db-journal prisma/dev.db prisma/dev.db-journal
    npx prisma migrate deploy
    SEED=1
  else
    err "Datenbank-Migration fehlgeschlagen (vermutlich P3005: vorhandene DB ohne Migrationsverlauf)."
    err "Bei einer NEUEN Installation ohne echte Daten erneut ausführen mit  RESET_DB=1"
    exit 1
  fi
fi

if [ "$SEED" = "1" ]; then
  log "Spiele Stammdaten (Bereiche/Kategorien/Produkte ohne Preise, Standard-Veranstaltung) ein …"
  npm run db:seed
fi
log "Lege/aktualisiere Administrator …"
npm run admin:create

# --- 5) Build ---------------------------------------------------------------
log "Baue Anwendung …"
npm run build

# --- 6) systemd-Dienst einrichten/aktualisieren ----------------------------
if command -v systemctl >/dev/null 2>&1; then
  log "Richte systemd-Dienst '$SERVICE' ein (Port $PORT) …"
  cat > "/etc/systemd/system/${SERVICE}.service" <<UNIT
[Unit]
Description=POS-Kasse (PWA)
After=network.target

[Service]
Type=simple
WorkingDirectory=${DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
ExecStart=$(command -v npm) run start -- -p ${PORT}
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable "$SERVICE" >/dev/null 2>&1 || true
  systemctl restart "$SERVICE"
  log "Dienst läuft: systemctl status $SERVICE"
  log "Fertig ✔  →  http://localhost:${PORT}/kasse"
else
  log "Kein systemd gefunden. Start manuell mit:  (cd $DIR && npm run start -- -p $PORT)"
fi
