// Zentrale Geld-Helfer. Beträge werden intern als Integer-Cent gehalten.

/** Formatiert Cent als EUR-String, z. B. 1250 -> "12,50 €". */
export function formatCent(cent: number | null | undefined): string {
  if (cent === null || cent === undefined) return "—";
  return new Intl.NumberFormat("de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cent / 100);
}

/**
 * Parst eine Benutzereingabe (z. B. "12,50", "12.5", "12") zu Cent.
 * Gibt null zurück, wenn die Eingabe leer oder ungültig ist.
 */
export function parseEuroToCent(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  // Heuristik: Ist ein Komma vorhanden, gilt es als Dezimaltrenner und Punkte
  // sind Tausendertrenner ("1.234,56"). Ohne Komma gilt ein Punkt als
  // Dezimaltrenner ("2.5" -> 2,50), damit beide Schreibweisen funktionieren.
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/**
 * Ein Preis gilt als gültig, wenn er gesetzt (nicht NULL) und >= 0 ist.
 * Damit ist die "Preis fehlt"-Bedingung an genau einer Stelle definiert.
 */
export function istPreisGueltig(preisCent: number | null | undefined): boolean {
  return preisCent !== null && preisCent !== undefined && Number.isInteger(preisCent) && preisCent >= 0;
}
