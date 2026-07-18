import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fehler(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Einheitliche Fehlerbehandlung für Route-Handler. */
export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return fehler("Ungültige Eingabe", 422, { issues: e.flatten() });
  }
  console.error("[api] Unerwarteter Fehler:", e);
  return fehler("Interner Serverfehler", 500);
}
