import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/admin/verkaufsbereiche – alle Bereiche inkl. inaktiver. */
export async function GET() {
  try {
    const bereiche = await prisma.verkaufsbereich.findMany({
      orderBy: [{ sortierung: "asc" }, { name: "asc" }],
      include: { _count: { select: { produkte: true } } },
    });
    return ok(
      bereiche.map((b) => ({
        id: b.id,
        name: b.name,
        beschreibung: b.beschreibung,
        icon: b.icon,
        aktiv: b.aktiv,
        istAllgemein: b.istAllgemein,
        sortierung: b.sortierung,
        anzahlProdukte: b._count.produkte,
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
  istAllgemein: z.boolean().optional(),
  sortierung: z.number().int().optional(),
});

/** POST /api/admin/verkaufsbereiche – neuen Bereich anlegen. */
export async function POST(req: Request) {
  try {
    const daten = CreateSchema.parse(await req.json());
    const bereich = await prisma.verkaufsbereich.create({
      data: {
        name: daten.name,
        beschreibung: daten.beschreibung ?? null,
        icon: daten.icon ?? null,
        aktiv: daten.aktiv ?? true,
        istAllgemein: daten.istAllgemein ?? false,
        sortierung: daten.sortierung ?? 0,
      },
    });
    return ok(bereich, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
