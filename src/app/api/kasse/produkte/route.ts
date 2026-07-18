import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { sichtbarkeitWhere } from "@/lib/sichtbarkeit";
import type { KassenDatenDTO, ProduktDTO, KategorieDTO } from "@/lib/dto";

// Preis-/Produktdaten dürfen nie zwischengespeichert ausgeliefert werden.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/kasse/produkte?verkaufsbereich=ID
 * Liefert ausschließlich sichtbare Produkte (alle 5 Bedingungen erfüllt),
 * plus die dazugehörigen aktiven Kategorien für die ausgewählte Ansicht.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const verkaufsbereichId = url.searchParams.get("verkaufsbereich");
    if (!verkaufsbereichId) {
      return fehler("Parameter 'verkaufsbereich' fehlt", 400);
    }

    // Der Bereich selbst muss existieren und aktiv sein.
    const bereich = await prisma.verkaufsbereich.findFirst({
      where: { id: verkaufsbereichId, aktiv: true },
      select: { id: true, name: true },
    });
    if (!bereich) {
      return fehler("Verkaufsbereich nicht verfügbar", 404);
    }

    const produkteRaw = await prisma.produkt.findMany({
      where: sichtbarkeitWhere(verkaufsbereichId),
      orderBy: [{ sortierung: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        beschreibung: true,
        preisCent: true,
        kategorieId: true,
        kategorie: { select: { id: true, name: true, farbe: true, sortierung: true } },
      },
    });

    const produkte: ProduktDTO[] = produkteRaw.map((p) => ({
      id: p.id,
      name: p.name,
      beschreibung: p.beschreibung,
      preisCent: p.preisCent as number, // durch sichtbarkeitWhere garantiert nicht NULL
      kategorieId: p.kategorieId,
    }));

    // Nur Kategorien, die tatsächlich sichtbare Produkte enthalten.
    const katMap = new Map<string, KategorieDTO & { sortierung: number }>();
    for (const p of produkteRaw) {
      if (!katMap.has(p.kategorie.id)) {
        katMap.set(p.kategorie.id, {
          id: p.kategorie.id,
          name: p.kategorie.name,
          farbe: p.kategorie.farbe,
          sortierung: p.kategorie.sortierung,
        });
      }
    }
    const kategorien: KategorieDTO[] = [...katMap.values()]
      .sort((a, b) => a.sortierung - b.sortierung || a.name.localeCompare(b.name))
      .map(({ id, name, farbe }) => ({ id, name, farbe }));

    const dto: KassenDatenDTO = {
      verkaufsbereich: bereich,
      kategorien,
      produkte,
      stand: new Date().toISOString(),
    };

    return ok(dto, { headers: { "Cache-Control": "no-store, must-revalidate" } });
  } catch (e) {
    return handleError(e);
  }
}
