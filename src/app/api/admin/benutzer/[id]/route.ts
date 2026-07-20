import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { hashPasswort } from "@/lib/passwort";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  benutzername: z.string().trim().min(1).max(100).optional(),
  anzeigename: z.string().trim().max(100).nullable().optional(),
  passwort: z.string().min(4).max(200).optional(), // gesetzt = Passwort zurücksetzen
  rolle: z.enum(["ADMIN", "KELLNER", "BEREICH", "KASSA", "SUPERVISOR"]).optional(),
  darfZahlen: z.boolean().optional(),
  darfStornieren: z.boolean().optional(),
  aktiv: z.boolean().optional(),
  arbeitsbereichIds: z.array(z.string().min(1)).optional(),
});

/** Prüft, ob nach der Änderung noch mindestens ein aktiver ADMIN übrig bliebe. */
async function letzterAdminBetroffen(id: string): Promise<boolean> {
  const aktiveAdmins = await prisma.benutzer.count({
    where: { rolle: "ADMIN", aktiv: true, NOT: { id } },
  });
  return aktiveAdmins === 0;
}

/** PATCH /api/admin/benutzer/[id] – Benutzer bearbeiten (nur ADMIN). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (session?.rolle !== "ADMIN") {
      return fehler("Nur Administratoren dürfen Benutzer verwalten.", 403);
    }
    const { id } = await params;
    const daten = UpdateSchema.parse(await req.json());

    const ziel = await prisma.benutzer.findUnique({
      where: { id },
      select: { rolle: true, aktiv: true },
    });
    if (!ziel) return fehler("Benutzer nicht gefunden.", 404);

    // Aussperr-Schutz: den letzten aktiven Admin nicht deaktivieren oder herabstufen.
    const wirdInaktiv = daten.aktiv === false && ziel.aktiv;
    const verliertAdmin = daten.rolle !== undefined && daten.rolle !== "ADMIN" && ziel.rolle === "ADMIN";
    if ((wirdInaktiv || verliertAdmin) && (await letzterAdminBetroffen(id))) {
      return fehler("Der letzte aktive Administrator kann nicht deaktiviert oder herabgestuft werden.", 409);
    }

    const data: Prisma.BenutzerUpdateInput = {};
    if (daten.benutzername !== undefined) data.benutzername = daten.benutzername;
    if (daten.anzeigename !== undefined) data.anzeigename = daten.anzeigename;
    if (daten.rolle !== undefined) data.rolle = daten.rolle;
    if (daten.darfZahlen !== undefined) data.darfZahlen = daten.darfZahlen;
    if (daten.darfStornieren !== undefined) data.darfStornieren = daten.darfStornieren;
    if (daten.aktiv !== undefined) data.aktiv = daten.aktiv;
    if (daten.passwort !== undefined) data.passwortHash = hashPasswort(daten.passwort);

    try {
      const benutzer = await prisma.$transaction(async (tx) => {
        if (daten.arbeitsbereichIds !== undefined) {
          await tx.benutzerArbeitsbereich.deleteMany({ where: { benutzerId: id } });
          if (daten.arbeitsbereichIds.length > 0) {
            await tx.benutzerArbeitsbereich.createMany({
              data: daten.arbeitsbereichIds.map((arbeitsbereichId) => ({ benutzerId: id, arbeitsbereichId })),
            });
          }
        }
        return tx.benutzer.update({
          where: { id },
          data,
          select: { id: true, benutzername: true, rolle: true, aktiv: true },
        });
      });
      return ok(benutzer);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return fehler("Ein Benutzer mit diesem Namen existiert bereits.", 409);
      }
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/benutzer/[id] – Benutzer löschen (nur ADMIN, nicht sich selbst / letzten Admin). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (session?.rolle !== "ADMIN") {
      return fehler("Nur Administratoren dürfen Benutzer verwalten.", 403);
    }
    const { id } = await params;
    if (session.sub === id) {
      return fehler("Sie können sich nicht selbst löschen.", 409);
    }
    const ziel = await prisma.benutzer.findUnique({ where: { id }, select: { rolle: true } });
    if (!ziel) return fehler("Benutzer nicht gefunden.", 404);
    if (ziel.rolle === "ADMIN" && (await letzterAdminBetroffen(id))) {
      return fehler("Der letzte aktive Administrator kann nicht gelöscht werden.", 409);
    }
    await prisma.benutzer.delete({ where: { id } });
    return ok({ geloescht: true });
  } catch (e) {
    return handleError(e);
  }
}
