// Zentrale Rollen- und Rechtedefinition. Wird serverseitig geprüft.

export const ROLLEN = ["ADMIN", "KELLNER", "BEREICH", "KASSA", "SUPERVISOR"] as const;
export type Rolle = (typeof ROLLEN)[number];

export const ROLLEN_LABEL: Record<Rolle, string> = {
  ADMIN: "Administrator",
  KELLNER: "Kellner",
  BEREICH: "Bereichsmitarbeiter",
  KASSA: "Kasse",
  SUPERVISOR: "Supervisor",
};

/** Standard-Startseite je Rolle nach der Anmeldung. */
export function startseiteFuer(rolle: string): string {
  switch (rolle) {
    case "KELLNER":
      return "/kellner";
    case "BEREICH":
      return "/bereich";
    case "KASSA":
      return "/kasse";
    case "SUPERVISOR":
      return "/uebersicht";
    default:
      return "/admin";
  }
}

export function istAdmin(rolle?: string): boolean {
  return rolle === "ADMIN";
}
/** Darf die globale Übersicht sehen und eingreifen. */
export function darfUebersicht(rolle?: string): boolean {
  return rolle === "ADMIN" || rolle === "SUPERVISOR";
}
/** Darf Bestellungen als Kellner aufnehmen/verwalten. */
export function darfKellner(rolle?: string): boolean {
  return rolle === "ADMIN" || rolle === "KELLNER" || rolle === "SUPERVISOR";
}
/** Darf Bereichstickets bearbeiten. */
export function darfBereich(rolle?: string): boolean {
  return rolle === "ADMIN" || rolle === "BEREICH" || rolle === "SUPERVISOR";
}
/**
 * Darf die zentrale Kassa bedienen (offene Bestellungen einsehen und abkassieren).
 * Der Verkäufer (KELLNER) kassiert seine eigenen Bestellungen zusätzlich über das
 * Benutzer-Recht `darfZahlen` – das wird pro Zahlung serverseitig geprüft.
 */
export function darfKassieren(rolle?: string): boolean {
  return rolle === "ADMIN" || rolle === "KASSA" || rolle === "SUPERVISOR";
}
