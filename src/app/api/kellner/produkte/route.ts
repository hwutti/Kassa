import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { verkaufbarWhere } from "@/lib/sichtbarkeit";
import { requireRolle } from "@/lib/auth";
import { darfKellner } from "@/lib/rollen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/kellner/produkte – alle verkaufbaren Produkte für die Bestellaufnahme. */
export async function GET() {
  try {
    const session = await requireRolle(darfKellner);
    if (session instanceof Response) return session;

    const produkteRaw = await prisma.produkt.findMany({
      where: verkaufbarWhere(),
      orderBy: [{ sortierung: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        preisCent: true,
        icon: true,
        bildUrl: true,
        kategorieId: true,
        kategorie: { select: { id: true, name: true, farbe: true, icon: true, sortierung: true } },
        arbeitsbereiche: { select: { arbeitsbereichId: true, primaer: true } },
      },
    });

    const produkte = produkteRaw.map((p) => ({
      id: p.id,
      name: p.name,
      preisCent: p.preisCent as number,
      icon: p.icon,
      bildUrl: p.bildUrl,
      kategorieId: p.kategorieId,
    }));

    const katMap = new Map<string, { id: string; name: string; farbe: string | null; icon: string | null; sortierung: number }>();
    for (const p of produkteRaw) {
      if (!katMap.has(p.kategorie.id)) katMap.set(p.kategorie.id, p.kategorie);
    }
    const kategorien = [...katMap.values()]
      .sort((a, b) => a.sortierung - b.sortierung || a.name.localeCompare(b.name))
      .map(({ id, name, farbe, icon }) => ({ id, name, farbe, icon }));

    return ok({ kategorien, produkte, stand: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
