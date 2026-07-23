import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { bonEscPos, testEscPos } from "@/lib/escpos";
import { sendeAnDrucker } from "@/lib/netprint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BonSchema = z.object({
  titel: z.string(),
  untertitel: z.string().nullable().optional(),
  nummer: z.number().int(),
  datum: z.string(),
  verkaeufer: z.string().nullable().optional(),
  tisch: z.string().nullable().optional(),
  positionen: z.array(
    z.object({
      produktName: z.string(),
      menge: z.number().int(),
      einzelpreisCent: z.number().int(),
      summeCent: z.number().int(),
    }),
  ),
  summeCent: z.number().int(),
  art: z.string(),
  gegebenCent: z.number().int().nullable(),
  rueckgeldCent: z.number().int().nullable(),
});

const Schema = z.object({
  druckerId: z.string().min(1),
  test: z.boolean().optional(),
  bon: BonSchema.nullable().optional(),
});

/**
 * POST /api/print – druckt einen Beleg oder einen Testausdruck direkt auf einem
 * konfigurierten Netzwerk-Thermodrucker (ESC/POS über TCP). Nur mit Session.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fehler("Nicht angemeldet.", 401);

    const { druckerId, test, bon } = Schema.parse(await req.json());
    const drucker = await prisma.drucker.findUnique({ where: { id: druckerId } });
    if (!drucker) return fehler("Drucker nicht gefunden.", 404);
    if (drucker.typ !== "NETZWERK" || !drucker.ip)
      return fehler("Dieser Drucker ist kein Netzwerkdrucker mit IP.", 400);
    if (!drucker.aktiv) return fehler("Drucker ist deaktiviert.", 400);

    const daten = test || !bon ? testEscPos(drucker.name, new Date().toLocaleString("de-AT")) : bonEscPos({ ...bon, logoUrl: null });
    await sendeAnDrucker(drucker.ip, daten);
    return ok({ gedruckt: true, drucker: drucker.name });
  } catch (e) {
    if (e instanceof Error && /erreichbar|Zeitüberschreitung/.test(e.message)) return fehler(e.message, 502);
    return handleError(e);
  }
}
