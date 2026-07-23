import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { normalisiereCode } from "@/lib/gutschein";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/gutscheine – alle Gutscheine (neueste zuerst). */
export async function GET() {
  try {
    const gutscheine = await prisma.gutschein.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, anfangsCent: true, restCent: true, aktiv: true, notiz: true, createdAt: true },
    });
    return ok(gutscheine, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

const CreateSchema = z.object({
  code: z.string().trim().max(40).optional(),
  betragCent: z.number().int().positive().max(1_000_00),
  notiz: z.string().trim().max(200).nullable().optional(),
});

/** POST /api/admin/gutscheine – neuen Gutschein ausgeben. Code wird bei Bedarf erzeugt. */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    const daten = CreateSchema.parse(await req.json());
    const code = daten.code ? normalisiereCode(daten.code) : "GS-" + randomBytes(4).toString("hex").toUpperCase();

    const vorhanden = await prisma.gutschein.findUnique({ where: { code }, select: { id: true } });
    if (vorhanden) return fehler("Dieser Code existiert bereits.", 409);

    const gutschein = await prisma.gutschein.create({
      data: {
        code,
        anfangsCent: daten.betragCent,
        restCent: daten.betragCent,
        notiz: daten.notiz ?? null,
        erstelltVon: session?.name ?? null,
      },
    });
    return ok(gutschein, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
