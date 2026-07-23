import { ok, handleError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getEinstellung } from "@/lib/konfiguration";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/kasse/konfig – Kassa-/Verkaufs-Einstellungen für angemeldete Geräte
 * (SumUp-Absprung, automatischer Bondruck). Nur mit gültiger Session.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    if (session instanceof Response) return session;
    const e = await getEinstellung();
    // Aktive Netzwerkdrucker (mit IP) – für Direktdruck aus Verkauf/Kasse.
    const netzdruckerRoh = await prisma.drucker.findMany({
      where: { aktiv: true, typ: "NETZWERK", ip: { not: null } },
      orderBy: [{ sortierung: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
    return ok(
      {
        sumupAffiliateKey: e.sumupAffiliateKey ?? null,
        bonAutoDruck: e.bonAutoDruck,
        rawbtAktiv: e.rawbtAktiv,
        bedienungsmodus: e.bedienungsmodus,
        netzdrucker: netzdruckerRoh,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
