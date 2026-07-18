import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Server-seitiges Passwort-Hashing mit scrypt (Node-Standardbibliothek, keine
// externe Abhängigkeit). Format: "salt:hash" (beide hex). Niemals Klartext speichern.

export function hashPasswort(passwort: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passwort, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPasswort(passwort: string, gespeichert: string): boolean {
  const [salt, hash] = gespeichert.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(passwort, salt, 64);
  const orig = Buffer.from(hash, "hex");
  return orig.length === test.length && timingSafeEqual(orig, test);
}
