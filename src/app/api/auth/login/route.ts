import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fehler, handleError } from "@/lib/api";
import { verifyPasswort } from "@/lib/passwort";
import { createToken, SESSION_COOKIE, cookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

// Entweder Benutzername+Passwort ODER PIN (identifiziert die Person am Tablet).
const LoginSchema = z.union([
  z.object({
    benutzername: z.string().trim().min(1).max(100),
    passwort: z.string().min(1).max(200),
  }),
  z.object({
    pin: z.string().regex(/^\d{4,6}$/),
  }),
]);

/** POST /api/auth/login – prüft Zugangsdaten (Passwort oder PIN) und setzt das Session-Cookie. */
export async function POST(req: Request) {
  try {
    const daten = LoginSchema.parse(await req.json());

    let benutzer: Awaited<ReturnType<typeof prisma.benutzer.findFirst>> = null;

    if ("pin" in daten) {
      // PIN-Login: unter den aktiven Benutzern mit PIN den passenden finden.
      const kandidaten = await prisma.benutzer.findMany({ where: { aktiv: true, pinHash: { not: null } } });
      benutzer = kandidaten.find((b) => b.pinHash && verifyPasswort(daten.pin, b.pinHash)) ?? null;
      if (!benutzer) return fehler("PIN ist falsch.", 401);
    } else {
      // Benutzername groß-/kleinschreibungsunabhängig vergleichen (Tablets schreiben oft groß).
      const eingabe = daten.benutzername.trim();
      benutzer = await prisma.benutzer.findUnique({ where: { benutzername: eingabe } });
      if (!benutzer) {
        const kandidaten = await prisma.benutzer.findMany();
        const gesucht = eingabe.toLowerCase();
        benutzer = kandidaten.find((b) => b.benutzername.toLowerCase() === gesucht) ?? null;
      }
      // Einheitliche Fehlermeldung – kein Hinweis, ob Benutzer existiert.
      if (!benutzer || !benutzer.aktiv || !verifyPasswort(daten.passwort, benutzer.passwortHash)) {
        return fehler("Benutzername oder Passwort ist falsch.", 401);
      }
    }

    await prisma.benutzer.update({
      where: { id: benutzer.id },
      data: { letzterLogin: new Date() },
    });

    const token = await createToken({
      sub: benutzer.id,
      name: benutzer.benutzername,
      rolle: benutzer.rolle,
    });

    const res = NextResponse.json({
      benutzer: { name: benutzer.benutzername, rolle: benutzer.rolle },
    });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions);
    return res;
  } catch (e) {
    return handleError(e);
  }
}
