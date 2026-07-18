import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import type { VerkaufsbereichDTO } from "@/lib/dto";

// Immer frisch vom Server – niemals statisch/gecached ausliefern.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/kasse/verkaufsbereiche – nur aktive Verkaufsbereiche. */
export async function GET() {
  try {
    const bereiche = await prisma.verkaufsbereich.findMany({
      where: { aktiv: true },
      orderBy: [{ sortierung: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
    const dto: VerkaufsbereichDTO[] = bereiche;
    return ok(dto, {
      headers: { "Cache-Control": "no-store, must-revalidate" },
    });
  } catch (e) {
    return handleError(e);
  }
}
