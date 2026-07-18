import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/admin/veranstaltungen – alle Veranstaltungen inkl. Bestellanzahl. */
export async function GET() {
  try {
    const liste = await prisma.veranstaltung.findMany({
      orderBy: [{ aktiv: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { bestellungen: true } } },
    });
    return ok(
      liste.map((v) => ({
        id: v.id,
        name: v.name,
        beschreibung: v.beschreibung,
        aktiv: v.aktiv,
        von: v.von?.toISOString() ?? null,
        bis: v.bis?.toISOString() ?? null,
        anzahlBestellungen: v._count.bestellungen,
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  beschreibung: z.string().trim().max(300).nullable().optional(),
  aktiv: z.boolean().optional(),
});

/** POST /api/admin/veranstaltungen – neue Veranstaltung. Wird sie aktiv gesetzt, werden andere deaktiviert. */
export async function POST(req: Request) {
  try {
    const daten = CreateSchema.parse(await req.json());
    const veranstaltung = await prisma.$transaction(async (tx) => {
      if (daten.aktiv) {
        await tx.veranstaltung.updateMany({ where: { aktiv: true }, data: { aktiv: false } });
      }
      return tx.veranstaltung.create({
        data: {
          name: daten.name,
          beschreibung: daten.beschreibung ?? null,
          aktiv: daten.aktiv ?? false,
        },
      });
    });
    return ok(veranstaltung, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
