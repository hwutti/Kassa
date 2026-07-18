import { describe, it, expect } from "vitest";
import { hashPasswort, verifyPasswort } from "./passwort";

describe("Passwort-Hashing", () => {
  it("verifiziert das korrekte Passwort", () => {
    const hash = hashPasswort("geheim123");
    expect(hash).toContain(":"); // Format salt:hash
    expect(verifyPasswort("geheim123", hash)).toBe(true);
  });

  it("lehnt ein falsches Passwort ab", () => {
    const hash = hashPasswort("geheim123");
    expect(verifyPasswort("falsch", hash)).toBe(false);
  });

  it("erzeugt für dasselbe Passwort unterschiedliche Hashes (zufälliges Salt)", () => {
    expect(hashPasswort("gleich")).not.toBe(hashPasswort("gleich"));
  });

  it("lehnt ungültig formatierte Hashes ab", () => {
    expect(verifyPasswort("x", "kaputt")).toBe(false);
    expect(verifyPasswort("x", "")).toBe(false);
  });
});
