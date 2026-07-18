import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/health – prüft Server- und Datenbankverbindung.
 * Der Client nutzt das, um den Verbindungsstatus verlässlich anzuzeigen
 * (navigator.onLine allein ist unzuverlässig).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { ok: true, stand: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, must-revalidate" } },
    );
  } catch {
    return Response.json(
      { ok: false, error: "Datenbank nicht erreichbar" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
