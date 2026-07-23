/** Minuten seit einem ISO-Zeitpunkt (nie negativ). null, wenn kein Zeitpunkt. */
export function minutenSeit(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}
