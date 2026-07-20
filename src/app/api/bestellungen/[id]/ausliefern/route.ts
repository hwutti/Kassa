import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { requireRolle } from "@/lib/auth";
import { darfKellner } from "@/lib/rollen";
import { bestellungNeuBerechnen, auditLog } from "@/lib/bestelllogik";
import { ereignisSenden } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";

/** POST /api/bestellungen/[id]/ausliefern – Kellner bestätigt die Auslieferung. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRolle(darfKellner);
    if (session instanceof Response) return session;
    const { id } = await params;

    const b = await prisma.bestellung.findUnique({ where: { id }, select: { auslieferungStatus: true, status: true } });
    if (!b) return fehler("Bestellung nicht gefunden.", 404);
    if (b.status === "STORNIERT") return fehler("Bestellung ist storniert.", 409);
    if (b.auslieferungStatus !== "COLLECTED" && b.auslieferungStatus !== "READY_FOR_PICKUP") {
      return fehler("Bestellung ist noch nicht abholbereit/abgeholt.", 409);
    }

    await prisma.$transaction([
      prisma.bestellung.update({ where: { id }, data: { auslieferungStatus: "DELIVERED" } }),
      prisma.bestellPosition.updateMany({ where: { bestellungId: id, status: { not: "CANCELLED" } }, data: { status: "DELIVERED" } }),
      prisma.bereichsticket.updateMany({ where: { bestellungId: id, status: { in: ["READY", "COLLECTED"] } }, data: { status: "COLLECTED" } }),
    ]);
    const neu = await bestellungNeuBerechnen(id);
    await auditLog({ bestellungId: id, benutzerId: session.sub, benutzerName: session.name, typ: "AUSGELIEFERT", neuerWert: neu?.bestellStatus });
    ereignisSenden("ausliefern");
    return ok({ auslieferungStatus: "DELIVERED", bestellStatus: neu?.bestellStatus });
  } catch (e) {
    return handleError(e);
  }
}
