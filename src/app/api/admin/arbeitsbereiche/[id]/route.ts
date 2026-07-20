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
  sortierung: z.number().int().optional(),
});

/** PATCH /api/admin/arbeitsbereiche/[id] */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const daten = UpdateSchema.parse(await req.json());
    const a = await prisma.arbeitsbereich.update({ where: { id }, data: daten });
    return ok(a);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/arbeitsbereiche/[id] – nur ohne zugeordnete Tickets. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tickets = await prisma.bereichsticket.count({ where: { arbeitsbereichId: id } });
    if (tickets > 0) {
      return fehler(
        "Arbeitsbereich kann nicht gelöscht werden, da bereits Tickets darauf verweisen. Bitte deaktivieren.",
        409,
      );
    }
    try {
      await prisma.$transaction([
        prisma.produktArbeitsbereich.deleteMany({ where: { arbeitsbereichId: id } }),
        prisma.benutzerArbeitsbereich.deleteMany({ where: { arbeitsbereichId: id } }),
        prisma.arbeitsbereich.delete({ where: { id } }),
      ]);
      return ok({ geloescht: true });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return fehler("Arbeitsbereich nicht gefunden.", 404);
      }
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}
