-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Einstellung" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'app',
    "titel" TEXT NOT NULL DEFAULT 'Kirchtagsfest Kasse',
    "untertitel" TEXT,
    "logoUrl" TEXT,
    "logoHoehe" INTEGER NOT NULL DEFAULT 48,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Einstellung" ("id", "logoUrl", "titel", "untertitel", "updatedAt") SELECT "id", "logoUrl", "titel", "untertitel", "updatedAt" FROM "Einstellung";
DROP TABLE "Einstellung";
ALTER TABLE "new_Einstellung" RENAME TO "Einstellung";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
