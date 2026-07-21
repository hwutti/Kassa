import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/admin/drucker – alle Drucker. */
export async function GET() {
  try {
    const drucker = await prisma.drucker.findMany({
      orderBy: [{ sortierung: "asc" }, { name: "asc" }],
      select: { id: true, name: true, typ: true, ip: true, aktiv: true, sortierung: true, arbeitsbereichId: true },
    });
    return ok(drucker, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  typ: z.enum(["SYSTEM", "NETZWERK"]).default("SYSTEM"),
  ip: z.string().trim().max(64).nullable().optional(),
  aktiv: z.boolean().optional(),
  sortierung: z.number().int().optional(),
  arbeitsbereichId: z.string().min(1).nullable().optional(),
});

/** POST /api/admin/drucker – neuen Drucker anlegen. */
export async function POST(req: Request) {
  try {
    const daten = CreateSchema.parse(await req.json());
    const drucker = await prisma.drucker.create({
      data: {
        name: daten.name,
        typ: daten.typ,
        ip: daten.typ === "NETZWERK" ? (daten.ip || null) : null,
        aktiv: daten.aktiv ?? true,
        sortierung: daten.sortierung ?? 0,
        arbeitsbereichId: daten.arbeitsbereichId || null,
      },
    });
    return ok(drucker, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
