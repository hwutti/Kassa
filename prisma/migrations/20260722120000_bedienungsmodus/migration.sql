-- Bedienungs-Ablauf fürs ganze Fest (Szenario 1 / Szenario 2).
ALTER TABLE "Einstellung" ADD COLUMN "bedienungsmodus" TEXT NOT NULL DEFAULT 'SZENARIO_1';
