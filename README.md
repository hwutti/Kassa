# POS-Kasse – Kirchtagsfest

Touch-fähiges **Kassensystem als installierbare Progressive Web App (PWA)** für ein
Kirchtagsfest. Verschiedene Bedienpersonen rechnen damit schnell und ohne Vorkenntnisse
Getränke, Speisen, Kaffee, Kuchen und Spirituosen ab.

Die Oberfläche erinnert an eine moderne Registrierkasse: große Produktkacheln,
gut sichtbare Summen, automatische Rückgeldberechnung, Bedienung per Fingertipp.

- **Kasse:** `/kasse`
- **Administration (geschützt):** `/admin`

---

## Inhalt

- [Verwendete Technologien](#verwendete-technologien)
- [Projektstruktur](#projektstruktur)
- [Systemvoraussetzungen](#systemvoraussetzungen)
- [Installation unter Ubuntu (One-Liner)](#installation-unter-ubuntu-one-liner)
- [Manuelle Installation / Entwicklung](#manuelle-installation--entwicklung)
- [Konfiguration & Umgebungsvariablen](#konfiguration--umgebungsvariablen)
- [Ersten Administrator anlegen](#ersten-administrator-anlegen)
- [Start / Stopp](#start--stopp)
- [Tests ausführen](#tests-ausführen)
- [Bedienung](#bedienung)
- [Preisverwaltung & „Preis fehlt“](#preisverwaltung--preis-fehlt)
- [PWA installieren](#pwa-installieren)
- [Offline- und Verbindungsverhalten](#offline--und-verbindungsverhalten)
- [Backup & Wiederherstellung](#backup--wiederherstellung)
- [Programm aktualisieren](#programm-aktualisieren)
- [Typische Fehler und Lösungen](#typische-fehler-und-lösungen)

---

## Verwendete Technologien

Der Stack orientiert sich am Referenzprojekt **IKTMT-MTGNX** (das trotz generischer
„Java“-Formulierungen in der Aufgabenstellung tatsächlich ein Next.js/TypeScript-Projekt ist):

| Bereich | Technologie |
| --- | --- |
| Laufzeit | Node.js 20+ (Ubuntu) |
| Framework | Next.js 16 (App Router, React 18) |
| Sprache | TypeScript |
| Datenbank | SQLite (via Prisma; für Skalierung auf PostgreSQL umstellbar) |
| Datenzugriff / Migrationen | Prisma ORM + Prisma Migrate |
| Styling | Tailwind CSS |
| Auth | JWT-Session (jose, HS256) im httpOnly-Cookie, scrypt-Passworthashes |
| Validierung | Zod |
| Tests | Vitest |
| Betrieb | systemd-Dienst, optional nginx (HTTPS) |

**Geldbeträge** werden durchgängig als **Integer in Cent** verarbeitet: exakt, zwei
Nachkommastellen, niemals `float`/`double` – das technische Äquivalent zu `BigDecimal`/`DECIMAL`.

## Projektstruktur

```
prisma/schema.prisma            Datenmodell (Cent-Beträge, preisCent NULL = "Preis fehlt")
prisma/migrations/              Prisma-Migrationen
prisma/seed.ts                  Stammdaten: Bereiche, Kategorien, 47 Produkte OHNE Preise
scripts/create-admin.ts         Erst-Admin anlegen / Passwort zurücksetzen (aus ENV)
scripts/backup.sh, restore.sh   Datensicherung / Wiederherstellung
scripts/gen-icons.mjs           PWA-Icons erzeugen
install.sh                      Komplette Server-Installation (idempotent)
deploy/nginx-kassa.conf         Beispiel-HTTPS-Reverse-Proxy
src/lib/sichtbarkeit.ts         Einzige Wahrheit der Produkt-Sichtbarkeitsregel
src/lib/money.ts                Geld-Helfer (Cent <-> EUR, Preisgültigkeit)
src/lib/session.ts / auth.ts    JWT-Session (Edge-Kern) / Server-Auth-Helfer
src/middleware.ts               Schutz von /admin und /api/admin
src/app/api/kasse/*             Kassen-API (Bereiche, sichtbare Produkte, Einzelprodukt)
src/app/api/bestellungen/*      Bestellung anlegen (transaktionssicher, idempotent)
src/app/api/admin/*             Verwaltung, Auswertungen, Status, Upload, Storno
src/app/kasse, src/app/admin    Kassen- und Verwaltungsoberfläche
public/manifest.webmanifest     PWA-Manifest
public/sw.js                    Service Worker
```

## Systemvoraussetzungen

- Ubuntu (oder anderes Linux); Windows/macOS für Entwicklung
- **Node.js 20+** und npm
- Für den Produktivbetrieb: **HTTPS** (PWA/Service Worker), z. B. via nginx + Let's Encrypt

## Installation unter Ubuntu (One-Liner)

Komplette Installation (Node bei Bedarf, Datenbank, Build, systemd-Dienst, Erst-Admin):

```bash
sudo -H bash -c 'DIR=/opt/kassa PORT=3000 SEED=1 bash <(curl -fsSL https://raw.githubusercontent.com/hwutti/Kassa/main/install.sh)'
```

Danach läuft die Kasse unter `http://SERVER:3000/kasse`. Das Skript ist **idempotent**
(erneut ausführen = Update). Beim ersten Lauf wird ein zufälliges Admin-Passwort erzeugt
und **im Log ausgegeben** – bitte notieren. Alternativ vorab `ADMIN_PASSWORT=…` setzen.

| Variable | Zweck | Standard |
| --- | --- | --- |
| `DIR` | Zielverzeichnis | `/opt/kassa` |
| `PORT` | HTTP-Port | `3000` |
| `SEED` | Stammdaten einspielen (`1`/`0`) | `0` |
| `ADMIN_PASSWORT` | Admin-Passwort vorgeben | (zufällig erzeugt) |
| `BRANCH` | Git-Branch | `main` |

Dienst verwalten: `systemctl status|restart|stop kassa` · Logs: `journalctl -u kassa -f`

## Manuelle Installation / Entwicklung

```bash
git clone https://github.com/hwutti/Kassa.git && cd Kassa
npm install
cp .env.example .env            # Werte anpassen (siehe unten)
npm run db:migrate:dev          # Datenbank + Migrationen
npm run db:seed                 # Stammdaten (Produkte ohne Preise)
npm run admin:create            # Admin aus .env anlegen
npm run dev                     # http://localhost:3000
```

## Konfiguration & Umgebungsvariablen

Alle Geheimnisse liegen in `.env` (nicht im Repository). Vorlage: `.env.example`.

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_URL` | Datenbank, z. B. `file:./prod.db` (SQLite) |
| `AUTH_SECRET` | Signaturschlüssel der Admin-Session (langer Zufallswert!) |
| `ADMIN_BENUTZER` | Benutzername des Erst-Admins (Standard `admin`) |
| `ADMIN_PASSWORT` | Passwort des Erst-Admins (nur für `admin:create`/Seed) |

Zufallswert erzeugen: `openssl rand -base64 48`

## Ersten Administrator anlegen

```bash
ADMIN_BENUTZER="admin" ADMIN_PASSWORT="sicheres-passwort" npm run admin:create
```

Idempotent: erneut ausgeführt setzt es das Passwort zurück. Passwörter werden als
scrypt-Hash gespeichert – niemals im Klartext.

## Start / Stopp

**Entwicklung:** `npm run dev` (Start), `Strg+C` (Stopp).

**Produktion (Build + Start):**
```bash
npm run build
npm run start -- -p 3000
```

**Als systemd-Dienst (vom Installer eingerichtet):**
```bash
systemctl start kassa      # starten
systemctl stop kassa       # stoppen
systemctl restart kassa    # neu starten
systemctl status kassa     # Status
```
Der Dienst startet nach einem Serverneustart automatisch.

## Tests ausführen

```bash
npm run test        # einmalig
npm run test:watch  # im Watch-Modus
npm run typecheck   # TypeScript-Prüfung
```

## Bedienung

**Kasse** (`/kasse`): Verkaufsbereich oben wählen → Kategorie → Produkt antippen
(jeder weitere Tipp erhöht die Menge; zusätzlich Plus/Minus). Gesamtsumme wird
automatisch berechnet, erhaltenes Bargeld eingeben → Rückgeld erscheint →
**Kassieren**. Danach beginnt automatisch eine neue Bestellung.

**Administration** (`/admin`, Login erforderlich):
- **Produkte:** anlegen, bearbeiten, Preis pflegen, Kategorie/Verkaufsbereiche zuordnen, Bild/Icon, sortieren, nach „Preis fehlt“ filtern.
- **Kategorien / Verkaufsbereiche:** anlegen, bearbeiten, aktiv/inaktiv, sortieren, Icon.
- **Preisübersicht:** alle Preise, fehlende Preise, letzte Änderung.
- **Bestellungen:** einsehen und (mit Grund) stornieren.
- **Auswertungen:** Umsätze je Bereich/Kategorie/Produkt, Tagesumsatz, Storni.
- **Übersicht:** Kassenbereitschaft (verkaufbare Produkte, fehlende Preise …).

## Preisverwaltung & „Preis fehlt“

Verkaufspreise werden **ausschließlich im Administrationsbereich** eingegeben – nie im
Code oder in Seed-Daten. Ein Produkt erscheint in der Kasse nur, wenn **alle** Bedingungen
erfüllt sind: Produkt aktiv, Kategorie aktiv, Verkaufsbereich aktiv, Produkt dem Bereich
zugeordnet, **gültiger Preis** hinterlegt. (Ausnahme: die **Allgemeine Kassa** zeigt alle
gültigen, aktiven Produkte.)

Produkte ohne gültigen Preis sind in der Kasse **vollständig unsichtbar** – nicht als
Kachel, nicht suchbar, nicht per Direkt-URL (404), nicht über die API bestellbar (409,
serverseitig geprüft). Im Admin sind sie sichtbar und mit **„Preis fehlt“** markiert.
Wird ein Preis gesetzt, erscheint das Produkt sofort; wird er entfernt, verschwindet es
wieder. **Abgeschlossene Bestellungen bleiben unverändert**, und eine **laufende
Bestellung behält den beim Hinzufügen gültigen Preis**.

## PWA installieren

### Android (Chrome)
Seite öffnen → Menü **⋮ → „App installieren“** / „Zum Startbildschirm hinzufügen“ → bestätigen.

### iPhone / iPad (Safari)
Seite in **Safari** öffnen → **Teilen-Symbol** → **„Zum Home-Bildschirm“** → bestätigen.
(Unter iOS funktioniert die Installation nur über Safari.)

### Desktop (Chrome/Edge)
Installations-Symbol in der Adressleiste **oder** Menü **⋮ → „… installieren“**.

### Aktualisierung der installierten App
Bei neuer Version erscheint unten der Hinweis **„Eine neue Version ist verfügbar“**.
Die Aktualisierung wird **erst nach Klick** auf „Jetzt aktualisieren“ aktiv – und ist
**blockiert, solange eine Bestellung offen ist**, damit nichts verloren geht.

### PWA entfernen
- **Android:** Icon lange drücken → „Deinstallieren“ / „App-Info → Deinstallieren“.
- **iPhone/iPad:** Icon lange drücken → „App entfernen“ → „Vom Home-Bildschirm entfernen“.
- **Desktop (Chrome/Edge):** App öffnen → Menü **⋮ → „… deinstallieren“**.

## Offline- und Verbindungsverhalten

- Statische Ressourcen (App-Shell, CSS, JS, Icons, Produktbilder) werden vom Service
  Worker gecacht – die App bleibt offline lesbar.
- **Produkt- und Preisdaten (`/api/*`) werden nie gecacht** (network-only). Eine veraltete
  Preisliste kann daher nicht unbemerkt für Verkäufe verwendet werden.
- Der **Verbindungsstatus** wird deutlich angezeigt (Badge + roter Banner); geprüft über
  `navigator.onLine` **und** einen `/api/health`-Ping (Server + Datenbank).
- Bei fehlender Verbindung ist der **Bestellabschluss gesperrt**. Eine Bestellung gilt
  **erst nach sicherem Speichern** als abgeschlossen.
- **Kein doppelter/verlorener Verkauf:** Idempotenzschlüssel (`clientRef`, `UNIQUE`),
  transaktionssichere Bestellnummern, gesperrte Abschluss-Schaltfläche während des Speicherns.
- Eine **offene Bestellung übersteht ein versehentliches Neuladen** (lokale Zwischenspeicherung).

## Backup & Wiederherstellung

**Sichern** (Datenbank + Produktbilder):
```bash
bash scripts/backup.sh /pfad/zu/backups
```
Empfohlen als tägliche Aufgabe (cron), z. B.:
```
0 2 * * *  cd /opt/kassa && bash scripts/backup.sh /var/backups/kassa
```

**Wiederherstellen:**
```bash
bash scripts/restore.sh /var/backups/kassa/db-YYYYMMDD-HHMMSS.sqlite \
                        /var/backups/kassa/uploads-YYYYMMDD-HHMMSS.tar.gz
systemctl restart kassa
```

## Programm aktualisieren

Denselben One-Liner erneut ausführen (ohne `SEED=1`, damit keine Stammdaten überschrieben
werden):
```bash
sudo -H bash -c 'DIR=/opt/kassa bash <(curl -fsSL https://raw.githubusercontent.com/hwutti/Kassa/main/install.sh)'
```
Der Installer holt den Code, wendet neue Migrationen an, baut neu und startet den Dienst.

## Typische Fehler und Lösungen

| Problem | Ursache / Lösung |
| --- | --- |
| Kasse zeigt keine Produkte | Produkte haben noch **keinen Preis** → im Admin unter „Produkte“ pflegen (Filter „Preis fehlt“). |
| „Keine Verbindung“ im roten Banner | Server/DB nicht erreichbar → Dienst/Netzwerk prüfen (`journalctl -u kassa -f`). Abschluss ist bis dahin gesperrt. |
| Admin-Login schlägt fehl | Passwort mit `npm run admin:create` (ENV `ADMIN_PASSWORT`) zurücksetzen. |
| PWA lässt sich nicht installieren | **HTTPS** fehlt → nginx + Zertifikat einrichten (siehe `deploy/nginx-kassa.conf`). |
| Bild-Upload abgelehnt | Nur PNG/JPG/WebP bis 2 MB; SVG ist aus Sicherheitsgründen nicht erlaubt. |
| Preisänderung nicht sichtbar | Neue Bestellungen verwenden den neuen Preis; eine bereits laufende Bestellung behält bewusst ihren Preis. |
| `AUTH_SECRET fehlt` | In `.env` einen langen Zufallswert setzen (`openssl rand -base64 48`). |

---

Repository: <https://github.com/hwutti/Kassa>
