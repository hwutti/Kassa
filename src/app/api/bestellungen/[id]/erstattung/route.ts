import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/bestelllogik";
import { ereignisSenden } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";

const Schema = z.object({ grund: z.string().trim().max(300).optional() });

/**
 * POST /api/bestellungen/[id]/erstattung – erstattet eine bezahlte Bestellung
 * (volle Rückerstattung). Legt eine Gegen-Zahlung (REFUNDED) an und setzt den
 * Zahlungsstatus auf REFUNDED. Berechtigt: Admin/Supervisor oder darfStornieren.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fehler("Nicht angemeldet.", 401);
    const benutzer = await prisma.benutzer.findUnique({ where: { id: session.sub }, select: { darfStornieren: true } });
    const darf = ["ADMIN", "SUPERVISOR"].includes(session.rolle) || benutzer?.darfStornieren === true;
    if (!darf) return fehler("Keine Berechtigung für Rückerstattungen.", 403);

    const { id } = await params;
    const { grund } = Schema.parse(await req.json().catch(() => ({})));

    const b = await prisma.bestellung.findUnique({ where: { id }, select: { summeCent: true, zahlungStatus: true } });
    if (!b) return fehler("Bestellung nicht gefunden.", 404);
    if (b.zahlungStatus === "REFUNDED") return fehler("Bestellung ist bereits erstattet.", 409);
    if (b.zahlungStatus !== "PAID") return fehler("Nur bezahlte Bestellungen können erstattet werden.", 409);

    try {
      await prisma.$transaction(async (tx) => {
        const upd = await tx.bestellung.updateMany({
          where: { id, zahlungStatus: "PAID" },
          data: { zahlungStatus: "REFUNDED", version: { increment: 1 } },
        });
        if (upd.count === 0) throw new Error("KONFLIKT");
        await tx.zahlung.create({
          data: { bestellungId: id, art: "BAR", betragCent: b.summeCent, status: "REFUNDED", benutzerId: session.sub },
        });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "KONFLIKT")
        return fehler("Bestellung wurde zwischenzeitlich geändert.", 409);
      throw e;
    }

    await auditLog({
      bestellungId: id,
      benutzerId: session.sub,
      benutzerName: session.name,
      typ: "RUECKERSTATTUNG",
      neuerWert: "REFUNDED",
      grund: grund || undefined,
    });
    ereignisSenden("erstattung");
    return ok({ zahlungStatus: "REFUNDED" });
  } catch (e) {
    return handleError(e);
  }
}
