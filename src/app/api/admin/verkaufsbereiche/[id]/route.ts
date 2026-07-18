import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  beschreibung: z.string().trim().max(300).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  aktiv: z.boolean().optional(),
  istAllgemein: z.boolean().optional(),
  sortierung: z.number().int().optional(),
});

/** PATCH /api/admin/verkaufsbereiche/[id] */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const daten = UpdateSchema.parse(await req.json());
    const bereich = await prisma.verkaufsbereich.update({ where: { id }, data: daten });
    return ok(bereich);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/verkaufsbereiche/[id] – nur möglich, wenn keine Bestellung darauf verweist. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    try {
      await prisma.verkaufsbereich.delete({ where: { id } });
      return ok({ geloescht: true });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        return fehler(
          "Bereich kann nicht gelöscht werden, da bereits Bestellungen darauf verweisen. Bitte stattdessen deaktivieren.",
          409,
        );
      }
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}
