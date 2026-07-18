-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BestellPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bestellungId" TEXT NOT NULL,
    "produktId" TEXT NOT NULL,
    "produktName" TEXT NOT NULL,
    "kategorieName" TEXT NOT NULL DEFAULT '',
    "verkaufsbereichName" TEXT NOT NULL DEFAULT '',
    "einzelpreisCent" INTEGER NOT NULL,
    "menge" INTEGER NOT NULL,
    "summeCent" INTEGER NOT NULL,
    CONSTRAINT "BestellPosition_bestellungId_fkey" FOREIGN KEY ("bestellungId") REFERENCES "Bestellung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BestellPosition_produktId_fkey" FOREIGN KEY ("produktId") REFERENCES "Produkt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BestellPosition" ("bestellungId", "einzelpreisCent", "id", "kategorieName", "menge", "produktId", "produktName", "summeCent") SELECT "bestellungId", "einzelpreisCent", "id", "kategorieName", "menge", "produktId", "produktName", "summeCent" FROM "BestellPosition";
DROP TABLE "BestellPosition";
ALTER TABLE "new_BestellPosition" RENAME TO "BestellPosition";
CREATE INDEX "BestellPosition_bestellungId_idx" ON "BestellPosition"("bestellungId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
