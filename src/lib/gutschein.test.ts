import { describe, it, expect } from "vitest";
import { gutscheinEinloesen, normalisiereCode } from "./gutschein";

describe("gutscheinEinloesen", () => {
  it("löst voll ein und lässt Rest 0", () => {
    const r = gutscheinEinloesen({ aktiv: true, restCent: 2000 }, 2000);
    expect(r).toEqual({ ok: true, neuerRest: 0 });
  });
  it("erlaubt Teil-Einlösung und behält Restguthaben", () => {
    const r = gutscheinEinloesen({ aktiv: true, restCent: 2000 }, 500);
    expect(r).toEqual({ ok: true, neuerRest: 1500 });
  });
  it("lehnt Überziehung ab", () => {
    const r = gutscheinEinloesen({ aktiv: true, restCent: 300 }, 500);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.grund).toMatch(/zu gering/);
  });
  it("lehnt deaktivierte Gutscheine ab", () => {
    const r = gutscheinEinloesen({ aktiv: false, restCent: 2000 }, 500);
    expect(r.ok).toBe(false);
  });
  it("lehnt leere Gutscheine ab", () => {
    const r = gutscheinEinloesen({ aktiv: true, restCent: 0 }, 500);
    expect(r.ok).toBe(false);
  });
  it("lehnt Nullbetrag ab", () => {
    const r = gutscheinEinloesen({ aktiv: true, restCent: 2000 }, 0);
    expect(r.ok).toBe(false);
  });
});

describe("normalisiereCode", () => {
  it("macht Großbuchstaben, entfernt Leerzeichen", () => {
    expect(normalisiereCode("  gs-abc 123 ")).toBe("GS-ABC123");
  });
});
