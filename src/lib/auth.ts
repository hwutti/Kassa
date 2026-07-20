import { cookies } from "next/headers";
import { SESSION_COOKIE, verifyToken, type SessionDaten } from "@/lib/session";
import { fehler } from "@/lib/api";

// Server-seitige Auth-Helfer (nutzen next/headers – NUR in Server-Komponenten /
// Route-Handlern verwenden, nicht in der Middleware).

export type { SessionDaten };

/** Liest die aktuelle Session in Server-Komponenten / Route-Handlern. */
export async function getSession(): Promise<SessionDaten | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Für Route-Handler: liefert die Session oder wirft eine 401-Antwort.
 * Verwendung:  const s = await requireAuth(); if (s instanceof Response) return s;
 */
export async function requireAuth(): Promise<SessionDaten | Response> {
  const session = await getSession();
  if (!session) return fehler("Nicht angemeldet.", 401);
  return session;
}

/**
 * Für Route-Handler: liefert die Session, wenn die Rolle die Prüfung besteht,
 * sonst 401 (nicht angemeldet) bzw. 403 (keine Berechtigung).
 */
export async function requireRolle(
  pruefung: (rolle: string) => boolean,
): Promise<SessionDaten | Response> {
  const session = await getSession();
  if (!session) return fehler("Nicht angemeldet.", 401);
  if (!pruefung(session.rolle)) return fehler("Keine Berechtigung für diese Aktion.", 403);
  return session;
}
