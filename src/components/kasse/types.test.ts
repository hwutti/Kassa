import { describe, it, expect } from "vitest";
import { summeCent, anzahlArtikel, ausProdukt, type Warenkorb } from "./types";
import type { ProduktDTO } from "@/lib/dto";

function produkt(id: string, preisCent: number): ProduktDTO {
  return { id, name: id, beschreibung: null, preisCent, kategorieId: "k", icon: null, bildUrl: null };
}

describe("Warenkorb-Berechnung", () => {
  it("übernimmt beim Hinzufügen den Preis-Snapshot und Menge 1", () => {
    const pos = ausProdukt(produkt("bier", 350));
    expect(pos).toEqual({ produktId: "bier", name: "bier", einzelpreisCent: 350, menge: 1 });
  });

  it("berechnet Positions- und Gesamtsumme korrekt", () => {
    const korb: Warenkorb = {
      bier: { produktId: "bier", name: "Bier", einzelpreisCent: 350, menge: 2 }, // 700
      wein: { produktId: "wein", name: "Wein", einzelpreisCent: 190, menge: 3 }, // 570
    };
    expect(summeCent(korb)).toBe(1270);
    expect(anzahlArtikel(korb)).toBe(5);
  });

  it("liefert für einen leeren Warenkorb 0", () => {
    expect(summeCent({})).toBe(0);
    expect(anzahlArtikel({})).toBe(0);
  });
});
