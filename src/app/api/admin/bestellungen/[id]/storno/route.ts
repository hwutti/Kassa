import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const StornoSchema = z.object({
  grund: z.string().trim().min(1).max(300),
});

/**
 * POST /api/admin/bestellungen/[id]/storno – storniert eine abgeschlossene Bestellung.
 * Die Bestellung wird NICHT gelöscht, sondern als STORNIERT markiert (nachvollziehbar).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(); // Middleware schützt bereits; hier für storniertVon.
    const { id } = await params;
    const { grund } = StornoSchema.parse(await req.json());

    const bestellung = await prisma.bestellung.findUnique({ where: { id }, select: { status: true } });
    if (!bestellung) return fehler("Bestellung nicht gefunden.", 404);
    if (bestellung.status === "STORNIERT") {
      return fehler("Bestellung ist bereits storniert.", 409);
    }

    const aktualisiert = await prisma.bestellung.update({
      where: { id },
      data: {
        status: "STORNIERT",
        storniertAm: new Date(),
        stornoGrund: grund,
        storniertVon: session?.name ?? "unbekannt",
      },
      select: { id: true, status: true, storniertAm: true, stornoGrund: true, storniertVon: true },
    });
    return ok(aktualisiert);
  } catch (e) {
    return handleError(e);
  }
}
