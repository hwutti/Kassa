import { ok, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/auth/me – aktuelle Rolle/Name der angemeldeten Person (oder null). */
export async function GET() {
  try {
    const s = await getSession();
    return ok({ rolle: s?.rolle ?? null, name: s?.name ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
