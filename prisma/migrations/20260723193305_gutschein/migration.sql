-- CreateTable
CREATE TABLE "Gutschein" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "anfangsCent" INTEGER NOT NULL,
    "restCent" INTEGER NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "notiz" TEXT,
    "erstelltVon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Gutschein_code_key" ON "Gutschein"("code");

-- CreateIndex
CREATE INDEX "Gutschein_code_idx" ON "Gutschein"("code");
