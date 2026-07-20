import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { requireRolle } from "@/lib/auth";
import { darfUebersicht } from "@/lib/rollen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/uebersicht – alle offenen Bestellungen mit Fortschritt (Supervisor/Admin). */
export async function GET() {
  try {
    const session = await requireRolle(darfUebersicht);
    if (session instanceof Response) return session;

    const offen = await prisma.bestellung.findMany({
      where: { bestellStatus: { notIn: ["COMPLETED", "CANCELLED"] } },
      orderBy: { createdAt: "asc" },
      include: {
        kellner: { select: { anzeigename: true, benutzername: true } },
        tickets: { include: { arbeitsbereich: { select: { name: true } } } },
      },
    });

    const bestellungen = offen.map((b) => ({
      id: b.id,
      nummer: b.nummer,
      tisch: b.tisch,
      abholnummer: b.abholnummer,
      kellner: b.kellner?.anzeigename ?? b.kellner?.benutzername ?? "—",
      summeCent: b.summeCent,
      bestellStatus: b.bestellStatus,
      zahlungStatus: b.zahlungStatus,
      auslieferungStatus: b.auslieferungStatus,
      createdAt: b.createdAt.toISOString(),
      bereiche: b.tickets.map((t) => ({ name: t.arbeitsbereich.name, status: t.status })),
    }));

    const kpi = {
      offen: bestellungen.length,
      abholbereit: bestellungen.filter((b) => b.bestellStatus === "READY_FOR_PICKUP").length,
      inArbeit: bestellungen.filter((b) => b.bestellStatus === "IN_PROGRESS" || b.bestellStatus === "SUBMITTED").length,
      zahlungOffen: bestellungen.filter((b) => b.zahlungStatus !== "PAID").length,
    };

    return ok({ kpi, bestellungen }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
