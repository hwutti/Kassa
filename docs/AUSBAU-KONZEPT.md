# Ausbau zum Mehrbenutzer-Bestell- und Ausgabesystem – Analyse & Konzept

> Status: **Konzept zur Freigabe** (Phase 1 Analyse + Phase 3 technisches Konzept).
> Die Umsetzung (Phase 4) beginnt erst nach ausdrücklicher Freigabe von Konzept **und** Mockups.
> Mockups: siehe separater klickbarer HTML-Prototyp.

## 0. Zielbild

Aus der bestehenden Einzel-Kasse wird ein System, in dem **Kellner** Bestellungen bei
Gästen aufnehmen. Positionen werden automatisch an die zuständigen **Arbeitsbereiche**
(Küche, Bier, Wein, Kaffee/Kuchen, Schnaps) verteilt. Jeder Bereich sieht nur seine
Positionen. Eine **globale Übersicht** zeigt den Fortschritt. Eine Bestellung gilt erst
als abgeschlossen, wenn **alle Positionen fertig**, **bezahlt** und vom Kellner
**ausgeliefert** bestätigt sind. Mehrere Personen arbeiten gleichzeitig auf verschiedenen
Geräten (Echtzeit).

Die bestehende Schnell-Kasse (Tippen → Kassieren) bleibt als eigener Modus erhalten
(„Direktverkauf" am Stand, ohne Kellner/Tisch). Der neue Kellner-Ablauf kommt daneben.

---

## 1. Phase 1 – Analyse des Bestands

### 1.1 Vorhandene Bausteine (wiederverwendbar)

| Bereich | Ist-Stand | Übernahme |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 18, TypeScript | ✅ unverändert |
| DB/ORM | Prisma + SQLite, Migrationen (`prisma/migrations`) | ✅ erweitern |
| Auth | JWT (jose, HS256) im httpOnly-Cookie, `src/middleware.ts` schützt `/admin`+`/api/admin`; scrypt-Hashes | ✅ Basis für Rollen |
| Benutzer | `Benutzer` (benutzername, passwortHash, **rolle**, aktiv, letzterLogin) + Verwaltung | ✅ um Rollen/Rechte erweitern |
| Geld | Integer-Cent, zentral in `src/lib/money.ts` | ✅ unverändert |
| Sichtbarkeit/Preise | zentral in `src/lib/sichtbarkeit.ts`; „Preis fehlt" = preisCent NULL | ✅ um Bereichs-Bedingung erweitern |
| Bestellung | `Bestellung` (nummer, status, summeCent, storno, veranstaltung), `BestellPosition` (Snapshots: produktName, kategorieName, verkaufsbereichName, einzelpreisCent) | ✅ erweitern (Status-Trennung, Kellner, Tickets) |
| Nummern | `Zaehler` transaktionssicher; Idempotenz via `clientRef UNIQUE` | ✅ unverändert |
| Bereiche | `Verkaufsbereich` (Verkaufskontext an der Kasse) | ⚠️ **fachlich getrennt** vom neuen „Arbeitsbereich" (Ausgabe/Küche) – siehe 3.2 |
| Produkt→Bereich | `ProduktVerkaufsbereich` (Verkaufszuordnung) | ➕ zusätzlich `ProduktArbeitsbereich` (Zubereitung) |
| PWA | Manifest, SW, Offline-Sperre, Update-Guard, Install-Button | ✅ unverändert |
| Dialoge/UI | `DialogProvider`, Designs, Themes | ✅ unverändert |
| Auswertungen | Umsatz je Bereich/Kategorie/Produkt/Veranstaltung | ✅ um Kellner/Zeiten erweitern |

### 1.2 Zu erweiternde Tabellen
- `Benutzer`: Rolle als Enum-artige Menge (ADMIN, KELLNER, BEREICH, KASSA, SUPERVISOR),
  feingranulare Rechte (darfZahlen, darfStornieren), Anzeigename.
- `Bestellung`: getrennte Statusfelder (`zubereitungStatus`, `zahlungStatus`,
  `auslieferungStatus`) statt nur `status`; Kellner-Bezug, Tisch/Gast/Abholnummer,
  Notiz, **Version** (optimistisches Locking), Zeitstempel.
- `BestellPosition`: Positionsstatus, Arbeitsbereich-Snapshot (Feld vorhanden:
  `verkaufsbereichName` → zusätzlich `arbeitsbereich`), Positionsnotiz.

### 1.3 Neue Tabellen
`Arbeitsbereich`, `ProduktArbeitsbereich`, `BenutzerArbeitsbereich`, `Bereichsticket`,
`Zahlung`, `AuditEreignis`. (Details in Abschnitt 4.)

### 1.4 Kompatibilität / Migration bestehender Daten (Risiken)
- Bestehende Bestellungen haben nur `status` (ABGESCHLOSSEN/STORNIERT). Migration setzt
  daraus die drei neuen Status (z. B. ABGESCHLOSSEN → zubereitung=READY,
  zahlung=PAID, auslieferung=DELIVERED, order=COMPLETED; STORNIERT → CANCELLED).
- Bestehende Bestellungen ohne Kellner → Standard-Kellner „Altsystem".
- Produkte ohne Arbeitsbereich → Standard-Arbeitsbereich „Allgemein" (aus jeder
  Kategorie ableitbar, aber als echte Zuordnung gespeichert – **nicht** hart im Code).
