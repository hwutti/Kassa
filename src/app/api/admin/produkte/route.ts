import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { istPreisGueltig } from "@/lib/money";

export const dynamic = "force-dynamic";

/** GET /api/admin/produkte – ALLE Produkte, inkl. preisloser (mit preisFehlt-Flag). */
export async function GET() {
  try {
    const produkte = await prisma.produkt.findMany({
      orderBy: [{ sortierung: "asc" }, { name: "asc" }],
      include: {
        kategorie: { select: { id: true, name: true, aktiv: true } },
        verkaufsbereiche: { select: { verkaufsbereichId: true } },
      },
    });
    return ok(
      produkte.map((p) => ({
        id: p.id,
        name: p.name,
        beschreibung: p.beschreibung,
        preisCent: p.preisCent,
        preisFehlt: !istPreisGueltig(p.preisCent),
        aktiv: p.aktiv,
        sortierung: p.sortierung,
        kategorie: p.kategorie,
        verkaufsbereichIds: p.verkaufsbereiche.map((v) => v.verkaufsbereichId),
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  beschreibung: z.string().trim().max(500).nullable().optional(),
  // preisCent null erlaubt = "Preis fehlt".
  preisCent: z.number().int().min(0).nullable().optional(),
  aktiv: z.boolean().optional(),
  sortierung: z.number().int().optional(),
  kategorieId: z.string().min(1),
  verkaufsbereichIds: z.array(z.string().min(1)).default([]),
});

/** POST /api/admin/produkte */
export async function POST(req: Request) {
  try {
    const daten = CreateSchema.parse(await req.json());
    const produkt = await prisma.produkt.create({
      data: {
        name: daten.name,
        beschreibung: daten.beschreibung ?? null,
        preisCent: daten.preisCent ?? null,
        aktiv: daten.aktiv ?? true,
        sortierung: daten.sortierung ?? 0,
        kategorieId: daten.kategorieId,
        verkaufsbereiche: {
          create: daten.verkaufsbereichIds.map((verkaufsbereichId) => ({ verkaufsbereichId })),
        },
      },
    });
    return ok(produkt, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
