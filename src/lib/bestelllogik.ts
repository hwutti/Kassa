import { prisma } from "@/lib/prisma";
import {
  alleTicketsFertig,
  berechneAuslieferung,
  berechneBestellStatus,
  legacyStatus,
} from "@/lib/statuslogik";

/**
 * Rechnet den Gesamtstatus einer Bestellung aus Tickets + Zahlung + Auslieferung neu
 * und speichert ihn. Nach jeder Ticket-/Zahlungs-/Auslieferungsänderung aufrufen.
 */
export async function bestellungNeuBerechnen(bestellungId: string) {
  const b = await prisma.bestellung.findUnique({
    where: { id: bestellungId },
    select: {
      status: true,
      zahlungStatus: true,
      auslieferungStatus: true,
      tickets: { select: { status: true } },
    },
  });
  if (!b) return;

  const storniert = b.status === "STORNIERT" || b.auslieferungStatus === "CANCELLED";
  const ticketStatus = b.tickets.map((t) => t.status);
  const fertig = alleTicketsFertig(ticketStatus);
  const auslieferungStatus = storniert
    ? b.auslieferungStatus
    : berechneAuslieferung(b.auslieferungStatus, fertig);
  const bestellStatus = berechneBestellStatus({
    storniert,
    ticketStatus,
    zahlungStatus: b.zahlungStatus,
    auslieferungStatus,
  });

  await prisma.bestellung.update({
    where: { id: bestellungId },
    data: { auslieferungStatus, bestellStatus, status: legacyStatus(bestellStatus) },
  });
  return { auslieferungStatus, bestellStatus };
}

/** Schreibt einen Audit-Eintrag (best effort, nie blockierend). */
export async function auditLog(daten: {
  bestellungId?: string;
  ticketId?: string;
  positionId?: string;
  benutzerId?: string;
  benutzerName?: string;
  typ: string;
  alterWert?: string;
  neuerWert?: string;
  grund?: string;
}) {
  try {
    await prisma.auditEreignis.create({ data: daten });
  } catch {
    /* Audit darf den Ablauf nicht blockieren */
  }
}