- **Risiko:** Umbenennung/Änderung von `Bestellung.status` könnte bestehende
  Kassen-API/Storno berühren. **Gegenmaßnahme:** `status` bleibt als abgeleitetes
  Gesamt-Feld erhalten; neue Felder additiv. Kein Feld wird gelöscht.
- **Backup vor Migration** verpflichtend (`scripts/backup.sh`); alle Migrationen additiv,
  Alt-Zuordnungen werden protokolliert.

---

## 2. Rollen & Berechtigungen (serverseitig geprüft)

| Rolle | Kernrechte |
| --- | --- |
| **ADMIN** | alles verwalten (Benutzer, Rollen, Rechte, Produkte, Preise, Bereiche, Zuordnungen, Einstellungen, Storno, Auswertungen) |
| **KELLNER** | Bestellung aufnehmen/absenden, eigene offene Bestellungen + Fortschritt sehen, abholen/ausliefern bestätigen, Zahlung erfassen *(wenn Recht `darfZahlen`)* |
| **BEREICH** | Tickets der zugewiesenen Arbeitsbereiche sehen, Positionen annehmen/in Vorbereitung/fertig; keine Preise, keine Auslieferung |
| **KASSA** | zahlungsbereite Bestellungen suchen/öffnen, Zahlung erfassen, Rückgeld; ggf. Zahlungskorrektur |
| **SUPERVISOR** | alle offenen Bestellungen/Bereiche sehen, Verzögerungen erkennen, neu zuweisen, eingreifen |

Rechte werden **im Backend** in einer zentralen `berechtigung.ts` geprüft; Middleware
schützt die neuen Routen nach Rolle. Frontend-Ausblendung ist nur Komfort, nicht Schutz.

---

## 3. Architektur

### 3.1 Grundprinzip
Server bleibt die verbindliche Datenquelle. Alle schreibenden Aktionen laufen über
Route-Handler mit **Transaktion + Statusprüfung + Rechteprüfung + Versionsprüfung**.
Zentrale Module: `statuslogik.ts` (erlaubte Übergänge), `berechtigung.ts` (Rechte),
`money.ts` (Beträge), `sichtbarkeit.ts` (verkaufbare Produkte).

### 3.2 „Verkaufsbereich" vs. „Arbeitsbereich" (wichtige Klärung)
- **Verkaufsbereich** (bestehend): Verkaufskontext/Filter in der Schnell-Kasse
  („Getränkeausschank", „Allgemeine Kassa"). Bleibt.
- **Arbeitsbereich** (neu): Ausgabe-/Zubereitungsstelle (Küche, Bierausgabe …), an die
  Positionen zur Bearbeitung geroutet werden. Neu.
- Ein Produkt hat: 0..n Verkaufsbereiche (wo verkaufbar) **und** genau einen primären
  Arbeitsbereich (+ optional weitere), konfigurierbar im Admin.

### 3.3 Echtzeit
Bevorzugt **Server-Sent Events (SSE)** (`GET /api/ereignisse` als EventStream) – passt zu
Next.js Route-Handlern, kein Zusatzserver, funktioniert hinter nginx. Fallback:
kontrolliertes Polling (alle 3–5 s) wenn SSE unterbrochen ist. Bei Verbindungsverlust:
sichtbarer Status, Auto-Reconnect, danach vollständiger Neuladen des Serverstands.

### 3.4 PWA/Offline
Absenden, Statuswechsel, Zahlung, Auslieferung erfordern **Serververbindung** (kein
stiller Offline-Modus – verhindert doppelte/verlorene Bestellungen). Entwurf bleibt lokal
erhalten. Offline → deutlich anzeigen, Absenden sperren, nach Reconnect neu laden.

---

## 4. Datenmodell (additiv)

```
Arbeitsbereich            id, name, beschreibung, icon, aktiv, sortierung, timestamps
ProduktArbeitsbereich     produktId, arbeitsbereichId, primaer(bool), aktiv, sortierung
BenutzerArbeitsbereich    benutzerId, arbeitsbereichId
Benutzer   (+)            anzeigename, rolle(ADMIN|KELLNER|BEREICH|KASSA|SUPERVISOR),
                          darfZahlen(bool), darfStornieren(bool)
Bestellung (+)            kellnerId?, tisch?, gast?, abholnummer?, notiz?,
                          zubereitungStatus, zahlungStatus, auslieferungStatus,
                          version(Int), abgesendetAm?, abgeschlossenAm?
BestellPosition (+)       arbeitsbereich(String snapshot), notiz?, status
Bereichsticket            id, bestellungId, arbeitsbereichId, status, version,
                          angenommenAm?, fertigAm?, abgeholtAm?, bearbeiterId?
Zahlung                   id, bestellungId, art, betragCent, gegebenCent, rueckgeldCent,
                          status, benutzerId, zeitpunkt
AuditEreignis             id, bestellungId?, positionId?, ticketId?, benutzerId,
                          typ, alterWert?, neuerWert?, grund?, zeitpunkt
```
Geld bleibt Integer-Cent. Snapshots (Name, Einzelpreis, Kategorie, Arbeitsbereich) werden
beim Absenden festgeschrieben und durch spätere Preisänderungen nicht verändert.

