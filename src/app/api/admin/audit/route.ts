import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit?typ=&limit=
 * Liefert das Ereignis-Protokoll (AuditEreignis) und die Preisänderungen
 * (Preishistorie) zur Einsicht in der Verwaltung. Nur für Admin (Middleware).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const typ = url.searchParams.get("typ") || undefined;
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200) || 200, 1), 500);

    const ereignisse = await prisma.auditEreignis.findMany({
      where: typ ? { typ } : undefined,
      orderBy: { zeitpunkt: "desc" },
      take: limit,
    });

    // Bestellnummern nachladen – AuditEreignis hat bewusst keine harte Relation.
    const bIds = [...new Set(ereignisse.map((e) => e.bestellungId).filter((x): x is string => !!x))];
    const bestellungen = bIds.length
      ? await prisma.bestellung.findMany({ where: { id: { in: bIds } }, select: { id: true, nummer: true } })
      : [];
    const nummerVon = new Map(bestellungen.map((b) => [b.id, b.nummer]));

    const preise = await prisma.preishistorie.findMany({
      orderBy: { geaendertAm: "desc" },
      take: 100,
      include: { produkt: { select: { name: true } } },
    });

    const typen = await prisma.auditEreignis.findMany({
      select: { typ: true },
      distinct: ["typ"],
      orderBy: { typ: "asc" },
    });

    return ok({
      ereignisse: ereignisse.map((e) => ({
        id: e.id,
        zeitpunkt: e.zeitpunkt.toISOString(),
        typ: e.typ,
        benutzer: e.benutzerName ?? e.benutzerId ?? "—",
        nummer: e.bestellungId ? (nummerVon.get(e.bestellungId) ?? null) : null,
        alterWert: e.alterWert,
        neuerWert: e.neuerWert,
        grund: e.grund,
      })),
      preise: preise.map((p) => ({
        id: p.id,
        geaendertAm: p.geaendertAm.toISOString(),
        produkt: p.produkt?.name ?? "—",
        alterPreisCent: p.alterPreisCent,
        neuerPreisCent: p.neuerPreisCent,
        geaendertVon: p.geaendertVon,
      })),
      typen: typen.map((t) => t.typ),
    });
  } catch (e) {
    return handleError(e);
  }
}
