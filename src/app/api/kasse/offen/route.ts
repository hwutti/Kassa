import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { requireRolle } from "@/lib/auth";
import { darfKassieren } from "@/lib/rollen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/kasse/offen – offene, noch nicht bezahlte Bestellungen für die zentrale Kassa.
 * Zeigt alle Verkäufer-Bestellungen, damit die Kassa sie einsammeln/abkassieren kann.
 */
export async function GET() {
  try {
    const session = await requireRolle(darfKassieren);
    if (session instanceof Response) return session;

    const offen = await prisma.bestellung.findMany({
      where: { status: { not: "STORNIERT" }, zahlungStatus: { not: "PAID" } },
      orderBy: { createdAt: "asc" },
      include: {
        kellner: { select: { anzeigename: true, benutzername: true } },
        positionen: { select: { produktName: true, menge: true, einzelpreisCent: true, summeCent: true, status: true } },
        tickets: { include: { arbeitsbereich: { select: { name: true } } } },
      },
    });

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const heuteKassiert = await prisma.zahlung.count({
      where: { status: "PAID", zeitpunkt: { gte: heute } },
    });

    const bestellungen = offen.map((b) => ({
      id: b.id,
      nummer: b.nummer,
      tisch: b.tisch,
      gast: b.gast,
      abholnummer: b.abholnummer,
      verkaeufer: b.kellner?.anzeigename ?? b.kellner?.benutzername ?? "—",
      summeCent: b.summeCent,
      bestellStatus: b.bestellStatus,
      zahlungStatus: b.zahlungStatus,
      auslieferungStatus: b.auslieferungStatus,
      createdAt: b.createdAt.toISOString(),
      positionen: b.positionen,
      bereiche: b.tickets.map((t) => ({ name: t.arbeitsbereich.name, status: t.status })),
    }));

    return ok(
      {
        heuteKassiert,
        bestellungen,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
