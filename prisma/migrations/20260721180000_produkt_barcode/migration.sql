-- Barcode/EAN für Scanner-Erfassung (optional, eindeutig).
ALTER TABLE "Produkt" ADD COLUMN "barcode" TEXT;
CREATE UNIQUE INDEX "Produkt_barcode_key" ON "Produkt"("barcode");
