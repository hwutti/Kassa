import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/admin/kategorien – alle Kategorien inkl. inaktiver. */
export async function GET() {
  try {
    const kategorien = await prisma.kategorie.findMany({
      orderBy: [{ sortierung: "asc" }, { name: "asc" }],
      include: { _count: { select: { produkte: true } } },
    });
    return ok(
      kategorien.map((k) => ({
        id: k.id,
        name: k.name,
        beschreibung: k.beschreibung,
        icon: k.icon,
        aktiv: k.aktiv,
        sortierung: k.sortierung,
        farbe: k.farbe,
        anzahlProdukte: k._count.produkte,
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  beschreibung: z.string().trim().max(300).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  aktiv: z.boolean().optional(),
  sortierung: z.number().int().optional(),
  farbe: z.string().trim().max(20).nullable().optional(),
});

/** POST /api/admin/kategorien */
export async function POST(req: Request) {
  try {
    const daten = CreateSchema.parse(await req.json());
    const kategorie = await prisma.kategorie.create({
      data: {
        name: daten.name,
        beschreibung: daten.beschreibung ?? null,
        icon: daten.icon ?? null,
        aktiv: daten.aktiv ?? true,
        sortierung: daten.sortierung ?? 0,
        farbe: daten.farbe ?? null,
      },
    });
    return ok(kategorie, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
