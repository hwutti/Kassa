import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/status – Kennzahlen zur Kassenbereitschaft (Spec §9).
 */
export async function GET() {
  try {
    const [
      aktiveProdukte,
      aktiveOhnePreis,
      deaktivierte,
      mitInaktiverKategorie,
      ohneVerkaufsbereich,
      verkaufbare,
      aktiveBereiche,
      aktiveKategorien,
    ] = await Promise.all([
      prisma.produkt.count({ where: { aktiv: true, archiviert: false } }),
      prisma.produkt.count({ where: { aktiv: true, archiviert: false, preisCent: null } }),
      prisma.produkt.count({ where: { OR: [{ aktiv: false }, { archiviert: true }] } }),
      prisma.produkt.count({
        where: { aktiv: true, archiviert: false, kategorie: { aktiv: false } },
      }),
      prisma.produkt.count({
        where: { aktiv: true, archiviert: false, verkaufsbereiche: { none: {} } },
      }),
      // Verkaufbar = aktiv + gültiger Preis + aktive Kategorie + in mind. einem aktiven Bereich.
      prisma.produkt.count({
        where: {
          aktiv: true,
          archiviert: false,
          preisCent: { gte: 0 },
          kategorie: { aktiv: true },
          verkaufsbereiche: { some: { verkaufsbereich: { aktiv: true } } },
        },
      }),
      prisma.verkaufsbereich.count({ where: { aktiv: true } }),
      prisma.kategorie.count({ where: { aktiv: true } }),
    ]);

    return ok(
      {
        aktiveProdukte,
        verkaufbareProdukte: verkaufbare,
        aktiveOhnePreis,
        deaktivierte,
        mitInaktiverKategorie,
        ohneVerkaufsbereich,
        aktiveBereiche,
        aktiveKategorien,
        kasseBereit: verkaufbare > 0 && aktiveBereiche > 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
