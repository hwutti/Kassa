import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { hashPasswort, verifyPasswort } from "@/lib/passwort";

/** Prüft, ob die PIN bereits von einem anderen Benutzer verwendet wird (PIN identifiziert die Person). */
async function pinVergeben(pin: string, ausserId?: string): Promise<boolean> {
  const kandidaten = await prisma.benutzer.findMany({
    where: { pinHash: { not: null }, ...(ausserId ? { NOT: { id: ausserId } } : {}) },
    select: { pinHash: true },
  });
  return kandidaten.some((b) => b.pinHash && verifyPasswort(pin, b.pinHash));
}

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
        pinHash: true,
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
        hatPin: b.pinHash !== null,
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
  benutzername: z.string().trim().min(1).max(100).optional(),
  anzeigename: z.string().trim().max(100).nullable().optional(),
  passwort: z.string().min(4).max(200).optional(),
  pin: z.string().regex(/^\d{4,6}$/).nullable().optional(),
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
    if (!daten.benutzername && !daten.anzeigename) {
      return fehler("Bitte eine Bezeichnung oder einen Login angeben.", 400);
    }
    if (!daten.passwort && !daten.pin) {
      return fehler("Bitte ein Passwort oder eine PIN vergeben.", 400);
    }
    if (daten.pin && (await pinVergeben(daten.pin))) {
      return fehler("Diese PIN ist bereits vergeben. Bitte eine andere wählen.", 409);
    }

    // Login optional: aus der Bezeichnung erzeugen und eindeutig machen.
    let benutzername = daten.benutzername?.trim();
    if (!benutzername) {
      const basis =
        (daten.anzeigename ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "") || "person";
      benutzername = basis;
      let i = 1;
      while (await prisma.benutzer.findUnique({ where: { benutzername } })) {
        benutzername = `${basis}${++i}`;
      }
    }
    // Ohne Passwort (nur PIN) wird ein zufälliges Passwort gesetzt (Spalte ist Pflicht).
    const passwortKlar = daten.passwort ?? randomBytes(24).toString("base64url");

    try {
      const benutzer = await prisma.benutzer.create({
        data: {
          benutzername,
          anzeigename: daten.anzeigename ?? null,
          passwortHash: hashPasswort(passwortKlar),
          pinHash: daten.pin ? hashPasswort(daten.pin) : null,
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
