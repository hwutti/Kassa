-- Produkt: temporär "ausverkauft" (im Bereich schnell umschaltbar, sperrt den Verkauf).
ALTER TABLE "Produkt" ADD COLUMN "ausverkauft" BOOLEAN NOT NULL DEFAULT false;
