import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/admin/arbeitsbereiche – alle Arbeitsbereiche inkl. inaktiver. */
export async function GET() {
  try {
    const liste = await prisma.arbeitsbereich.findMany({
      orderBy: [{ sortierung: "asc" }, { name: "asc" }],
      include: { _count: { select: { produkte: true, mitarbeiter: true } } },
    });
    return ok(
      liste.map((a) => ({
        id: a.id,
        name: a.name,
        beschreibung: a.beschreibung,
        icon: a.icon,
        aktiv: a.aktiv,
        sortierung: a.sortierung,
        anzahlProdukte: a._count.produkte,
        anzahlMitarbeiter: a._count.mitarbeiter,
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
});

/** POST /api/admin/arbeitsbereiche */
export async function POST(req: Request) {
  try {
    const daten = CreateSchema.parse(await req.json());
    const a = await prisma.arbeitsbereich.create({
      data: {
        name: daten.name,
        beschreibung: daten.beschreibung ?? null,
        icon: daten.icon ?? null,
        aktiv: daten.aktiv ?? true,
        sortierung: daten.sortierung ?? 0,
      },
    });
    return ok(a, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
