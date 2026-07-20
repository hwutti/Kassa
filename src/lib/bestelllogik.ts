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
      bestellStatus: true,
      zahlungStatus: true,
      auslieferungStatus: true,
      tickets: { select: { status: true } },
    },
  });
  if (!b) return;

  const storniert = b.status === "STORNIERT" || b.auslieferungStatus === "CANCELLED";
  const ticketStatus = b.tickets.map((t) => t.status);
  // Ohne Tickets gibt es nichts vorzubereiten -> gilt als fertig.
  const fertig = ticketStatus.length === 0 ? true : alleTicketsFertig(ticketStatus);
  const auslieferungStatus = storniert
    ? b.auslieferungStatus
    : berechneAuslieferung(b.auslieferungStatus, fertig);
  const bestellStatus = berechneBestellStatus({
    storniert,
    ticketStatus,
    zahlungStatus: b.zahlungStatus,
    auslieferungStatus,
  });

  // Zeitpunkt des tatsächlichen Abschlusses festhalten (nur beim Übergang nach COMPLETED).
  const geradeAbgeschlossen = bestellStatus === "COMPLETED" && b.bestellStatus !== "COMPLETED";

  await prisma.bestellung.update({
    where: { id: bestellungId },
    data: {
      auslieferungStatus,
      bestellStatus,
      status: legacyStatus(bestellStatus),
      ...(geradeAbgeschlossen ? { abgeschlossenAm: new Date() } : {}),
    },
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
