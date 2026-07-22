-- Verschlüsselte PIN (AES-GCM) für die Zugangsliste. Login läuft weiter über pinHash.
ALTER TABLE "Benutzer" ADD COLUMN "pinEnc" TEXT;
