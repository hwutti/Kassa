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
 * Ausnahme (Spec §4): Eine "Allgemeine Kassa" (istAllgemein) zeigt ALLE gültigen,
 * aktiven Produkte – Bedingung 4 (Zuordnung) entfällt dann.
 *
 * Wird für Liste, Suche, Direktaufruf (per ID) und die Bestell-Validierung
 * verwendet – nie darf ein Weg daran vorbei.
 */
export function sichtbarkeitWhere(bereich: {
  id: string;
  istAllgemein: boolean;
}): Prisma.ProduktWhereInput {
  const basis: Prisma.ProduktWhereInput = {
    aktiv: true, // (1)
    archiviert: false,
    ausverkauft: false, // (6) ausverkaufte Produkte sind nicht bestellbar
    preisCent: { gte: 0 }, // (5) gte 0 schließt NULL automatisch aus
    kategorie: { aktiv: true }, // (2)
  };

  if (bereich.istAllgemein) {
    return basis;
  }

  return {
    ...basis,
    verkaufsbereiche: {
      some: {
        verkaufsbereichId: bereich.id, // (4)
        verkaufsbereich: { aktiv: true }, // (3)
      },
    },
  };
}

/**
 * Prüfung beim BESTELLABSCHLUSS: Ein Produkt darf verkauft werden, wenn es aktiv
 * ist, eine aktive Kategorie hat und einen gültigen Preis besitzt.
 *
 * Bewusst OHNE Bindung an einen bestimmten Verkaufsbereich: Ein Warenkorb darf
 * Produkte aus mehreren Bereichen enthalten (die Bedienperson kann den Bereich
 * während der Bestellung wechseln). Die harten Verbote (kein Preis, deaktiviert,
 * inaktive Kategorie) bleiben serverseitig verbindlich.
 */
export function verkaufbarWhere(): Prisma.ProduktWhereInput {
  return {
    aktiv: true,
    archiviert: false,
    ausverkauft: false, // ausverkauft = nicht verkäuflich (serverseitig verbindlich)
    preisCent: { gte: 0 },
    kategorie: { aktiv: true },
  };
}

/**
 * Wie verkaufbarWhere, aber OHNE die Ausverkauft-Sperre: für die ANZEIGE im
 * Verkauf, damit ausverkaufte Produkte ausgegraut sichtbar bleiben (nicht
 * bestellbar – das Bestellen wird über verkaufbarWhere weiterhin abgelehnt).
 */
export function anzeigeWhere(): Prisma.ProduktWhereInput {
  return {
    aktiv: true,
    archiviert: false,
    preisCent: { gte: 0 },
    kategorie: { aktiv: true },
  };
}
