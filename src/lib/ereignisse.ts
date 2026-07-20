// Einfacher prozessinterner Ereignis-Bus für Server-Sent Events (SSE).
// Läuft im selben Node-Prozess wie die Route-Handler (self-hosted `next start`).

type Abonnent = (zeile: string) => void;

// Über globalThis, damit HMR im Dev nicht mehrere Instanzen erzeugt.
const g = globalThis as unknown as { __kassaSubs?: Set<Abonnent> };
const abonnenten: Set<Abonnent> = (g.__kassaSubs ??= new Set());

export function abonnieren(fn: Abonnent): () => void {
  abonnenten.add(fn);
  return () => abonnenten.delete(fn);
}

/** Meldet allen verbundenen Clients, dass sich etwas geändert hat. */
export function ereignisSenden(typ: string) {
  const zeile = `data: ${JSON.stringify({ typ })}\n\n`;
  for (const fn of abonnenten) {
    try {
      fn(zeile);
    } catch {
      /* toter Abonnent – wird beim nächsten cancel entfernt */
    }
  }
}
