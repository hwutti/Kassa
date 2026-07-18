import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  aktiv: z.boolean().optional(),
  sortierung: z.number().int().optional(),
  farbe: z.string().trim().max(20).nullable().optional(),
});

/** PATCH /api/admin/kategorien/[id] */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const daten = UpdateSchema.parse(await req.json());
    const kategorie = await prisma.kategorie.update({ where: { id }, data: daten });
    return ok(kategorie);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/kategorien/[id] – nur möglich, wenn keine Produkte zugeordnet sind. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    try {
      await prisma.kategorie.delete({ where: { id } });
      return ok({ geloescht: true });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        return fehler(
          "Kategorie kann nicht gelöscht werden, da ihr noch Produkte zugeordnet sind. Bitte stattdessen deaktivieren.",
          409,
        );
      }
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}
