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

    const vorher = await prisma.arbeitsbereich.findUnique({ where: { id }, select: { name: true } });
    if (!vorher) return fehler("Arbeitsbereich nicht gefunden.", 404);
    const wirdUmbenannt = daten.name !== undefined && daten.name !== vorher.name;

    const a = await prisma.$transaction(async (tx) => {
      const aktualisiert = await tx.arbeitsbereich.update({ where: { id }, data: daten });
      // Den „Account des Bereichs" mit umbenennen: nur BEREICH-Personen, deren
      // Anzeigename exakt dem ALTEN Bereichsnamen entspricht und die diesem Bereich
      // zugeordnet sind. So werden zufällig gleichnamige echte Mitarbeiter nicht angetastet.
      if (wirdUmbenannt) {
        await tx.benutzer.updateMany({
          where: {
            rolle: "BEREICH",
            anzeigename: vorher.name,
            arbeitsbereiche: { some: { arbeitsbereichId: id } },
          },
          data: { anzeigename: daten.name },
        });
      }
      return aktualisiert;
    });
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
