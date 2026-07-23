/** Eindeutige Client-Referenz (für idempotente Bestell-/Zahlungs-Requests). */
export function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
