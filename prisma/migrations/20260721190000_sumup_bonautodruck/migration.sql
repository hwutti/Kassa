-- Kartenzahlung (SumUp-Affiliate-Key) + automatischer Bondruck.
ALTER TABLE "Einstellung" ADD COLUMN "sumupAffiliateKey" TEXT;
ALTER TABLE "Einstellung" ADD COLUMN "bonAutoDruck" BOOLEAN NOT NULL DEFAULT false;
