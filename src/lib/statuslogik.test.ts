import { describe, it, expect } from "vitest";
import {
  ticketUebergangErlaubt,
  alleTicketsFertig,
  berechneAuslieferung,
  berechneBestellStatus,
  legacyStatus,
} from "./statuslogik";

describe("ticketUebergangErlaubt", () => {
  it("erlaubt sinnvolle Übergänge und verbietet Sprünge zurück", () => {
    expect(ticketUebergangErlaubt("QUEUED", "ACCEPTED")).toBe(true);
    expect(ticketUebergangErlaubt("QUEUED", "READY")).toBe(true); // einfache Produkte
    expect(ticketUebergangErlaubt("IN_PREPARATION", "READY")).toBe(true);
    expect(ticketUebergangErlaubt("COLLECTED", "READY")).toBe(false);
    expect(ticketUebergangErlaubt("CANCELLED", "READY")).toBe(false);
  });
});

describe("alleTicketsFertig", () => {
  it("true nur wenn alle nicht-stornierten Tickets READY/COLLECTED sind", () => {
    expect(alleTicketsFertig(["READY", "COLLECTED"])).toBe(true);
    expect(alleTicketsFertig(["READY", "IN_PREPARATION"])).toBe(false);
    expect(alleTicketsFertig(["READY", "CANCELLED"])).toBe(true);
    expect(alleTicketsFertig([])).toBe(false);
  });
});

describe("berechneAuslieferung", () => {
  it("wird abholbereit sobald fertig, hält aber Kellner-Stufen", () => {
    expect(berechneAuslieferung("NOT_READY", true)).toBe("READY_FOR_PICKUP");
    expect(berechneAuslieferung("NOT_READY", false)).toBe("NOT_READY");
    expect(berechneAuslieferung("COLLECTED", false)).toBe("COLLECTED");
    expect(berechneAuslieferung("DELIVERED", false)).toBe("DELIVERED");
  });
});

describe("berechneBestellStatus", () => {
  const basis = { storniert: false, zahlungStatus: "UNPAID", auslieferungStatus: "NOT_READY" };
  it("SUBMITTED wenn nichts in Arbeit", () => {
    expect(berechneBestellStatus({ ...basis, ticketStatus: ["QUEUED", "QUEUED"] })).toBe("SUBMITTED");
  });
  it("IN_PROGRESS wenn ein Bereich arbeitet", () => {
    expect(berechneBestellStatus({ ...basis, ticketStatus: ["IN_PREPARATION", "QUEUED"] })).toBe("IN_PROGRESS");
  });
  it("READY_FOR_PICKUP wenn alle Tickets fertig", () => {
    expect(berechneBestellStatus({ ...basis, ticketStatus: ["READY", "READY"] })).toBe("READY_FOR_PICKUP");
  });
  it("DELIVERED ausgeliefert aber unbezahlt – nicht abgeschlossen", () => {
    expect(berechneBestellStatus({ ...basis, ticketStatus: ["READY"], auslieferungStatus: "DELIVERED" })).toBe("DELIVERED");
  });
  it("COMPLETED nur wenn ausgeliefert UND bezahlt", () => {
    expect(
      berechneBestellStatus({ storniert: false, ticketStatus: ["READY"], zahlungStatus: "PAID", auslieferungStatus: "DELIVERED" }),
    ).toBe("COMPLETED");
  });
  it("CANCELLED bei Storno", () => {
    expect(berechneBestellStatus({ ...basis, storniert: true, ticketStatus: ["READY"] })).toBe("CANCELLED");
  });
});

describe("legacyStatus", () => {
  it("bildet den groben Gesamtstatus ab", () => {
    expect(legacyStatus("COMPLETED")).toBe("ABGESCHLOSSEN");
    expect(legacyStatus("CANCELLED")).toBe("STORNIERT");
    expect(legacyStatus("IN_PROGRESS")).toBe("OFFEN");
  });
});
