import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { verkaufbarWhere } from "@/lib/sichtbarkeit";
import { requireRolle } from "@/lib/auth";
import { darfVerkaufen } from "@/lib/rollen";
import { auditLog } from "@/lib/bestelllogik";
import { ereignisSenden } from "@/lib/ereignisse";
import { gutscheinEinloesen, normalisiereCode } from "@/lib/gutschein";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Schema = z.object({
  clientRef: z.string().min(8).max(64),
  positionen: z.array(z.object({ produktId: z.string().min(1), menge: z.number().int().positive().max(999) })).min(1).max(200),
  gegebenCent: z.number().int().min(0).nullable().optional(),
  art: z.enum(["BAR", "KARTE", "GUTSCHEIN"]).optional(),
  gutscheinCode: z.string().trim().max(40).nullable().optional(),
});

/**
 * POST /api/kellner/direktverkauf – Tresen-/Direktverkauf in EINEM Schritt:
 * Bestellung wird sofort als bezahlt + ausgegeben + abgeschlossen angelegt,
 * ohne Küchentickets. Für Stände, an denen der Kunde direkt bestellt, bekommt
 * und zahlt. Erfordert Kassenrecht.
 */
export async function POST(req: Request) {
  try {
    const session = await requireRolle(darfVerkaufen);
    if (session instanceof Response) return session;
    // Direktverkauf nimmt Geld ein -> Kassenrecht nötig.
    const benutzer = await prisma.benutzer.findUnique({ where: { id: session.sub }, select: { darfZahlen: true } });
    const darf = ["ADMIN", "KASSA", "SUPERVISOR"].includes(session.rolle) || benutzer?.darfZahlen === true;
    if (!darf) return fehler("Keine Berechtigung zum Kassieren (Direktverkauf).", 403);

    const daten = Schema.parse(await req.json());

    const vorhanden = await prisma.bestellung.findUnique({ where: { clientRef: daten.clientRef }, include: { positionen: true } });
    if (vorhanden) return ok({ bestellung: serialize(vorhanden), doppelt: true });

    const vb =
      (await prisma.verkaufsbereich.findFirst({ where: { istAllgemein: true }, select: { id: true } })) ??
      (await prisma.verkaufsbereich.findFirst({ select: { id: true } }));
    if (!vb) return fehler("Kein Verkaufsbereich konfiguriert.", 409);

    const positionen: Prisma.BestellPositionCreateManyBestellungInput[] = [];
    const ungueltig: string[] = [];
    for (const pos of daten.positionen) {
      const produkt = await prisma.produkt.findFirst({
        where: { AND: [{ id: pos.produktId }, verkaufbarWhere()] },
        select: { id: true, name: true, preisCent: true, kategorie: { select: { name: true } } },
      });
      if (!produkt || produkt.preisCent === null) {
        ungueltig.push(pos.produktId);
        continue;
      }
      positionen.push({
        produktId: produkt.id,
        produktName: produkt.name,
        kategorieName: produkt.kategorie.name,
        verkaufsbereichName: "",
        arbeitsbereich: "",
        arbeitsbereichId: null,
        notiz: null,
        status: "DELIVERED",
        einzelpreisCent: produkt.preisCent,
        menge: pos.menge,
        summeCent: produkt.preisCent * pos.menge,
      });
    }
    if (ungueltig.length > 0) {
      return fehler("Mindestens ein Produkt ist nicht mehr verkäuflich (deaktiviert oder ohne Preis).", 409, { ungueltig });
    }

    const summeCent = positionen.reduce((s, p) => s + p.summeCent, 0);
    const art = daten.art ?? "BAR";
    if (art === "BAR" && daten.gegebenCent != null && daten.gegebenCent < summeCent) {
      return fehler(`Betrag zu niedrig – es fehlen ${((summeCent - daten.gegebenCent) / 100).toFixed(2)} €.`, 400);
    }
    const erhaltenCent = art === "BAR" ? (daten.gegebenCent ?? null) : summeCent;
    const rueckgeldCent =
      art === "BAR" && daten.gegebenCent != null && daten.gegebenCent >= summeCent ? daten.gegebenCent - summeCent : null;

    const aktiveVeranstaltung = await prisma.veranstaltung.findFirst({ where: { aktiv: true }, select: { id: true } });

    try {
      const erstellt = await prisma.$transaction(async (tx) => {
        const z2 = await tx.zaehler.update({ where: { id: "bestellnummer" }, data: { wert: { increment: 1 } } });
        const best = await tx.bestellung.create({
          data: {
            nummer: z2.wert,
            clientRef: daten.clientRef,
            status: "ABGESCHLOSSEN",
            bestellStatus: "COMPLETED",
            zahlungStatus: "PAID",
            auslieferungStatus: "DELIVERED",
            zahlungsart: art,
            summeCent,
            erhaltenCent,
            rueckgeldCent,
            verkaufsbereichId: vb.id,
            veranstaltungId: aktiveVeranstaltung?.id ?? null,
            kellnerId: session.sub,
            abgesendetAm: new Date(),
            abgeschlossenAm: new Date(),
            positionen: { create: positionen },
          },
          include: { positionen: true },
        });
        await tx.zahlung.create({
          data: {
            bestellungId: best.id,
            art,
            betragCent: summeCent,
            gegebenCent: erhaltenCent,
            rueckgeldCent,
            status: "PAID",
            benutzerId: session.sub,
          },
        });
        // Gutschein einlösen, falls Code angegeben.
        if (art === "GUTSCHEIN" && daten.gutscheinCode) {
          const gs = await tx.gutschein.findUnique({ where: { code: normalisiereCode(daten.gutscheinCode) } });
          if (!gs) throw new Error("GS_404");
          const r = gutscheinEinloesen(gs, summeCent);
          if (!r.ok) throw new Error("GS:" + r.grund);
          await tx.gutschein.update({ where: { id: gs.id }, data: { restCent: r.neuerRest } });
        }
        return best;
      });
      await auditLog({ bestellungId: erstellt.id, benutzerId: session.sub, benutzerName: session.name, typ: "DIREKTVERKAUF", neuerWert: `Nr. ${erstellt.nummer}` });
      ereignisSenden("direktverkauf");
      return ok({ bestellung: serialize(erstellt), doppelt: false }, { status: 201 });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "GS_404") return fehler("Gutschein nicht gefunden.", 404);
        if (e.message.startsWith("GS:")) return fehler(e.message.slice(3), 400);
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const b = await prisma.bestellung.findUnique({ where: { clientRef: daten.clientRef }, include: { positionen: true } });
        if (b) return ok({ bestellung: serialize(b), doppelt: true });
      }
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}

type BestellungMitPositionen = Prisma.BestellungGetPayload<{ include: { positionen: true } }>;
function serialize(b: BestellungMitPositionen) {
  return {
    id: b.id,
    nummer: b.nummer,
    summeCent: b.summeCent,
    erhaltenCent: b.erhaltenCent,
    rueckgeldCent: b.rueckgeldCent,
    zahlungsart: b.zahlungsart,
    positionen: b.positionen.map((p) => ({
      produktName: p.produktName,
      menge: p.menge,
      einzelpreisCent: p.einzelpreisCent,
      summeCent: p.summeCent,
    })),
  };
}
