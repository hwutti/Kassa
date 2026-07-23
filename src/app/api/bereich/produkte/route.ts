import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { requireRolle } from "@/lib/auth";
import { darfBereich } from "@/lib/rollen";
import { ereignisSenden } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Arbeitsbereiche der angemeldeten Person (BEREICH); Admin/Supervisor = alle. */
async function eigeneAreaIds(sub: string, rolle: string): Promise<string[] | undefined> {
  if (rolle !== "BEREICH") return undefined; // undefined = keine Einschränkung
  const z = await prisma.benutzerArbeitsbereich.findMany({ where: { benutzerId: sub }, select: { arbeitsbereichId: true } });
  return z.map((x) => x.arbeitsbereichId);
}

/**
 * GET /api/bereich/produkte – Produkte der eigenen Arbeitsbereiche mit
 * Ausverkauft-Status, zum schnellen Umschalten direkt im Bereich.
 */
export async function GET() {
  try {
    const session = await requireRolle(darfBereich);
    if (session instanceof Response) return session;
    const areaIds = await eigeneAreaIds(session.sub, session.rolle);
    if (areaIds && areaIds.length === 0) return ok({ produkte: [] }, { headers: { "Cache-Control": "no-store" } });

    const produkte = await prisma.produkt.findMany({
      where: {
        aktiv: true,
        archiviert: false,
        ...(areaIds ? { arbeitsbereiche: { some: { arbeitsbereichId: { in: areaIds } } } } : {}),
      },
      orderBy: [{ ausverkauft: "desc" }, { sortierung: "asc" }, { name: "asc" }],
      select: { id: true, name: true, icon: true, bildUrl: true, ausverkauft: true, kategorie: { select: { name: true } } },
    });

    return ok(
      { produkte: produkte.map((p) => ({ id: p.id, name: p.name, icon: p.icon, bildUrl: p.bildUrl, ausverkauft: p.ausverkauft, kategorieName: p.kategorie.name })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

const Schema = z.object({ produktId: z.string().min(1), ausverkauft: z.boolean() });

/** POST /api/bereich/produkte – Ausverkauft-Status eines Produkts umschalten (nur eigene Bereiche). */
export async function POST(req: Request) {
  try {
    const session = await requireRolle(darfBereich);
    if (session instanceof Response) return session;
    const { produktId, ausverkauft } = Schema.parse(await req.json());

    const areaIds = await eigeneAreaIds(session.sub, session.rolle);
    if (areaIds) {
      const gehoert = await prisma.produktArbeitsbereich.findFirst({
        where: { produktId, arbeitsbereichId: { in: areaIds } },
        select: { produktId: true },
      });
      if (!gehoert) return fehler("Produkt gehört zu keinem deiner Arbeitsbereiche.", 403);
    }

    await prisma.produkt.update({ where: { id: produktId }, data: { ausverkauft } });
    ereignisSenden("produkt");
    return ok({ produktId, ausverkauft });
  } catch (e) {
    return handleError(e);
  }
}
