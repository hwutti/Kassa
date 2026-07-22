import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Symmetrische Verschlüsselung der PIN (AES-256-GCM) mit einem aus AUTH_SECRET
// abgeleiteten Schlüssel. So ist die PIN für den Admin wieder anzeigbar/druckbar,
// aber ein reiner Datenbank-Zugriff (ohne AUTH_SECRET) gibt sie nicht preis.
// Format: iv:authTag:ciphertext (alle hex).

function schluessel(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET fehlt oder ist zu kurz.");
  return scryptSync(s, "pin-enc-v1", 32);
}

export function pinVerschluesseln(pin: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", schluessel(), iv);
  const enc = Buffer.concat([c.update(pin, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function pinEntschluesseln(gespeichert: string | null | undefined): string | null {
  if (!gespeichert) return null;
  try {
    const [ivH, tagH, dataH] = gespeichert.split(":");
    if (!ivH || !tagH || !dataH) return null;
    const d = createDecipheriv("aes-256-gcm", schluessel(), Buffer.from(ivH, "hex"));
    d.setAuthTag(Buffer.from(tagH, "hex"));
    return Buffer.concat([d.update(Buffer.from(dataH, "hex")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
