// Zentrale Statuslogik für den Mehrbenutzer-Ablauf. Rein funktional (testbar).

export type TicketStatus =
  | "QUEUED"
  | "ACCEPTED"
  | "IN_PREPARATION"
  | "READY"
  | "COLLECTED"
  | "CANCELLED";

// Erlaubte Ticket-Übergänge (einfache Produkte dürfen ACCEPTED->READY überspringen).
const TICKET_UEBERGAENGE: Record<TicketStatus, TicketStatus[]> = {
  QUEUED: ["ACCEPTED", "IN_PREPARATION", "READY", "CANCELLED"],
  ACCEPTED: ["IN_PREPARATION", "READY", "CANCELLED"],
  IN_PREPARATION: ["READY", "CANCELLED"],
  READY: ["COLLECTED", "IN_PREPARATION"], // versehentlich fertig -> zurück erlaubt
  COLLECTED: [],
  CANCELLED: [],
};

export function ticketUebergangErlaubt(von: string, nach: string): boolean {
  const erlaubt = TICKET_UEBERGAENGE[von as TicketStatus];
  return Array.isArray(erlaubt) && erlaubt.includes(nach as TicketStatus);
}

/** Alle nicht-stornierten Tickets sind fertig (READY oder bereits abgeholt)? */
export function alleTicketsFertig(ticketStatus: string[]): boolean {
  const relevant = ticketStatus.filter((s) => s !== "CANCELLED");
  if (relevant.length === 0) return false;
  return relevant.every((s) => s === "READY" || s === "COLLECTED");
}

export function irgendeinTicketInArbeit(ticketStatus: string[]): boolean {
  return ticketStatus.some((s) => s === "ACCEPTED" || s === "IN_PREPARATION");
}

/**
 * Leitet den Auslieferungsstatus aus dem Zubereitungsfortschritt ab.
 * Kellner-gesteuerte Stufen (COLLECTED/DELIVERED) bleiben erhalten.
 */
export function berechneAuslieferung(vorher: string, fertig: boolean): string {
  if (vorher === "COLLECTED" || vorher === "DELIVERED") return vorher;
  return fertig ? "READY_FOR_PICKUP" : "NOT_READY";
}

/**
 * Gesamt-Bestellstatus aus den drei Dimensionen.
 * Abschluss (COMPLETED) nur bei ausgeliefert UND bezahlt.
 */
export function berechneBestellStatus(opts: {
  storniert: boolean;
  ticketStatus: string[];
  zahlungStatus: string;
  auslieferungStatus: string;
}): string {
  if (opts.storniert) return "CANCELLED";
  const { auslieferungStatus, zahlungStatus, ticketStatus } = opts;
  if (auslieferungStatus === "DELIVERED") {
    return zahlungStatus === "PAID" ? "COMPLETED" : "DELIVERED";
  }
  if (auslieferungStatus === "COLLECTED") return "COLLECTED";
  if (alleTicketsFertig(ticketStatus)) return "READY_FOR_PICKUP";
  if (irgendeinTicketInArbeit(ticketStatus)) return "IN_PROGRESS";
  return "SUBMITTED";
}

/** Grober Alt-/Gesamtstatus für Rückwärtskompatibilität (Feld `status`). */
export function legacyStatus(bestellStatus: string): "OFFEN" | "ABGESCHLOSSEN" | "STORNIERT" {
  if (bestellStatus === "CANCELLED") return "STORNIERT";
  if (bestellStatus === "COMPLETED") return "ABGESCHLOSSEN";
  return "OFFEN";
}

export const BESTELL_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  SUBMITTED: "Gesendet",
  IN_PROGRESS: "In Vorbereitung",
  READY_FOR_PICKUP: "Abholbereit",
  COLLECTED: "Abgeholt",
  DELIVERED: "Ausgeliefert",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Storniert",
};
export const TICKET_STATUS_LABEL: Record<string, string> = {
  QUEUED: "Neu",
  ACCEPTED: "Angenommen",
  IN_PREPARATION: "In Vorbereitung",
  READY: "Fertig",
  COLLECTED: "Abgeholt",
  CANCELLED: "Storniert",
};
