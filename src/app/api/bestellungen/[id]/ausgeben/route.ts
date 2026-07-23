import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { requireRolle } from "@/lib/auth";
import { darfKellner } from "@/lib/rollen";
import { bestellungNeuBerechnen, auditLog } from "@/lib/bestelllogik";
import { ereignisSenden } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";

/**
 * POST /api/bestellungen/[id]/ausgeben
 * Ein Schritt: der Kellner gibt die Bestellung aus (holen + servieren zusammengefasst).
 * Markiert offene Tickets/Positionen als erledigt und setzt Auslieferung auf DELIVERED.
 * Abschluss (COMPLETED) erst zusammen mit erfolgter Zahlung.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRolle(darfKellner);
    if (session instanceof Response) return session;
    const { id } = await params;

    const b = await prisma.bestellung.findUnique({ where: { id }, select: { status: true, auslieferungStatus: true } });
    if (!b) return fehler("Bestellung nicht gefunden.", 404);
    if (b.status === "STORNIERT") return fehler("Bestellung ist storniert.", 409);
    if (b.auslieferungStatus === "DELIVERED") return fehler("Bestellung ist bereits ausgegeben.", 409);

    try {
      await prisma.$transaction(async (tx) => {
        // Optimistische Sperre gegen doppelte/parallele Ausgabe.
        const upd = await tx.bestellung.updateMany({
          where: { id, status: { not: "STORNIERT" }, auslieferungStatus: { not: "DELIVERED" } },
          data: { auslieferungStatus: "DELIVERED", version: { increment: 1 } },
        });
        if (upd.count === 0) throw new Error("KONFLIKT");
        await tx.bereichsticket.updateMany({
          where: { bestellungId: id, status: { notIn: ["COLLECTED", "CANCELLED"] } },
          data: { status: "COLLECTED", fertigAm: new Date(), abgeholtAm: new Date() },
        });
        await tx.bestellPosition.updateMany({
          where: { bestellungId: id, status: { not: "CANCELLED" } },
          data: { status: "DELIVERED" },
        });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "KONFLIKT")
        return fehler("Bestellung wurde zwischenzeitlich geändert (bereits ausgegeben oder storniert).", 409);
      throw e;
    }

    const neu = await bestellungNeuBerechnen(id);
    await auditLog({ bestellungId: id, benutzerId: session.sub, benutzerName: session.name, typ: "AUSGEGEBEN", neuerWert: neu?.bestellStatus });
    ereignisSenden("ausgeben");
    return ok({ auslieferungStatus: "DELIVERED", bestellStatus: neu?.bestellStatus });
  } catch (e) {
    return handleError(e);
  }
}
