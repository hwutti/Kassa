import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { requireRolle } from "@/lib/auth";
import { darfBereich } from "@/lib/rollen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/bereich/tickets – offene Tickets der zugewiesenen Arbeitsbereiche. */
export async function GET() {
  try {
    const session = await requireRolle(darfBereich);
    if (session instanceof Response) return session;

    // Zuständige Bereiche: Admin/Supervisor sehen alle, sonst die zugewiesenen.
    let areaIds: string[] | undefined;
    if (session.rolle === "BEREICH") {
      const zuweisungen = await prisma.benutzerArbeitsbereich.findMany({
        where: { benutzerId: session.sub },
        select: { arbeitsbereichId: true },
      });
      areaIds = zuweisungen.map((z) => z.arbeitsbereichId);
      if (areaIds.length === 0) return ok({ bereiche: [], tickets: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const tickets = await prisma.bereichsticket.findMany({
      where: {
        arbeitsbereichId: areaIds ? { in: areaIds } : undefined,
        status: { in: ["QUEUED", "ACCEPTED", "IN_PREPARATION", "READY"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        arbeitsbereich: { select: { id: true, name: true } },
        bestellung: {
          select: {
            nummer: true,
            tisch: true,
            gast: true,
            abholnummer: true,
            notiz: true,
            createdAt: true,
            kellner: { select: { anzeigename: true, benutzername: true } },
            positionen: {
              select: { produktName: true, menge: true, notiz: true, arbeitsbereichId: true, status: true },
            },
          },
        },
      },
    });

    const ergebnis = tickets.map((t) => ({
      id: t.id,
      status: t.status,
      version: t.version,
      createdAt: t.createdAt.toISOString(),
      arbeitsbereich: t.arbeitsbereich.name,
      nummer: t.bestellung.nummer,
      tisch: t.bestellung.tisch,
      gast: t.bestellung.gast,
      abholnummer: t.bestellung.abholnummer,
      notiz: t.bestellung.notiz,
      kellner: t.bestellung.kellner?.anzeigename ?? t.bestellung.kellner?.benutzername ?? "—",
      bestellzeit: t.bestellung.createdAt.toISOString(),
      positionen: t.bestellung.positionen
        .filter((p) => p.arbeitsbereichId === t.arbeitsbereichId)
        .map((p) => ({ produktName: p.produktName, menge: p.menge, notiz: p.notiz })),
    }));

    const bereiche = [...new Map(tickets.map((t) => [t.arbeitsbereich.id, t.arbeitsbereich.name])).entries()].map(
      ([id, name]) => ({ id, name }),
    );

    return ok({ bereiche, tickets: ergebnis }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
