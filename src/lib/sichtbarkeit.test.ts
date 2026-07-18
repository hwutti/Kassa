import { describe, it, expect } from "vitest";
import { sichtbarkeitWhere } from "./sichtbarkeit";

describe("sichtbarkeitWhere", () => {
  it("enthält immer die Grundbedingungen (aktiv, gültiger Preis, aktive Kategorie, nicht archiviert)", () => {
    const w = sichtbarkeitWhere({ id: "vb1", istAllgemein: false });
    expect(w.aktiv).toBe(true);
    expect(w.archiviert).toBe(false);
    expect(w.preisCent).toEqual({ gte: 0 }); // schließt NULL ("Preis fehlt") aus
    expect(w.kategorie).toEqual({ aktiv: true });
  });

  it("verlangt für einen normalen Bereich die Zuordnung zu genau diesem aktiven Bereich", () => {
    const w = sichtbarkeitWhere({ id: "vb1", istAllgemein: false });
    expect(w.verkaufsbereiche).toEqual({
      some: { verkaufsbereichId: "vb1", verkaufsbereich: { aktiv: true } },
    });
  });

  it("verzichtet für die Allgemeine Kassa auf die Bereichszuordnung", () => {
    const w = sichtbarkeitWhere({ id: "vb-allg", istAllgemein: true });
    expect(w.verkaufsbereiche).toBeUndefined();
    // Grundbedingungen bleiben bestehen:
    expect(w.aktiv).toBe(true);
    expect(w.preisCent).toEqual({ gte: 0 });
  });
});
