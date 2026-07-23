import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { normalisiereCode } from "@/lib/gutschein";

export const dynamic = "force-dynamic";

/**
 * GET /api/gutschein/[code] – Restguthaben eines Gutscheins (für die Prüfung an
 * der Kasse vor dem Einlösen). Nur für angemeldete Geräte.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fehler("Nicht angemeldet.", 401);
    const { code } = await params;
    const gutschein = await prisma.gutschein.findUnique({
      where: { code: normalisiereCode(decodeURIComponent(code)) },
      select: { code: true, restCent: true, aktiv: true },
    });
    if (!gutschein) return fehler("Gutschein nicht gefunden.", 404);
    return ok(gutschein, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
