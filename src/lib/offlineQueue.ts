// Offline-Warteschlange für aufgenommene Bestellungen. Fällt die Verbindung aus,
// wird die Bestellung lokal (localStorage) gepuffert und automatisch gesendet,
// sobald wieder Netz da ist. Dank eindeutigem clientRef ist das erneute Senden
// idempotent (der Server erkennt Duplikate).

export type QueuedOrder = {
  clientRef: string;
  tisch: string | null;
  gast: string | null;
  notiz: string | null;
  positionen: { produktId: string; menge: number }[];
  gestelltAm: number;
  anzahl: number;
  summeCent: number;
};

// --- reine Logik (testbar, ohne Storage) ---
export function addToQueue(list: QueuedOrder[], order: QueuedOrder): QueuedOrder[] {
  if (list.some((x) => x.clientRef === order.clientRef)) return list;
  return [...list, order];
}
export function removeFromQueue(list: QueuedOrder[], clientRef: string): QueuedOrder[] {
  return list.filter((x) => x.clientRef !== clientRef);
}

// --- localStorage-Anbindung ---
const KEY = "offline-bestellungen-v1";

function lesen(): QueuedOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedOrder[]) : [];
  } catch {
    return [];
  }
}
function schreiben(list: QueuedOrder[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* Speicher gesperrt/voll – ignorieren */
  }
}

export function queueList(): QueuedOrder[] {
  return lesen();
}
export function queueAdd(order: QueuedOrder): void {
  schreiben(addToQueue(lesen(), order));
}
export function queueRemove(clientRef: string): void {
  schreiben(removeFromQueue(lesen(), clientRef));
}
export function queueCount(): number {
  return lesen().length;
}
