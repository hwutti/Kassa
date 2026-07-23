import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { requireRolle } from "@/lib/auth";
import { darfBereich } from "@/lib/rollen";
import { ticketUebergangErlaubt } from "@/lib/statuslogik";
import { bestellungNeuBerechnen, auditLog } from "@/lib/bestelllogik";
import { ereignisSenden } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";

const Schema = z.object({
  status: z.enum(["QUEUED", "ACCEPTED", "IN_PREPARATION", "READY", "CANCELLED"]),
  version: z.number().int().nonnegative(),
});

/** POST /api/bereich/tickets/[id] – Ticketstatus ändern (mit Versionsprüfung). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRolle(darfBereich);
    if (session instanceof Response) return session;
    const { id } = await params;
    const { status, version } = Schema.parse(await req.json());

    const ticket = await prisma.bereichsticket.findUnique({
      where: { id },
      select: { status: true, version: true, arbeitsbereichId: true, bestellungId: true },
    });
    if (!ticket) return fehler("Ticket nicht gefunden.", 404);
    if (ticket.version !== version) {
      return fehler("Das Ticket wurde zwischenzeitlich geändert. Bitte neu laden.", 409);
    }
    if (!ticketUebergangErlaubt(ticket.status, status)) {
      return fehler(`Übergang ${ticket.status} → ${status} nicht erlaubt.`, 409);
    }

    const jetzt = new Date();
    await prisma.bereichsticket.update({
      where: { id },
      data: {
        status,
        version: { increment: 1 },
        // Zurückgegeben (QUEUED): Bearbeiter/Annahme zurücksetzen, damit es wieder frei ist.
        bearbeiterId: status === "QUEUED" ? null : session.sub,
        angenommenAm: status === "ACCEPTED" ? jetzt : status === "QUEUED" ? null : undefined,
        fertigAm: status === "READY" ? jetzt : undefined,
      },
    });

    // Positionen dieses Bereichs mitziehen, wenn fertig.
    if (status === "READY") {
      await prisma.bestellPosition.updateMany({
        where: { bestellungId: ticket.bestellungId, arbeitsbereichId: ticket.arbeitsbereichId },
        data: { status: "READY" },
      });
    }

    const neu = await bestellungNeuBerechnen(ticket.bestellungId);
    await auditLog({
      bestellungId: ticket.bestellungId,
      ticketId: id,
      benutzerId: session.sub,
      benutzerName: session.name,
      typ: "TICKET_STATUS",
      alterWert: ticket.status,
      neuerWert: status,
    });
    ereignisSenden("ticket");
    return ok({ status, bestellStatus: neu?.bestellStatus });
  } catch (e) {
    return handleError(e);
  }
}
