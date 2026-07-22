import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/admin/bestellungen – Bestellungen (geschützt via Middleware). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    const veranstaltungId = url.searchParams.get("veranstaltung");
    const bestellungen = await prisma.bestellung.findMany({
      where: veranstaltungId ? { veranstaltungId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        positionen: true,
        verkaufsbereich: { select: { name: true } },
        veranstaltung: { select: { name: true } },
      },
    });
    return ok(
      bestellungen.map((b) => ({
        id: b.id,
        nummer: b.nummer,
        status: b.status,
        summeCent: b.summeCent,
        erhaltenCent: b.erhaltenCent,
        rueckgeldCent: b.rueckgeldCent,
        zahlungsart: b.zahlungsart,
        tisch: b.tisch,
        abholnummer: b.abholnummer,
        createdAt: b.createdAt.toISOString(),
        storniertAm: b.storniertAm?.toISOString() ?? null,
        stornoGrund: b.stornoGrund,
        storniertVon: b.storniertVon,
        verkaufsbereichName: b.verkaufsbereich.name,
        veranstaltungName: b.veranstaltung?.name ?? null,
        positionen: b.positionen.map((p) => ({
          produktName: p.produktName,
          kategorieName: p.kategorieName,
          menge: p.menge,
          einzelpreisCent: p.einzelpreisCent,
          summeCent: p.summeCent,
        })),
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
