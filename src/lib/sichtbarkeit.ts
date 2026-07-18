import type { Prisma } from "@prisma/client";

/**
 * EINZIGE WAHRHEIT für die Sichtbarkeit eines Produkts in der Kassenansicht.
 *
 * Ein Produkt darf in der Kasse NUR angezeigt / gesucht / bestellt werden, wenn:
 *   1. das Produkt aktiv ist,
 *   2. die zugehörige Kategorie aktiv ist,
 *   3. der ausgewählte Verkaufsbereich aktiv ist,
 *   4. das Produkt diesem Verkaufsbereich zugeordnet ist,
 *   5. ein gültiger Verkaufspreis (preisCent >= 0, nicht NULL) hinterlegt ist.
 *
 * Diese Bedingung wird sowohl für die Liste als auch für Suche, Direktaufruf
 * (per ID) und die Bestell-Validierung verwendet – nie darf ein Weg daran vorbei.
 */
export function sichtbarkeitWhere(verkaufsbereichId: string): Prisma.ProduktWhereInput {
  return {
    aktiv: true, // (1)
    // (5) gültiger Preis: gte 0 schließt automatisch NULL aus (NULL matcht keinen Vergleich).
    preisCent: { gte: 0 },
    kategorie: { aktiv: true }, // (2)
    verkaufsbereiche: {
      some: {
        verkaufsbereichId, // (4)
        verkaufsbereich: { aktiv: true }, // (3)
      },
    },
  };
}
