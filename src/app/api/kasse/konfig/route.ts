import { ok, handleError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getEinstellung } from "@/lib/konfiguration";

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
    return ok(
      {
        sumupAffiliateKey: e.sumupAffiliateKey ?? null,
        bonAutoDruck: e.bonAutoDruck,
        bedienungsmodus: e.bedienungsmodus,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
