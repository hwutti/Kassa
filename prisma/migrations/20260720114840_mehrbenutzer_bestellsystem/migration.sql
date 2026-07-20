-- CreateTable
CREATE TABLE "Arbeitsbereich" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "icon" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProduktArbeitsbereich" (
    "produktId" TEXT NOT NULL,
    "arbeitsbereichId" TEXT NOT NULL,
    "primaer" BOOLEAN NOT NULL DEFAULT true,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "sortierung" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("produktId", "arbeitsbereichId"),
    CONSTRAINT "ProduktArbeitsbereich_produktId_fkey" FOREIGN KEY ("produktId") REFERENCES "Produkt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProduktArbeitsbereich_arbeitsbereichId_fkey" FOREIGN KEY ("arbeitsbereichId") REFERENCES "Arbeitsbereich" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BenutzerArbeitsbereich" (
    "benutzerId" TEXT NOT NULL,
    "arbeitsbereichId" TEXT NOT NULL,

    PRIMARY KEY ("benutzerId", "arbeitsbereichId"),
    CONSTRAINT "BenutzerArbeitsbereich_benutzerId_fkey" FOREIGN KEY ("benutzerId") REFERENCES "Benutzer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BenutzerArbeitsbereich_arbeitsbereichId_fkey" FOREIGN KEY ("arbeitsbereichId") REFERENCES "Arbeitsbereich" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bereichsticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bestellungId" TEXT NOT NULL,
    "arbeitsbereichId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "bearbeiterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "angenommenAm" DATETIME,
    "fertigAm" DATETIME,
    "abgeholtAm" DATETIME,
    CONSTRAINT "Bereichsticket_bestellungId_fkey" FOREIGN KEY ("bestellungId") REFERENCES "Bestellung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bereichsticket_arbeitsbereichId_fkey" FOREIGN KEY ("arbeitsbereichId") REFERENCES "Arbeitsbereich" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Zahlung" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bestellungId" TEXT NOT NULL,
    "art" TEXT NOT NULL DEFAULT 'BAR',
    "betragCent" INTEGER NOT NULL,
    "gegebenCent" INTEGER,
    "rueckgeldCent" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "benutzerId" TEXT,
    "zeitpunkt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Zahlung_bestellungId_fkey" FOREIGN KEY ("bestellungId") REFERENCES "Bestellung" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEreignis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bestellungId" TEXT,
    "positionId" TEXT,
    "ticketId" TEXT,
    "benutzerId" TEXT,
    "benutzerName" TEXT,
    "typ" TEXT NOT NULL,
    "alterWert" TEXT,
    "neuerWert" TEXT,
    "grund" TEXT,
    "zeitpunkt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Benutzer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benutzername" TEXT NOT NULL,
    "anzeigename" TEXT,
    "passwortHash" TEXT NOT NULL,
    "rolle" TEXT NOT NULL DEFAULT 'ADMIN',
    "darfZahlen" BOOLEAN NOT NULL DEFAULT false,
    "darfStornieren" BOOLEAN NOT NULL DEFAULT false,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "letzterLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Benutzer" ("aktiv", "benutzername", "createdAt", "id", "letzterLogin", "passwortHash", "rolle", "updatedAt") SELECT "aktiv", "benutzername", "createdAt", "id", "letzterLogin", "passwortHash", "rolle", "updatedAt" FROM "Benutzer";
DROP TABLE "Benutzer";
ALTER TABLE "new_Benutzer" RENAME TO "Benutzer";
CREATE UNIQUE INDEX "Benutzer_benutzername_key" ON "Benutzer"("benutzername");
CREATE TABLE "new_BestellPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bestellungId" TEXT NOT NULL,
    "produktId" TEXT NOT NULL,
    "produktName" TEXT NOT NULL,
    "kategorieName" TEXT NOT NULL DEFAULT '',
    "verkaufsbereichName" TEXT NOT NULL DEFAULT '',
    "arbeitsbereich" TEXT NOT NULL DEFAULT '',
    "arbeitsbereichId" TEXT,
    "notiz" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "einzelpreisCent" INTEGER NOT NULL,
    "menge" INTEGER NOT NULL,
    "summeCent" INTEGER NOT NULL,
    CONSTRAINT "BestellPosition_bestellungId_fkey" FOREIGN KEY ("bestellungId") REFERENCES "Bestellung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BestellPosition_produktId_fkey" FOREIGN KEY ("produktId") REFERENCES "Produkt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BestellPosition" ("bestellungId", "einzelpreisCent", "id", "kategorieName", "menge", "produktId", "produktName", "summeCent", "verkaufsbereichName") SELECT "bestellungId", "einzelpreisCent", "id", "kategorieName", "menge", "produktId", "produktName", "summeCent", "verkaufsbereichName" FROM "BestellPosition";
