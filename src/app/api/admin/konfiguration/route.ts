import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import { getEinstellung } from "@/lib/konfiguration";

export const dynamic = "force-dynamic";

/** GET /api/admin/konfiguration – aktuelle Einstellungen (geschützt via Middleware). */
export async function GET() {
  try {
    const e = await getEinstellung();
    return ok({ titel: e.titel, untertitel: e.untertitel, logoUrl: e.logoUrl });
  } catch (e) {
    return handleError(e);
  }
}

const UpdateSchema = z.object({
  titel: z.string().trim().min(1).max(100).optional(),
  untertitel: z.string().trim().max(150).nullable().optional(),
  logoUrl: z.string().trim().max(300).nullable().optional(),
});

/** PATCH /api/admin/konfiguration – Header-Logo und Titel ändern. */
export async function PATCH(req: Request) {
  try {
    await getEinstellung(); // sicherstellen, dass der Datensatz existiert
    const daten = UpdateSchema.parse(await req.json());
    const e = await prisma.einstellung.update({ where: { id: "app" }, data: daten });
    return ok({ titel: e.titel, untertitel: e.untertitel, logoUrl: e.logoUrl });
  } catch (e) {
    return handleError(e);
  }
}
