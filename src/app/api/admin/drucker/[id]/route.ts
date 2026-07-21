import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  typ: z.enum(["SYSTEM", "NETZWERK"]).optional(),
  ip: z.string().trim().max(64).nullable().optional(),
  aktiv: z.boolean().optional(),
  sortierung: z.number().int().optional(),
  arbeitsbereichId: z.string().min(1).nullable().optional(),
});

/** PATCH /api/admin/drucker/[id] – Drucker bearbeiten. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const daten = UpdateSchema.parse(await req.json());
    const vorher = await prisma.drucker.findUnique({ where: { id }, select: { typ: true } });
    if (!vorher) return fehler("Drucker nicht gefunden.", 404);

    const data: Record<string, unknown> = {};
    if (daten.name !== undefined) data.name = daten.name;
    if (daten.typ !== undefined) data.typ = daten.typ;
    if (daten.aktiv !== undefined) data.aktiv = daten.aktiv;
    if (daten.sortierung !== undefined) data.sortierung = daten.sortierung;
    if (daten.arbeitsbereichId !== undefined) data.arbeitsbereichId = daten.arbeitsbereichId || null;
    // IP nur bei Netzwerk-Typ speichern; bei SYSTEM leeren.
    const typ = daten.typ ?? vorher.typ;
    if (daten.ip !== undefined || daten.typ !== undefined) {
      data.ip = typ === "NETZWERK" ? (daten.ip || null) : null;
    }

    const drucker = await prisma.drucker.update({ where: { id }, data });
    return ok(drucker);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/drucker/[id]. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.drucker.delete({ where: { id } });
    return ok({ geloescht: true });
  } catch (e) {
    return handleError(e);
  }
}
