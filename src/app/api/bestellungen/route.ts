import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fehler, handleError } from "@/lib/api";
import { sichtbarkeitWhere } from "@/lib/sichtbarkeit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PositionSchema = z.object({
  produktId: z.string().min(1),
  menge: z.number().int().positive().max(999),
  // Preis-Snapshot, den der Client beim Hinzufügen erfasst hat (laufende Bestellung behält Preis).
  einzelpreisCent: z.number().int().min(0),
});

const BestellungSchema = z.object({
  // Idempotenzschlüssel des Clients – identische Wiederholung liefert dieselbe Bestellung.
  clientRef: z.string().min(8).max(64),
  verkaufsbereichId: z.string().min(1),
  positionen: z.array(PositionSchema).min(1).max(200),
  erhaltenCent: z.number().int().min(0).nullable().optional(),
});

/**
 * POST /api/bestellungen
 * Speichert eine Bestellung transaktionssicher. Erst nach erfolgreichem Commit
 * gilt die Bestellung als abgeschlossen (der Client zeigt vorher keinen Erfolg an).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const daten = BestellungSchema.parse(body);

    // 1) Idempotenz: existiert bereits eine Bestellung mit diesem clientRef, gib sie zurück.
    const bereitsVorhanden = await prisma.bestellung.findUnique({
      where: { clientRef: daten.clientRef },
      include: { positionen: true },
    });
    if (bereitsVorhanden) {
      return ok({ bestellung: serialize(bereitsVorhanden), doppelt: true });
    }

    // 2) Verkaufsbereich muss aktiv sein.
    const bereich = await prisma.verkaufsbereich.findFirst({
      where: { id: daten.verkaufsbereichId, aktiv: true },
      select: { id: true, istAllgemein: true },
    });
    if (!bereich) {
      return fehler("Verkaufsbereich nicht verfügbar – Bestellung nicht gespeichert.", 409);
    }

    // 3) Jedes Produkt erneut gegen die Sichtbarkeitsregel prüfen (Server ist die Wahrheit).
    //    Ein zwischenzeitlich deaktiviertes / preisloses Produkt darf nicht verkauft werden.
    const positionenAufbereitet: {
      produktId: string;
      produktName: string;
      kategorieName: string;
      einzelpreisCent: number;
      menge: number;
      summeCent: number;
    }[] = [];
    const ungueltig: string[] = [];

    for (const pos of daten.positionen) {
      const produkt = await prisma.produkt.findFirst({
        where: { AND: [{ id: pos.produktId }, sichtbarkeitWhere(bereich)] },
        select: { id: true, name: true, preisCent: true, kategorie: { select: { name: true } } },
      });
      if (!produkt) {
        ungueltig.push(pos.produktId);
        continue;
      }
      // Laufende Bestellung behält den erfassten Preis-Snapshot.
      const einzelpreisCent = pos.einzelpreisCent;
      positionenAufbereitet.push({
        produktId: produkt.id,
        produktName: produkt.name,
        kategorieName: produkt.kategorie.name,
        einzelpreisCent,
        menge: pos.menge,
        summeCent: einzelpreisCent * pos.menge,
      });
    }

    if (ungueltig.length > 0) {
      return fehler(
        "Mindestens ein Produkt ist nicht mehr verkäuflich (deaktiviert oder ohne Preis). Bitte Bestellung prüfen.",
        409,
        { ungueltig },
      );
    }

    const summeCent = positionenAufbereitet.reduce((s, p) => s + p.summeCent, 0);
    const erhaltenCent = daten.erhaltenCent ?? null;
    const rueckgeldCent =
      erhaltenCent !== null && erhaltenCent >= summeCent ? erhaltenCent - summeCent : null;

    // 4) Transaktion: Bestellnummer hochzählen + Bestellung + Positionen atomar anlegen.
    try {
      const erstellt = await prisma.$transaction(async (tx) => {
        const zaehler = await tx.zaehler.update({
          where: { id: "bestellnummer" },
          data: { wert: { increment: 1 } },
        });
        return tx.bestellung.create({
          data: {
            nummer: zaehler.wert,
            clientRef: daten.clientRef,
            verkaufsbereichId: daten.verkaufsbereichId,
            summeCent,
            erhaltenCent,
            rueckgeldCent,
            positionen: { create: positionenAufbereitet },
          },
          include: { positionen: true },
        });
      });
      return ok({ bestellung: serialize(erstellt), doppelt: false }, { status: 201 });
    } catch (e) {
      // Race: zwei parallele identische Requests -> zweiter verletzt unique(clientRef).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const vorhanden = await prisma.bestellung.findUnique({
          where: { clientRef: daten.clientRef },
          include: { positionen: true },
        });
        if (vorhanden) return ok({ bestellung: serialize(vorhanden), doppelt: true });
      }
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}

// Hinweis: Das Auflisten von Bestellungen erfolgt geschützt über /api/admin/bestellungen.

type BestellungMitPositionen = Prisma.BestellungGetPayload<{ include: { positionen: true } }>;

function serialize(b: BestellungMitPositionen) {
  return {
    id: b.id,
    nummer: b.nummer,
    status: b.status,
    summeCent: b.summeCent,
    erhaltenCent: b.erhaltenCent,
    rueckgeldCent: b.rueckgeldCent,
    createdAt: b.createdAt.toISOString(),
    positionen: b.positionen.map((p) => ({
      id: p.id,
      produktName: p.produktName,
      einzelpreisCent: p.einzelpreisCent,
      menge: p.menge,
      summeCent: p.summeCent,
    })),
  };
}
