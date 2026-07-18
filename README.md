# POS-Kasse

Touch-fähiges Kassensystem als installierbare **Progressive Web App (PWA)**.
Verwaltet Verkaufsbereiche, Kategorien, Produkte und Preise und bietet eine
responsive Kassenansicht für Smartphone, Tablet, Notebook, Desktop und
Touch-Kassenmonitor.

Stack: **Next.js 16** (App Router) · **Prisma** (SQLite) · **Tailwind CSS** · TypeScript.

---

## Installation auf dem Server (One-Liner)

Komplette Installation auf einem Linux-Server (Node wird bei Bedarf mitinstalliert,
Datenbank eingerichtet, App gebaut und als systemd-Dienst gestartet):

```bash
sudo -H bash -c 'DIR=/opt/kassa PORT=3000 SEED=1 bash <(curl -fsSL https://raw.githubusercontent.com/hwutti/Kassa/main/install.sh)'
```

Danach läuft die Kasse unter `http://SERVER:3000/kasse`. Der Aufruf ist **idempotent** –
erneut ausgeführt aktualisiert er die Installation (Code neu holen, bauen, Dienst neu starten).

| Variable | Zweck | Standard |
| --- | --- | --- |
| `DIR` | Zielverzeichnis | `/opt/kassa` |
| `PORT` | HTTP-Port | `3000` |
| `SEED` | Demo-Daten einspielen (`1`/`0`) | `0` |
| `BRANCH` | Git-Branch | `main` |

Nur aktualisieren (ohne Demo-Daten):

```bash
sudo -H bash -c 'DIR=/opt/kassa bash <(curl -fsSL https://raw.githubusercontent.com/hwutti/Kassa/main/install.sh)'
```

Dienst verwalten: `systemctl status|restart|stop kassa` · Logs: `journalctl -u kassa -f`

> Für den produktiven PWA-Betrieb (Installierbarkeit, Service Worker) ist **HTTPS** erforderlich –
> üblicherweise über einen Reverse-Proxy (nginx/Caddy) vor dem Port.

---

## Schnellstart (Entwicklung)

```bash
npm install
cp .env.example .env          # DATABASE_URL="file:./dev.db"
npm run db:push               # Datenbankschema anlegen
npm run db:seed               # Demo-Daten (inkl. Testfälle "Preis fehlt" etc.)
npm run gen:icons             # PWA-Icons erzeugen (liegen bereits bei)
npm run dev                   # http://localhost:3000
```

- **Kasse:** `/kasse`
- **Verwaltung:** `/admin`

