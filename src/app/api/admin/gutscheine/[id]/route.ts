import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  aktiv: z.boolean().optional(),
  notiz: z.string().trim().max(200).nullable().optional(),
});

/** PATCH /api/admin/gutscheine/[id] – aktiv/Notiz ändern (z. B. sperren). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const daten = UpdateSchema.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (daten.aktiv !== undefined) data.aktiv = daten.aktiv;
    if (daten.notiz !== undefined) data.notiz = daten.notiz;
    const gutschein = await prisma.gutschein.update({ where: { id }, data });
    return ok(gutschein);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/gutscheine/[id]. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.gutschein.delete({ where: { id } });
    return ok({ geloescht: true });
  } catch (e) {
    return handleError(e);
  }
}
