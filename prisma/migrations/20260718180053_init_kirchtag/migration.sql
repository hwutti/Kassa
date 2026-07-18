-- CreateTable
CREATE TABLE "Verkaufsbereich" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "icon" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "istAllgemein" BOOLEAN NOT NULL DEFAULT false,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Kategorie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "icon" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "farbe" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Produkt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "preisCent" INTEGER,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "archiviert" BOOLEAN NOT NULL DEFAULT false,
    "sortierung" INTEGER NOT NULL DEFAULT 0,
    "bildUrl" TEXT,
    "icon" TEXT,
    "preisGeaendertAm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "kategorieId" TEXT NOT NULL,
    CONSTRAINT "Produkt_kategorieId_fkey" FOREIGN KEY ("kategorieId") REFERENCES "Kategorie" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProduktVerkaufsbereich" (
    "produktId" TEXT NOT NULL,
    "verkaufsbereichId" TEXT NOT NULL,

    PRIMARY KEY ("produktId", "verkaufsbereichId"),
    CONSTRAINT "ProduktVerkaufsbereich_produktId_fkey" FOREIGN KEY ("produktId") REFERENCES "Produkt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProduktVerkaufsbereich_verkaufsbereichId_fkey" FOREIGN KEY ("verkaufsbereichId") REFERENCES "Verkaufsbereich" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bestellung" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nummer" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABGESCHLOSSEN',
    "summeCent" INTEGER NOT NULL,
    "erhaltenCent" INTEGER,
    "rueckgeldCent" INTEGER,
    "zahlungsart" TEXT NOT NULL DEFAULT 'BAR',
    "clientRef" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abgeschlossenAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storniertAm" DATETIME,
    "stornoGrund" TEXT,
    "storniertVon" TEXT,
    "verkaufsbereichId" TEXT NOT NULL,
    CONSTRAINT "Bestellung_verkaufsbereichId_fkey" FOREIGN KEY ("verkaufsbereichId") REFERENCES "Verkaufsbereich" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BestellPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bestellungId" TEXT NOT NULL,
    "produktId" TEXT NOT NULL,
    "produktName" TEXT NOT NULL,
    "kategorieName" TEXT NOT NULL DEFAULT '',
    "einzelpreisCent" INTEGER NOT NULL,
    "menge" INTEGER NOT NULL,
    "summeCent" INTEGER NOT NULL,
    CONSTRAINT "BestellPosition_bestellungId_fkey" FOREIGN KEY ("bestellungId") REFERENCES "Bestellung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BestellPosition_produktId_fkey" FOREIGN KEY ("produktId") REFERENCES "Produkt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Benutzer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "benutzername" TEXT NOT NULL,
    "passwortHash" TEXT NOT NULL,
    "rolle" TEXT NOT NULL DEFAULT 'ADMIN',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "letzterLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Preishistorie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produktId" TEXT NOT NULL,
    "alterPreisCent" INTEGER,
    "neuerPreisCent" INTEGER,
    "geaendertVon" TEXT,
    "geaendertAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Preishistorie_produktId_fkey" FOREIGN KEY ("produktId") REFERENCES "Produkt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Zaehler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wert" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "Produkt_kategorieId_idx" ON "Produkt"("kategorieId");

-- CreateIndex
CREATE INDEX "ProduktVerkaufsbereich_verkaufsbereichId_idx" ON "ProduktVerkaufsbereich"("verkaufsbereichId");

-- CreateIndex
CREATE UNIQUE INDEX "Bestellung_nummer_key" ON "Bestellung"("nummer");

-- CreateIndex
CREATE UNIQUE INDEX "Bestellung_clientRef_key" ON "Bestellung"("clientRef");

-- CreateIndex
CREATE INDEX "Bestellung_createdAt_idx" ON "Bestellung"("createdAt");

-- CreateIndex
CREATE INDEX "Bestellung_status_idx" ON "Bestellung"("status");

-- CreateIndex
CREATE INDEX "BestellPosition_bestellungId_idx" ON "BestellPosition"("bestellungId");

-- CreateIndex
CREATE UNIQUE INDEX "Benutzer_benutzername_key" ON "Benutzer"("benutzername");

-- CreateIndex
CREATE INDEX "Preishistorie_produktId_idx" ON "Preishistorie"("produktId");