### Nützliche Skripte

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build && npm start` | Produktionsbuild + Start |
| `npm run typecheck` | TypeScript prüfen |
| `npm run test` | Unit-Tests (Vitest) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | DB zurücksetzen + neu seeden |

---

## Kernregel: Sichtbarkeit von Produkten

Ein Produkt erscheint in der **Kassenansicht** nur, wenn **alle** Bedingungen erfüllt sind:

1. Produkt ist **aktiv**,
2. zugehörige **Kategorie ist aktiv**,
3. gewählter **Verkaufsbereich ist aktiv**,
4. Produkt ist dem Verkaufsbereich **zugeordnet**,
5. ein **gültiger Preis** ist hinterlegt (nicht leer).

Diese Regel ist an genau einer Stelle definiert: [`src/lib/sichtbarkeit.ts`](src/lib/sichtbarkeit.ts).
Sie wird für Liste, **Suche**, **Direkt-URL-Abruf** (`/api/kasse/produkt/[id]`) und die
**Bestell-Validierung** verwendet. Produkte ohne gültigen Preis sind daher:

- nicht als Kachel sichtbar,
- nicht suchbar,
- nicht per Direkt-URL abrufbar (HTTP 404),
- nicht zu einer Bestellung hinzufügbar (HTTP 409, serverseitig erneut geprüft).

Im **Administrationsbereich** bleiben sie sichtbar und sind deutlich mit
**„Preis fehlt"** gekennzeichnet. Sobald ein gültiger Preis gespeichert wird,
erscheint das Produkt (bei Erfüllung der übrigen Bedingungen) in der Kasse.
Wird der Preis entfernt, verschwindet es dort wieder. **Bereits abgeschlossene
Bestellungen bleiben unverändert.**

> Geldbeträge werden intern durchgängig als **Integer in Cent** gespeichert –
> keine Fließkomma-Rundungsfehler. Ein fehlender Preis ist `NULL`.

---

## Responsive Bedienung

- **Smartphone:** Bereich/Kategorie oben, 1–2-spaltige Kacheln, fixierte
  „Bestellung"-Leiste mit jederzeit sichtbarer Gesamtsumme, Bestellung als Bottom-Sheet.
- **Tablet/Desktop/Kasse:** Produktübersicht plus dauerhaft sichtbare Bestell-Sidebar
  mit Gesamtsumme, Geldeingabe und Rückgeld.
- Hoch- und Querformat werden unterstützt, kein horizontales Scrollen.
- **Touch:** große Klickflächen, ausreichend Abstand, keine Hover-/Rechtsklick-Zwänge,
  On-Screen-Ziffernblock und numerische Bildschirmtastatur (`inputMode`) für die Geldeingabe,
  Schutz vor doppeltem Auslösen (Button gesperrt während des Speicherns + Idempotenzschlüssel).

---

## PWA – Installation

Die App ist installierbar (gültiges Manifest, Service Worker, Icons, `display: standalone`).

### Android (Chrome)
1. Seite im Chrome öffnen.
2. Menü **⋮ → „App installieren"** bzw. **„Zum Startbildschirm hinzufügen"**.
3. Bestätigen – die App erscheint im App-Drawer und startet ohne Browser-Leiste.

### iPhone / iPad (Safari)
1. Seite in **Safari** öffnen (nicht Chrome – Installation läuft unter iOS nur über Safari).
2. **Teilen-Symbol** (Quadrat mit Pfeil) antippen.
3. **„Zum Home-Bildschirm"** wählen, Namen bestätigen.
4. Die App startet als eigenständiges Symbol im Standalone-Modus.

### Desktop (Chrome/Edge)
1. Seite öffnen.
2. Installations-Symbol in der Adressleiste (Monitor mit Pfeil) **oder**
   **⋮ → „… installieren"**.
3. Die App öffnet sich in einem eigenen Fenster.

### Aktualisierung der installierten App
- Der Service Worker sucht beim Öffnen/Fokussieren nach einer neuen Version.
- Ist eine neue Version verfügbar, erscheint unten der Hinweis **„Eine neue Version ist verfügbar"**.
- Die neue Version wird **erst nach bewusstem Klick** auf „Jetzt aktualisieren" aktiv.
- Ist gerade eine **Bestellung offen**, wird die Aktualisierung blockiert, bis die
  Bestellung abgeschlossen oder verworfen wurde – so geht keine laufende Bestellung verloren.

---

## Offline- und Verbindungsverhalten

- **Statische Ressourcen** (App-Shell, CSS, JS, Icons) werden vom Service Worker
  zwischengespeichert – die App bleibt offline lesbar.
- **Produkt- und Preisdaten** (`/api/*`) werden **nie** gecacht (network-only). So kann
  keine veraltete Preisliste unbemerkt für neue Verkäufe verwendet werden.
- Der **Verbindungsstatus** wird deutlich angezeigt (Badge „Online/Offline" +
  roter Banner bei fehlender Verbindung); geprüft über `navigator.onLine` **und**
  einen `/api/health`-Ping (Server + Datenbank).
- Bei fehlender Verbindung ist der **Bestellabschluss gesperrt**. Eine Bestellung gilt
  **erst nach sicherem Speichern** (HTTP 2xx) als abgeschlossen – vorher wird kein Erfolg angezeigt.
- **Kein Verkauf geht verloren oder wird doppelt gespeichert:** jede Bestellung trägt einen
  **Idempotenzschlüssel** (`clientRef`, `UNIQUE`); Wiederholungen liefern dieselbe Bestellung.
  Bestellnummern werden **transaktionssicher** über einen Zähler vergeben.

> Ein vollständiger Offline-Verkaufsmodus ist bewusst **nicht** umgesetzt: Bei fehlender
> Verbindung bleibt die App lesbar, sperrt aber neue Abschlüsse (transaktionssicher statt riskant).

---

## Projektstruktur

```
prisma/schema.prisma            Datenmodell (Beträge in Cent, preisCent NULL = "Preis fehlt")
prisma/seed.ts                  Demo-Daten inkl. Testfälle
src/lib/sichtbarkeit.ts         Einzige Wahrheit der Sichtbarkeitsregel
src/lib/money.ts                Geld-Helfer (Cent <-> EUR, Preisgültigkeit)
src/app/api/kasse/*             Kassen-API (Bereiche, sichtbare Produkte, Einzelprodukt)
src/app/api/bestellungen/*      Bestellung anlegen (transaktionssicher, idempotent)
src/app/api/admin/*             Verwaltung (Produkte, Kategorien, Verkaufsbereiche)
src/components/kasse/*          Kassenansicht (Warenkorb, Geldrechner, Beleg)
src/components/admin/*          Verwaltungs-UI
src/components/PwaController.tsx SW-Registrierung, Verbindungs-/Update-Hinweise
public/manifest.webmanifest     PWA-Manifest
public/sw.js                    Service Worker
```

---

## Produktivbetrieb

- **HTTPS ist erforderlich**, damit Service Worker/Installation funktionieren.
- Für Mehrbenutzerbetrieb empfiehlt sich ein Wechsel des Prisma-Providers von SQLite
  auf **PostgreSQL** (`DATABASE_URL` anpassen, `prisma migrate deploy`).
