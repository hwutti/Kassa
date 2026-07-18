-- CreateTable
CREATE TABLE "Veranstaltung" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT false,
    "von" DATETIME,
    "bis" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Einstellung" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'app',
    "titel" TEXT NOT NULL DEFAULT 'Kirchtagsfest Kasse',
    "untertitel" TEXT,
    "logoUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bestellung" (
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
    "veranstaltungId" TEXT,
    CONSTRAINT "Bestellung_verkaufsbereichId_fkey" FOREIGN KEY ("verkaufsbereichId") REFERENCES "Verkaufsbereich" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bestellung_veranstaltungId_fkey" FOREIGN KEY ("veranstaltungId") REFERENCES "Veranstaltung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bestellung" ("abgeschlossenAm", "clientRef", "createdAt", "erhaltenCent", "id", "nummer", "rueckgeldCent", "status", "storniertAm", "storniertVon", "stornoGrund", "summeCent", "verkaufsbereichId", "zahlungsart") SELECT "abgeschlossenAm", "clientRef", "createdAt", "erhaltenCent", "id", "nummer", "rueckgeldCent", "status", "storniertAm", "storniertVon", "stornoGrund", "summeCent", "verkaufsbereichId", "zahlungsart" FROM "Bestellung";
DROP TABLE "Bestellung";
ALTER TABLE "new_Bestellung" RENAME TO "Bestellung";
CREATE UNIQUE INDEX "Bestellung_nummer_key" ON "Bestellung"("nummer");
CREATE UNIQUE INDEX "Bestellung_clientRef_key" ON "Bestellung"("clientRef");
CREATE INDEX "Bestellung_createdAt_idx" ON "Bestellung"("createdAt");
CREATE INDEX "Bestellung_status_idx" ON "Bestellung"("status");
CREATE INDEX "Bestellung_veranstaltungId_idx" ON "Bestellung"("veranstaltungId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Veranstaltung_aktiv_idx" ON "Veranstaltung"("aktiv");
