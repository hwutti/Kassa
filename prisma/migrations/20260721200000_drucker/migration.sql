-- Drucker-Verwaltung (frei konfigurierbar, optional einem Arbeitsbereich zugeordnet).
CREATE TABLE "Drucker" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "typ" TEXT NOT NULL DEFAULT 'SYSTEM',
  "ip" TEXT,
  "aktiv" BOOLEAN NOT NULL DEFAULT true,
  "sortierung" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "arbeitsbereichId" TEXT,
  CONSTRAINT "Drucker_arbeitsbereichId_fkey" FOREIGN KEY ("arbeitsbereichId") REFERENCES "Arbeitsbereich" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Drucker_arbeitsbereichId_idx" ON "Drucker"("arbeitsbereichId");
