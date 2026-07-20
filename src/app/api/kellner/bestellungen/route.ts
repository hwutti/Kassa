import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { verkaufbarWhere } from "@/lib/sichtbarkeit";
import { requireRolle } from "@/lib/auth";
import { darfKellner } from "@/lib/rollen";
import { bestellungNeuBerechnen, auditLog } from "@/lib/bestelllogik";
import { ereignisSenden } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PositionSchema = z.object({
  produktId: z.string().min(1),
  menge: z.number().int().positive().max(999),
  notiz: z.string().trim().max(200).nullable().optional(),
});
const BestellungSchema = z.object({
  clientRef: z.string().min(8).max(64),
  tisch: z.string().trim().max(60).nullable().optional(),
  gast: z.string().trim().max(80).nullable().optional(),
  abholnummer: z.string().trim().max(30).nullable().optional(),
  notiz: z.string().trim().max(300).nullable().optional(),
  positionen: z.array(PositionSchema).min(1).max(200),
});

/** POST /api/kellner/bestellungen – Bestellung aufnehmen/absenden (erzeugt Bereichstickets). */
export async function POST(req: Request) {
  try {
    const session = await requireRolle(darfKellner);
    if (session instanceof Response) return session;
    const daten = BestellungSchema.parse(await req.json());

    // Idempotenz.
    const vorhanden = await prisma.bestellung.findUnique({
      where: { clientRef: daten.clientRef },
      include: { positionen: true },
    });
    if (vorhanden) return ok({ bestellung: serialize(vorhanden), doppelt: true });

    // Verkaufsbereich-Pflichtfeld: allgemeine Kassa (oder erster Bereich) als Kontext.
    const vb =
      (await prisma.verkaufsbereich.findFirst({ where: { istAllgemein: true }, select: { id: true } })) ??
      (await prisma.verkaufsbereich.findFirst({ select: { id: true } }));
    if (!vb) return fehler("Kein Verkaufsbereich konfiguriert.", 409);

    // Positionen serverseitig validieren + Snapshots (aktueller Serverpreis).
    const positionen: Prisma.BestellPositionCreateManyBestellungInput[] = [];
    const ungueltig: string[] = [];
    const ticketAreas = new Set<string>();

    for (const pos of daten.positionen) {
      const produkt = await prisma.produkt.findFirst({
        where: { AND: [{ id: pos.produktId }, verkaufbarWhere()] },
        select: {
          id: true,
          name: true,
          preisCent: true,
          kategorie: { select: { name: true } },
          arbeitsbereiche: { select: { arbeitsbereichId: true, primaer: true, arbeitsbereich: { select: { name: true, aktiv: true } } } },
        },
      });
      if (!produkt || produkt.preisCent === null) {
        ungueltig.push(pos.produktId);
        continue;
      }
      const ab = produkt.arbeitsbereiche.find((a) => a.primaer) ?? produkt.arbeitsbereiche[0];
      const areaId = ab?.arbeitsbereich.aktiv ? ab.arbeitsbereichId : null;
      if (areaId) ticketAreas.add(areaId);
      const einzelpreisCent = produkt.preisCent;
      positionen.push({
        produktId: produkt.id,
        produktName: produkt.name,
        kategorieName: produkt.kategorie.name,
        verkaufsbereichName: "",
        arbeitsbereich: ab?.arbeitsbereich.name ?? "",
        arbeitsbereichId: areaId,
        notiz: pos.notiz ?? null,
        status: areaId ? "QUEUED" : "READY", // ohne Bereich: nichts vorzubereiten
        einzelpreisCent,
        menge: pos.menge,
        summeCent: einzelpreisCent * pos.menge,
      });
    }
    if (ungueltig.length > 0) {
      return fehler("Mindestens ein Produkt ist nicht mehr verkäuflich (deaktiviert oder ohne Preis).", 409, { ungueltig });
    }

    const summeCent = positionen.reduce((s, p) => s + p.summeCent, 0);
    const aktiveVeranstaltung = await prisma.veranstaltung.findFirst({ where: { aktiv: true }, select: { id: true } });

    try {
      const erstellt = await prisma.$transaction(async (tx) => {
        const z = await tx.zaehler.update({ where: { id: "bestellnummer" }, data: { wert: { increment: 1 } } });
        return tx.bestellung.create({
          data: {
            nummer: z.wert,
            clientRef: daten.clientRef,
            status: "OFFEN",
            bestellStatus: "SUBMITTED",
            zahlungStatus: "UNPAID",
            auslieferungStatus: "NOT_READY",
            summeCent,
            verkaufsbereichId: vb.id,
            veranstaltungId: aktiveVeranstaltung?.id ?? null,
            kellnerId: session.sub,
            tisch: daten.tisch ?? null,
            gast: daten.gast ?? null,
            abholnummer: daten.abholnummer ?? null,
            notiz: daten.notiz ?? null,
            abgesendetAm: new Date(),
            positionen: { create: positionen },
            tickets: { create: [...ticketAreas].map((arbeitsbereichId) => ({ arbeitsbereichId, status: "QUEUED" })) },
          },
          include: { positionen: true },
        });
      });
      await bestellungNeuBerechnen(erstellt.id);
      await auditLog({ bestellungId: erstellt.id, benutzerId: session.sub, benutzerName: session.name, typ: "BESTELLUNG_ABGESENDET", neuerWert: `Nr. ${erstellt.nummer}` });
      ereignisSenden("bestellung-neu");
      return ok({ bestellung: serialize(erstellt), doppelt: false }, { status: 201 });
    } catch (e) {
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

/** GET /api/kellner/bestellungen – eigene, noch nicht abgeschlossene Bestellungen mit Fortschritt. */
export async function GET() {
  try {
    const session = await requireRolle(darfKellner);
    if (session instanceof Response) return session;

    const nurEigene = session.rolle === "KELLNER" ? session.sub : undefined;
    const bestellungen = await prisma.bestellung.findMany({
      where: {
        kellnerId: nurEigene,
        bestellStatus: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        positionen: { select: { produktName: true, menge: true, status: true } },
        tickets: { include: { arbeitsbereich: { select: { name: true } } } },
      },
    });

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const erledigtHeute = await prisma.bestellung.count({
      where: { kellnerId: nurEigene, bestellStatus: "COMPLETED", abgeschlossenAm: { gte: heute } },
    });

    return ok(
      {
        erledigtHeute,
        bestellungen: bestellungen.map((b) => ({
          id: b.id,
          nummer: b.nummer,
          tisch: b.tisch,
          gast: b.gast,
          abholnummer: b.abholnummer,
          summeCent: b.summeCent,
          bestellStatus: b.bestellStatus,
          zahlungStatus: b.zahlungStatus,
          auslieferungStatus: b.auslieferungStatus,
          createdAt: b.createdAt.toISOString(),
          positionen: b.positionen,
          bereiche: b.tickets.map((t) => ({ name: t.arbeitsbereich.name, status: t.status })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}

type BestellungMitPositionen = Prisma.BestellungGetPayload<{ include: { positionen: true } }>;
function serialize(b: BestellungMitPositionen) {
  return {
    id: b.id,
    nummer: b.nummer,
    tisch: b.tisch,
    summeCent: b.summeCent,
    bestellStatus: b.bestellStatus,
    positionen: b.positionen.map((p) => ({ produktName: p.produktName, menge: p.menge, summeCent: p.summeCent })),
  };
}
