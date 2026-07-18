import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { sichtbarkeitWhere } from "@/lib/sichtbarkeit";
import type { ProduktDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/kasse/produkt/[id]?verkaufsbereich=ID
 * Einzelabruf eines Produkts – NUR wenn es im gewählten Bereich sichtbar ist.
 * Damit lässt sich ein preisloses/inaktives Produkt auch nicht per Direkt-URL laden.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const verkaufsbereichId = url.searchParams.get("verkaufsbereich");
    if (!verkaufsbereichId) {
      return fehler("Parameter 'verkaufsbereich' fehlt", 400);
    }

    const produkt = await prisma.produkt.findFirst({
      // Sichtbarkeitsregel UND ID – ein nicht sichtbares Produkt existiert hier schlicht nicht.
      where: { AND: [{ id }, sichtbarkeitWhere(verkaufsbereichId)] },
      select: { id: true, name: true, beschreibung: true, preisCent: true, kategorieId: true },
    });

    if (!produkt) {
      // Bewusst 404 – kein Hinweis, dass es das Produkt "eigentlich" gibt.
      return fehler("Produkt nicht verfügbar", 404);
    }

    const dto: ProduktDTO = {
      id: produkt.id,
      name: produkt.name,
      beschreibung: produkt.beschreibung,
      preisCent: produkt.preisCent as number,
      kategorieId: produkt.kategorieId,
    };
    return ok(dto, { headers: { "Cache-Control": "no-store, must-revalidate" } });
  } catch (e) {
    return handleError(e);
  }
}
