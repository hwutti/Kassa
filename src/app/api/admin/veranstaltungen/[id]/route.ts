import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  beschreibung: z.string().trim().max(300).nullable().optional(),
  aktiv: z.boolean().optional(),
});

/** PATCH /api/admin/veranstaltungen/[id] – aktiv=true deaktiviert alle anderen. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const daten = UpdateSchema.parse(await req.json());
    const veranstaltung = await prisma.$transaction(async (tx) => {
      if (daten.aktiv === true) {
        await tx.veranstaltung.updateMany({
          where: { aktiv: true, NOT: { id } },
          data: { aktiv: false },
        });
      }
      return tx.veranstaltung.update({ where: { id }, data: daten });
    });
    return ok(veranstaltung);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/veranstaltungen/[id] – nur ohne zugeordnete Bestellungen (sonst deaktivieren). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const anzahl = await prisma.bestellung.count({ where: { veranstaltungId: id } });
    if (anzahl > 0) {
      return fehler(
        "Veranstaltung kann nicht gelöscht werden, da ihr Bestellungen zugeordnet sind. Bitte stattdessen deaktivieren.",
        409,
      );
    }
    try {
      await prisma.veranstaltung.delete({ where: { id } });
      return ok({ geloescht: true });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return fehler("Veranstaltung nicht gefunden.", 404);
      }
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}
