import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { hashPasswort } from "@/lib/passwort";

export const dynamic = "force-dynamic";

/** GET /api/admin/benutzer – alle Benutzer (ohne Passworthashes). */
export async function GET() {
  try {
    const benutzer = await prisma.benutzer.findMany({
      orderBy: [{ aktiv: "desc" }, { benutzername: "asc" }],
      select: {
        id: true,
        benutzername: true,
        anzeigename: true,
        rolle: true,
        darfZahlen: true,
        darfStornieren: true,
        aktiv: true,
        letzterLogin: true,
        arbeitsbereiche: { select: { arbeitsbereichId: true } },
      },
    });
    return ok(
      benutzer.map((b) => ({
        id: b.id,
        benutzername: b.benutzername,
        anzeigename: b.anzeigename,
        rolle: b.rolle,
        darfZahlen: b.darfZahlen,
        darfStornieren: b.darfStornieren,
        aktiv: b.aktiv,
        letzterLogin: b.letzterLogin?.toISOString() ?? null,
        arbeitsbereichIds: b.arbeitsbereiche.map((a) => a.arbeitsbereichId),
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

const CreateSchema = z.object({
  benutzername: z.string().trim().min(1).max(100),
  anzeigename: z.string().trim().max(100).nullable().optional(),
  passwort: z.string().min(4).max(200),
  rolle: z.enum(["ADMIN", "KELLNER", "BEREICH", "KASSA", "SUPERVISOR"]).default("KELLNER"),
  darfZahlen: z.boolean().optional(),
  darfStornieren: z.boolean().optional(),
  aktiv: z.boolean().optional(),
  arbeitsbereichIds: z.array(z.string().min(1)).default([]),
});

/** POST /api/admin/benutzer – neuen Benutzer anlegen (nur Rolle ADMIN). */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (session?.rolle !== "ADMIN") {
      return fehler("Nur Administratoren dürfen Benutzer verwalten.", 403);
    }
    const daten = CreateSchema.parse(await req.json());
    try {
      const benutzer = await prisma.benutzer.create({
        data: {
          benutzername: daten.benutzername,
          anzeigename: daten.anzeigename ?? null,
          passwortHash: hashPasswort(daten.passwort),
          rolle: daten.rolle,
          darfZahlen: daten.darfZahlen ?? false,
          darfStornieren: daten.darfStornieren ?? false,
          aktiv: daten.aktiv ?? true,
          arbeitsbereiche: { create: daten.arbeitsbereichIds.map((arbeitsbereichId) => ({ arbeitsbereichId })) },
        },
        select: { id: true, benutzername: true, rolle: true, aktiv: true },
      });
      return ok(benutzer, { status: 201 });
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
