# Technisches Konzept & Repository-Analyse

Dieses Dokument fasst die Analyse des Referenzprojekts (Phase 1) und das technische
Umsetzungskonzept (Phase 3) zusammen. Die laufende Anwendung dient zugleich als
funktionierendes Mockup (Phase 2) der Kassen- und Verwaltungsansichten.

## 1. Repository-Analyse (Phase 1)

**Referenz-Repository:** `hwutti/IKTMT-MTGNX` — **Ziel-Repository:** `hwutti/Kassa`.

Die Aufgabenstellung nennt generisch „Java/Maven/Gradle“ als mögliche Referenz-Technologien.
Die tatsächliche Untersuchung des Referenzprojekts zeigt jedoch einen **Next.js/TypeScript-Stack**
— es wird also kein Java verwendet. Übernommen wird daher der reale Stack der Referenz:

| Frage | Referenzprojekt IKTMT-MTGNX | Übernahme für die Kassa |
| --- | --- | --- |
| Sprache/Runtime | TypeScript auf Node.js | ✅ identisch |
| Framework | Next.js (App Router), React | ✅ identisch |
| Build-System | `next build` (npm-Skripte) | ✅ identisch |
| Datenbank | Prisma ORM, SQL (SQLite/Postgres) | ✅ Prisma + SQLite |
| Migrationen | Prisma Migrate (`prisma/migrations`) | ✅ Prisma Migrate |
| Auth | JWT (jose) + gehashte Passwörter, Middleware | ✅ jose + scrypt + Middleware |
| Konfiguration | `.env` / Umgebungsvariablen | ✅ `.env`, `.env.example` |
| Betrieb | systemd, Installations-/Update-Skript | ✅ `install.sh`, systemd |
| Struktur | `src/app` (Routen/API), `src/lib`, `src/components` | ✅ identisch |

**Übernommen:** Projekt-/Paketstruktur, Prisma-Ansatz inkl. Migrationen, JWT-Session mit
Middleware-Schutz, `.env`-Konventionen, systemd-/Skript-basiertes Deployment, Logging über
`console`/`journalctl`, einheitliche Fehlerbehandlung.

**Neu/angepasst für die Kasse:** Datenmodell (Verkaufsbereiche, Kategorien, Produkte, Preise,
Bestellungen), zentrale Sichtbarkeits- und Preislogik, Touch-Kassenoberfläche, PWA (Manifest,
Service Worker, Offline-Verhalten), Auswertungen, Storno, Bild-Upload.

## 2. Architektur (Phase 3)

- **Frontend:** Next.js App Router. Kassenansicht (`/kasse`) und Adminbereich (`/admin`) als
  React-Client-Komponenten; Server-Komponenten für Layout/Session.
- **Backend:** Next.js Route Handler unter `src/app/api/*` (Node-Runtime), Prisma für DB-Zugriff.
- **Trennung:** UI (`components`), Geschäftslogik/zentrale Regeln (`lib`), Datenzugriff (Prisma).
  Preis- und Sichtbarkeitslogik ist an je einer Stelle definiert (`money.ts`, `sichtbarkeit.ts`).

### Datenmodell (Auszug, Details in `prisma/schema.prisma`)
Verkaufsbereich, Kategorie, Produkt, ProduktVerkaufsbereich (n:m), Bestellung,
BestellPosition (mit Snapshot von Name/Kategorie/Einzelpreis), Benutzer (Passwort-Hash),
Preishistorie, Zaehler (fortlaufende Bestellnummer). **Geld als Integer-Cent.**

### Wichtige API-Endpunkte
- `GET /api/kasse/verkaufsbereiche`, `GET /api/kasse/produkte`, `GET /api/kasse/produkt/[id]`
- `POST /api/bestellungen` (transaktionssicher, idempotent)
- `GET /api/health`
- `POST /api/auth/login|logout`
- `GET|POST /api/admin/produkte|kategorien|verkaufsbereiche` (+ `[id]` PATCH/DELETE)
- `GET /api/admin/status`, `GET /api/admin/auswertungen`, `GET /api/admin/bestellungen`,
  `POST /api/admin/bestellungen/[id]/storno`, `POST /api/admin/upload`

### Geschäfts-, Preis- und Bestelllogik
- **Sichtbarkeit:** aktiv + Kategorie aktiv + Bereich aktiv + zugeordnet + gültiger Preis
  (Allgemeine Kassa ohne Zuordnung). Front- **und** Backend-Prüfung.
- **Preis:** nur im Admin, Validierung (nicht negativ, Komma/Punkt), Änderungszeit + Historie;
  neue Bestellungen nutzen den aktuellen Preis, laufende Positionen und abgeschlossene
  Bestellungen behalten ihren Snapshot.
- **Bestellung:** Positionssumme = Einzelpreis × Menge, Gesamtsumme, Rückgeld = erhalten − gesamt;
  zu wenig Bargeld sperrt den Abschluss. Speicherung atomar in einer Transaktion, Bestellnummer
  über Zähler, Idempotenz über `clientRef`.

### Sicherheit
JWT-Session (httpOnly, HS256), Middleware schützt `/admin` und `/api/admin`, scrypt-Hashes,
keine Geheimnisse im Repo (`.env`), serverseitige Validierung aller Mutationen, Upload-Prüfung
(Typ per Magic Bytes, Größe, sicherer Zufallsname, kein SVG).

### PWA-, Cache- und Verbindungskonzept
Manifest + Service Worker (`display: standalone`). Statisches cache-first, **API network-only**
(keine veralteten Preise), Navigation network-first mit Offline-Fallback. Verbindungsstatus über
`navigator.onLine` + Health-Ping. Offline ist der Abschluss gesperrt (kein transaktionssicherer
Offline-Verkauf → bewusst kein stiller Offline-Modus). Updates nur nach Bestätigung und nicht bei
offener Bestellung.

### Teststrategie
Vitest-Unit-Tests für Geld-/Preislogik, Sichtbarkeitsregel, Passwort-Hashing und
Warenkorb-Berechnung. Ergänzend manuelle/HTTP-Verifikation der API- und Auth-Flows.

### Installation
`install.sh` (idempotent): Node, Klon, `.env` inkl. generiertem `AUTH_SECRET`, `npm ci`,
`prisma migrate deploy`, Erst-Admin, Build, systemd-Dienst. Backup/Restore-Skripte, nginx-HTTPS-Beispiel.
