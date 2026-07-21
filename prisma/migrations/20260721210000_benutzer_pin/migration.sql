-- Optionaler PIN-Login (scrypt-Hash) für schnelles Anmelden am Tablet.
ALTER TABLE "Benutzer" ADD COLUMN "pinHash" TEXT;
