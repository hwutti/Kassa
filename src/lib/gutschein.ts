// Reine Gutschein-Logik (testbar, ohne DB). Beträge in Cent.

export type EinloesungErgebnis =
  | { ok: true; neuerRest: number }
  | { ok: false; grund: string };

/**
 * Prüft, ob ein Gutschein für einen Betrag einlösbar ist, und berechnet das
 * neue Restguthaben. Teil-Einlösung ist erlaubt (Restguthaben bleibt erhalten),
 * eine Überziehung nicht.
 */
export function gutscheinEinloesen(
  gutschein: { aktiv: boolean; restCent: number },
  betragCent: number,
): EinloesungErgebnis {
  if (!gutschein.aktiv) return { ok: false, grund: "Gutschein ist deaktiviert." };
  if (gutschein.restCent <= 0) return { ok: false, grund: "Gutschein hat kein Guthaben mehr." };
  if (betragCent <= 0) return { ok: false, grund: "Kein Betrag zu buchen." };
  if (gutschein.restCent < betragCent) {
    return { ok: false, grund: `Guthaben zu gering – verfügbar ${(gutschein.restCent / 100).toFixed(2)} €.` };
  }
  return { ok: true, neuerRest: gutschein.restCent - betragCent };
}

/** Normalisiert einen eingegebenen/gescannten Code (Großschreibung, ohne Leerzeichen). */
export function normalisiereCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
