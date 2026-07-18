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
      select: { id: true, benutzername: true, rolle: true, aktiv: true, letzterLogin: true },
    });
    return ok(
      benutzer.map((b) => ({
        ...b,
        letzterLogin: b.letzterLogin?.toISOString() ?? null,
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

const CreateSchema = z.object({
  benutzername: z.string().trim().min(1).max(100),
  passwort: z.string().min(4).max(200),
  rolle: z.enum(["ADMIN", "KASSA"]).default("KASSA"),
  aktiv: z.boolean().optional(),
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
          passwortHash: hashPasswort(daten.passwort),
          rolle: daten.rolle,
          aktiv: daten.aktiv ?? true,
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
