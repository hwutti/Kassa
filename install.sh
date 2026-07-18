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
if [ ! -f .env ]; then
  log "Lege .env an (SQLite-Datenbank prod.db) …"
  echo 'DATABASE_URL="file:./prod.db"' > .env
fi

# --- 3) Abhängigkeiten ------------------------------------------------------
log "Installiere Abhängigkeiten …"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

# --- 4) Datenbank: Schema + optional Demo-Daten ----------------------------
log "Richte Datenbank ein …"
npx prisma generate
npx prisma db push --accept-data-loss
if [ "$SEED" = "1" ]; then
  log "Spiele Demo-Daten ein …"
  npm run db:seed
fi

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
