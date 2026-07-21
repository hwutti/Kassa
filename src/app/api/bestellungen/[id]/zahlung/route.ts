import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { bestellungNeuBerechnen, auditLog } from "@/lib/bestelllogik";
import { ereignisSenden } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";

const Schema = z.object({
  gegebenCent: z.number().int().min(0).nullable().optional(),
  art: z.enum(["BAR", "KARTE", "GUTSCHEIN"]).optional(),
});

/** POST /api/bestellungen/[id]/zahlung – Barzahlung erfassen (getrennt von Auslieferung). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fehler("Nicht angemeldet.", 401);
    // Berechtigt: Kasse/Admin/Supervisor immer, Kellner nur mit Recht darfZahlen.
    const benutzer = await prisma.benutzer.findUnique({ where: { id: session.sub }, select: { darfZahlen: true } });
    const darf = ["ADMIN", "KASSA", "SUPERVISOR"].includes(session.rolle) || benutzer?.darfZahlen === true;
    if (!darf) return fehler("Keine Berechtigung, Zahlungen zu erfassen.", 403);

    const { id } = await params;
    const { gegebenCent, art = "BAR" } = Schema.parse(await req.json());

    const b = await prisma.bestellung.findUnique({
      where: { id },
      select: { summeCent: true, zahlungStatus: true, status: true },
    });
    if (!b) return fehler("Bestellung nicht gefunden.", 404);
    if (b.status === "STORNIERT") return fehler("Stornierte Bestellung kann nicht bezahlt werden.", 409);
    if (b.zahlungStatus === "PAID") return fehler("Bestellung ist bereits bezahlt.", 409);
    // Rückgeld nur bei Barzahlung. Karte/Gutschein gelten als passend (kein Wechselgeld).
    if (art === "BAR" && gegebenCent !== null && gegebenCent !== undefined && gegebenCent < b.summeCent) {
      return fehler(`Betrag zu niedrig – es fehlen ${((b.summeCent - gegebenCent) / 100).toFixed(2)} €.`, 400);
    }

    const erhaltenCent = art === "BAR" ? (gegebenCent ?? null) : b.summeCent;
    const rueckgeldCent =
      art === "BAR" && gegebenCent !== null && gegebenCent !== undefined && gegebenCent >= b.summeCent
        ? gegebenCent - b.summeCent
        : null;

    await prisma.$transaction([
      prisma.zahlung.create({
        data: {
          bestellungId: id,
          art,
          betragCent: b.summeCent,
          gegebenCent: erhaltenCent,
          rueckgeldCent,
          status: "PAID",
          benutzerId: session.sub,
        },
      }),
      prisma.bestellung.update({
        where: { id },
        data: { zahlungStatus: "PAID", zahlungsart: art, erhaltenCent, rueckgeldCent },
      }),
    ]);

    const neu = await bestellungNeuBerechnen(id);
    await auditLog({ bestellungId: id, benutzerId: session.sub, benutzerName: session.name, typ: "ZAHLUNG_ERFASST", neuerWert: `PAID (${art})` });
    ereignisSenden("zahlung");
    return ok({ zahlungStatus: "PAID", art, rueckgeldCent, bestellStatus: neu?.bestellStatus });
  } catch (e) {
    return handleError(e);
  }
}
