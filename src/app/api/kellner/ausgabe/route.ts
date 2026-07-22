import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { requireRolle } from "@/lib/auth";
import { darfKellner } from "@/lib/rollen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/kellner/ausgabe – ALLE abholbereiten, noch nicht ausgegebenen Bestellungen
 * (unabhängig davon, wer sie aufgenommen hat). So kann jeder Kellner als „Läufer"
 * ausgeben (Szenario 2). Bereits ausgelieferte/stornierte sind nicht dabei.
 */
export async function GET() {
  try {
    const session = await requireRolle(darfKellner);
    if (session instanceof Response) return session;

    const offen = await prisma.bestellung.findMany({
      where: { status: { not: "STORNIERT" }, auslieferungStatus: "READY_FOR_PICKUP" },
      orderBy: { createdAt: "asc" },
      include: {
        kellner: { select: { anzeigename: true, benutzername: true } },
        positionen: { select: { produktName: true, menge: true, status: true } },
        tickets: { include: { arbeitsbereich: { select: { name: true } } } },
      },
    });

    return ok(
      {
        bestellungen: offen.map((b) => ({
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
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
