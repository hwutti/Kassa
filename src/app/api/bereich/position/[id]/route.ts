import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { requireRolle } from "@/lib/auth";
import { darfBereich } from "@/lib/rollen";
import { ereignisSenden } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";

const Schema = z.object({ fertig: z.boolean() });

/**
 * POST /api/bereich/position/[id] – einzelne Bestellposition als „fertig
 * vorbereitet" markieren (oder zurücksetzen). Nur für die Bereichs-Tafel, damit
 * bei großen Bestellungen sichtbar ist, was schon fertig ist und was noch fehlt.
 * Ändert NICHT den Ticket-/Bestellstatus – erst „Fertig" schließt das Ticket ab.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRolle(darfBereich);
    if (session instanceof Response) return session;
    const { id } = await params;
    const { fertig } = Schema.parse(await req.json());

    const pos = await prisma.bestellPosition.findUnique({ where: { id }, select: { status: true, arbeitsbereichId: true } });
    if (!pos) return fehler("Position nicht gefunden.", 404);
    if (pos.status === "CANCELLED") return fehler("Position ist storniert.", 409);

    // BEREICH darf nur Positionen der eigenen Arbeitsbereiche abhaken.
    if (session.rolle === "BEREICH") {
      if (!pos.arbeitsbereichId) return fehler("Position gehört zu keinem Arbeitsbereich.", 409);
      const zugewiesen = await prisma.benutzerArbeitsbereich.findFirst({
        where: { benutzerId: session.sub, arbeitsbereichId: pos.arbeitsbereichId },
        select: { arbeitsbereichId: true },
      });
      if (!zugewiesen) return fehler("Nicht für diesen Arbeitsbereich zuständig.", 403);
    }

    await prisma.bestellPosition.update({
      where: { id },
      data: { status: fertig ? "READY" : "QUEUED" },
    });
    ereignisSenden("ticket");
    return ok({ status: fertig ? "READY" : "QUEUED" });
  } catch (e) {
    return handleError(e);
  }
}