---

## 5. Statusmodell

**Bestellung:** `DRAFT → SUBMITTED → IN_PROGRESS → READY_FOR_PICKUP → COLLECTED → DELIVERED → COMPLETED`; quer: `CANCELLED`.
**Bereichsticket:** `QUEUED → ACCEPTED → IN_PREPARATION → READY → COLLECTED`; `CANCELLED`.
**Position:** `QUEUED → IN_PREPARATION → READY → COLLECTED → DELIVERED`; `CANCELLED`.
**Zahlung:** `UNPAID → PAYMENT_PENDING → PAID` (+ `REFUNDED`, `PARTIALLY_REFUNDED`, `PAYMENT_CANCELLED`).
**Auslieferung:** `NOT_READY → READY_FOR_PICKUP → COLLECTED → DELIVERED`.

**Abschlussregel (serverseitig erzwungen):** `COMPLETED` nur wenn alle nicht-stornierten
Positionen `DELIVERED` **und** Zahlung `PAID` **und** Kellner-Auslieferung bestätigt.
Übergänge zentral in `statuslogik.ts`; unzulässige/übersprungene Übergänge werden abgelehnt.

---

## 6. API (neue/erweiterte Endpunkte, additiv)
`auth/login` (bestehend, rollenfähig) · `me` · `kellner/produkte` · `kellner/bestellungen`
(POST anlegen/absenden, GET eigene) · `bestellungen/[id]` (GET Detail/Fortschritt) ·
`bestellungen/[id]/position` (hinzufügen/stornieren) · `bereich/tickets` (GET) ·
`tickets/[id]/status` (annehmen/vorbereiten/fertig) · `bestellungen/[id]/abholen` ·
`bestellungen/[id]/ausliefern` · `bestellungen/[id]/zahlung` · `uebersicht` (global) ·
`ereignisse` (SSE). Bestehende Kassen-/Admin-Endpunkte bleiben unverändert.

Jede schreibende Route prüft: angemeldet · Recht · Bestellung existiert · Status erlaubt ·
Version aktuell · Produkte aktiv+bepreist · Summen serverseitig neu berechnet
(keine Frontend-Beträge übernehmen).

---

## 7. Gleichzeitigkeit & Konsistenz
Optimistisches Locking über `version` (Bestellung/Ticket): Update nur, wenn Version
unverändert – sonst 409 + Neuladen. Idempotenz-Schlüssel gegen Doppel-Absenden/Doppel-Zahlung.
Alle mehrstufigen Schreibvorgänge in DB-Transaktionen. (SQLite: WAL + busy_timeout aktivieren.)

---

## 8. Migrationsplan (rückrollbar/gesichert)
1. **Backup** (`scripts/backup.sh`).
2. Additive Migration: neue Tabellen + neue Spalten (nullable/mit Default).
3. Datenmigration: Alt-Bestellungen → Status-Mapping; Kellner „Altsystem"; Produkte →
   Arbeitsbereich „Allgemein" (echte Zuordnung, protokolliert).
4. Keine Löschung bestehender Spalten; `Bestellung.status` bleibt als Gesamtstatus erhalten.

---

## 9. Teststrategie (Vitest + gezielte Integration)
Rollen/Rechte, Bestellaufnahme (inkl. Preis-/Sichtbarkeitsschutz, kein Doppel-Absenden),
Bereichsverteilung (richtiges Routing, mehrere Tickets, Bereich sieht nur eigenes),
Statusübergänge (erlaubt/verboten, Abschlussregel), Zahlung (Summe/Rückgeld/zu-wenig/kein
Doppel), Gleichzeitigkeit (Versionskonflikt), Echtzeit (Ereignis kommt an), Responsive/PWA.

## 10. Commit-Reihenfolge
Analyse/Konzept → Mockups → Migrationen → Rollen/Rechte → Arbeitsbereiche →
Produkt-Bereich-Zuordnung → Kellner-Aufnahme → Bereichstickets → Bereichsansicht →
globale Übersicht → Kellnerübersicht → Echtzeit → Zahlung → Abholung/Auslieferung →
Status-/Abschlusslogik → Audit → responsive/PWA → Tests → Migration/Doku.

## 11. Risiken (Kurzliste)
- Eingriff in `Bestellung`/Storno der bestehenden Kasse → additiv halten, `status` behalten.
- SQLite-Schreiblast bei vielen Bereichen/Geräten → WAL; ggf. später PostgreSQL.
- SSE hinter Proxy → nginx `proxy_buffering off` für `/api/ereignisse`.
- Umfang: schrittweise, jede Stufe testbar; Schnell-Kasse bleibt jederzeit funktionsfähig.
