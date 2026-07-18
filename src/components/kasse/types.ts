import type { ProduktDTO } from "@/lib/dto";

/** Eine Position im Warenkorb – mit Preis-Snapshot zum Zeitpunkt des Hinzufügens. */
export type WarenkorbPosition = {
  produktId: string;
  name: string;
  einzelpreisCent: number; // Snapshot: laufende Bestellung behält diesen Preis
  menge: number;
  // Verkaufsbereich, unter dem das Produkt hinzugefügt wurde (positionsgenaue Abrechnung).
  verkaufsbereichId: string;
};

export type Warenkorb = Record<string, WarenkorbPosition>;

export function ausProdukt(p: ProduktDTO, verkaufsbereichId: string): WarenkorbPosition {
  return { produktId: p.id, name: p.name, einzelpreisCent: p.preisCent, menge: 1, verkaufsbereichId };
}

export function summeCent(korb: Warenkorb): number {
  return Object.values(korb).reduce((s, p) => s + p.einzelpreisCent * p.menge, 0);
}

export function anzahlArtikel(korb: Warenkorb): number {
  return Object.values(korb).reduce((s, p) => s + p.menge, 0);
}
