import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { getEinstellung } from "@/lib/konfiguration";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/konfiguration – öffentliche Anzeigedaten für den Header (Logo, Titel, aktive Veranstaltung). */
export async function GET() {
  try {
    const e = await getEinstellung();
    const veranstaltung = await prisma.veranstaltung.findFirst({
      where: { aktiv: true },
      select: { id: true, name: true },
    });
    return ok(
      {
        titel: e.titel,
        untertitel: e.untertitel,
        logoUrl: e.logoUrl,
        logoHoehe: e.logoHoehe,
        aktiveVeranstaltung: veranstaltung,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
