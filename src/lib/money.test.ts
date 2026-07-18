import { describe, it, expect } from "vitest";
import { formatCent, parseEuroToCent, istPreisGueltig } from "./money";

describe("parseEuroToCent", () => {
  it("parst Komma-Beträge", () => {
    expect(parseEuroToCent("2,50")).toBe(250);
    expect(parseEuroToCent("12")).toBe(1200);
    expect(parseEuroToCent("0,05")).toBe(5);
  });
  it("akzeptiert Punkt als Dezimaltrenner", () => {
    expect(parseEuroToCent("2.5")).toBe(250);
  });
  it("entfernt Tausenderpunkte", () => {
    expect(parseEuroToCent("1.234,56")).toBe(123456);
  });
  it("liefert null bei leer/ungültig/negativ", () => {
    expect(parseEuroToCent("")).toBeNull();
    expect(parseEuroToCent("abc")).toBeNull();
    expect(parseEuroToCent("-5")).toBeNull();
  });
});

describe("istPreisGueltig", () => {
  it("0 Cent ist gültig (Gratis-Artikel)", () => {
    expect(istPreisGueltig(0)).toBe(true);
  });
  it("positive Cent-Beträge sind gültig", () => {
    expect(istPreisGueltig(250)).toBe(true);
  });
  it("NULL/undefined/negativ ist ungültig (Preis fehlt)", () => {
    expect(istPreisGueltig(null)).toBe(false);
    expect(istPreisGueltig(undefined)).toBe(false);
    expect(istPreisGueltig(-1)).toBe(false);
  });
});

describe("formatCent", () => {
  it("formatiert als EUR", () => {
    // NBSP zwischen Zahl und Währung; robust über Regex prüfen.
    expect(formatCent(1250)).toMatch(/12,50/);
    expect(formatCent(0)).toMatch(/0,00/);
  });
  it("zeigt Platzhalter bei fehlendem Wert", () => {
    expect(formatCent(null)).toBe("—");
  });
});
