import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  beschreibung: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  bildUrl: z.string().trim().max(300).nullable().optional(),
  // preisCent: null => Preis entfernen ("Preis fehlt" -> verschwindet aus der Kasse).
  preisCent: z.number().int().min(0).nullable().optional(),
  aktiv: z.boolean().optional(),
  archiviert: z.boolean().optional(),
  sortierung: z.number().int().optional(),
  kategorieId: z.string().min(1).optional(),
  verkaufsbereichIds: z.array(z.string().min(1)).optional(),
});

/** PATCH /api/admin/produkte/[id] – aktualisiert Felder, Preis und Bereichszuordnung. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const daten = UpdateSchema.parse(await req.json());

    // Aktuellen Preis für Änderungserkennung/Historie laden.
    const vorher = await prisma.produkt.findUnique({
      where: { id },
      select: { preisCent: true },
    });
    if (!vorher) return fehler("Produkt nicht gefunden", 404);

    const data: Prisma.ProduktUpdateInput = {};
    if (daten.name !== undefined) data.name = daten.name;
    if (daten.beschreibung !== undefined) data.beschreibung = daten.beschreibung;
    if (daten.icon !== undefined) data.icon = daten.icon;
    if (daten.bildUrl !== undefined) data.bildUrl = daten.bildUrl;
    if (daten.aktiv !== undefined) data.aktiv = daten.aktiv;
    if (daten.archiviert !== undefined) data.archiviert = daten.archiviert;
    if (daten.sortierung !== undefined) data.sortierung = daten.sortierung;
    if (daten.kategorieId !== undefined) {
      data.kategorie = { connect: { id: daten.kategorieId } };
    }

    const preisGeaendert =
      daten.preisCent !== undefined && daten.preisCent !== vorher.preisCent;
    if (daten.preisCent !== undefined) {
      data.preisCent = daten.preisCent; // auch null möglich (Preis entfernen)
      if (preisGeaendert) data.preisGeaendertAm = new Date();
    }

    const produkt = await prisma.$transaction(async (tx) => {
      // Bereichszuordnung ggf. komplett ersetzen.
      if (daten.verkaufsbereichIds !== undefined) {
        await tx.produktVerkaufsbereich.deleteMany({ where: { produktId: id } });
        if (daten.verkaufsbereichIds.length > 0) {
          await tx.produktVerkaufsbereich.createMany({
            data: daten.verkaufsbereichIds.map((verkaufsbereichId) => ({
              produktId: id,
              verkaufsbereichId,
            })),
          });
        }
      }
      // Preisänderung protokollieren.
      if (preisGeaendert) {
        await tx.preishistorie.create({
          data: {
            produktId: id,
            alterPreisCent: vorher.preisCent,
            neuerPreisCent: daten.preisCent ?? null,
          },
        });
      }
      return tx.produkt.update({ where: { id }, data });
    });

    return ok(produkt);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/produkte/[id] – nur, wenn keine Bestellposition darauf verweist. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.produktVerkaufsbereich.deleteMany({ where: { produktId: id } });
        await tx.produkt.delete({ where: { id } });
      });
      return ok({ geloescht: true });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        return fehler(
          "Produkt kann nicht gelöscht werden, da es in Bestellungen verwendet wird. Bitte stattdessen deaktivieren.",
          409,
        );
      }
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}