DROP TABLE "BestellPosition";
ALTER TABLE "new_BestellPosition" RENAME TO "BestellPosition";
CREATE INDEX "BestellPosition_bestellungId_idx" ON "BestellPosition"("bestellungId");
CREATE INDEX "BestellPosition_arbeitsbereichId_idx" ON "BestellPosition"("arbeitsbereichId");
CREATE TABLE "new_Bestellung" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nummer" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABGESCHLOSSEN',
    "bestellStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
    "zahlungStatus" TEXT NOT NULL DEFAULT 'PAID',
    "auslieferungStatus" TEXT NOT NULL DEFAULT 'DELIVERED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "summeCent" INTEGER NOT NULL,
    "erhaltenCent" INTEGER,
    "rueckgeldCent" INTEGER,
    "zahlungsart" TEXT NOT NULL DEFAULT 'BAR',
    "kellnerId" TEXT,
    "tisch" TEXT,
    "gast" TEXT,
    "abholnummer" TEXT,
    "notiz" TEXT,
    "clientRef" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abgesendetAm" DATETIME,
    "abgeschlossenAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storniertAm" DATETIME,
    "stornoGrund" TEXT,
    "storniertVon" TEXT,
    "verkaufsbereichId" TEXT NOT NULL,
    "veranstaltungId" TEXT,
    CONSTRAINT "Bestellung_verkaufsbereichId_fkey" FOREIGN KEY ("verkaufsbereichId") REFERENCES "Verkaufsbereich" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bestellung_kellnerId_fkey" FOREIGN KEY ("kellnerId") REFERENCES "Benutzer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bestellung_veranstaltungId_fkey" FOREIGN KEY ("veranstaltungId") REFERENCES "Veranstaltung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bestellung" ("abgeschlossenAm", "clientRef", "createdAt", "erhaltenCent", "id", "nummer", "rueckgeldCent", "status", "storniertAm", "storniertVon", "stornoGrund", "summeCent", "veranstaltungId", "verkaufsbereichId", "zahlungsart") SELECT "abgeschlossenAm", "clientRef", "createdAt", "erhaltenCent", "id", "nummer", "rueckgeldCent", "status", "storniertAm", "storniertVon", "stornoGrund", "summeCent", "veranstaltungId", "verkaufsbereichId", "zahlungsart" FROM "Bestellung";
DROP TABLE "Bestellung";
ALTER TABLE "new_Bestellung" RENAME TO "Bestellung";
CREATE UNIQUE INDEX "Bestellung_nummer_key" ON "Bestellung"("nummer");
CREATE UNIQUE INDEX "Bestellung_clientRef_key" ON "Bestellung"("clientRef");
CREATE INDEX "Bestellung_createdAt_idx" ON "Bestellung"("createdAt");
CREATE INDEX "Bestellung_status_idx" ON "Bestellung"("status");
CREATE INDEX "Bestellung_bestellStatus_idx" ON "Bestellung"("bestellStatus");
CREATE INDEX "Bestellung_veranstaltungId_idx" ON "Bestellung"("veranstaltungId");
CREATE INDEX "Bestellung_kellnerId_idx" ON "Bestellung"("kellnerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProduktArbeitsbereich_arbeitsbereichId_idx" ON "ProduktArbeitsbereich"("arbeitsbereichId");

-- CreateIndex
CREATE INDEX "BenutzerArbeitsbereich_arbeitsbereichId_idx" ON "BenutzerArbeitsbereich"("arbeitsbereichId");

-- CreateIndex
CREATE INDEX "Bereichsticket_bestellungId_idx" ON "Bereichsticket"("bestellungId");

-- CreateIndex
CREATE INDEX "Bereichsticket_arbeitsbereichId_idx" ON "Bereichsticket"("arbeitsbereichId");

-- CreateIndex
CREATE INDEX "Bereichsticket_status_idx" ON "Bereichsticket"("status");

-- CreateIndex
CREATE INDEX "Zahlung_bestellungId_idx" ON "Zahlung"("bestellungId");

-- CreateIndex
CREATE INDEX "AuditEreignis_bestellungId_idx" ON "AuditEreignis"("bestellungId");

-- CreateIndex
CREATE INDEX "AuditEreignis_zeitpunkt_idx" ON "AuditEreignis"("zeitpunkt");
