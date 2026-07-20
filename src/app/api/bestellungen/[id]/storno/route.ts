import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { verifyPasswort } from "@/lib/passwort";
import { ereignisSenden } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";

const StornoSchema = z.object({
  grund: z.string().trim().min(1).max(300),
  // Optional: Admin-Passwort, falls an der Kasse keine Session besteht.
  passwort: z.string().max(200).optional(),
});

/**
 * POST /api/bestellungen/[id]/storno
 * Storniert eine abgeschlossene Bestellung (auch direkt vom Kassen-Beleg).
 * Autorisierung: gültige Session ODER gültiges Admin-Passwort (Spec §24).
 * Die Bestellung wird nicht gelöscht, sondern als STORNIERT markiert.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { grund, passwort } = StornoSchema.parse(await req.json());

    // --- Autorisierung ---
    let storniertVon: string | null = null;
    const session = await getSession();
    if (session) {
      storniertVon = session.name;
    } else if (passwort) {
      const admins = await prisma.benutzer.findMany({
        where: { rolle: "ADMIN", aktiv: true },
        select: { benutzername: true, passwortHash: true },
      });
      const treffer = admins.find((a) => verifyPasswort(passwort, a.passwortHash));
      if (treffer) storniertVon = treffer.benutzername;
    }
    if (!storniertVon) {
      return fehler("Nicht berechtigt. Bitte Admin-Passwort eingeben oder in der Verwaltung anmelden.", 401);
    }

    const bestellung = await prisma.bestellung.findUnique({ where: { id }, select: { status: true } });
    if (!bestellung) return fehler("Bestellung nicht gefunden.", 404);
    if (bestellung.status === "STORNIERT") return fehler("Bestellung ist bereits storniert.", 409);

    const aktualisiert = await prisma.bestellung.update({
      where: { id },
      data: {
        status: "STORNIERT",
        bestellStatus: "CANCELLED",
        storniertAm: new Date(),
        stornoGrund: grund,
        storniertVon,
      },
      select: { id: true, nummer: true, status: true },
    });
    ereignisSenden("storno");
    return ok(aktualisiert);
  } catch (e) {
    return handleError(e);
  }
}
