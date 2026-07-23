-- RawBT-Direktdruck (Android) konfigurierbar machen.
ALTER TABLE "Einstellung" ADD COLUMN "rawbtAktiv" BOOLEAN NOT NULL DEFAULT false;
