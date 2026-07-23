import { prisma } from "@/lib/prisma";
import { ok, handleError } from "@/lib/api";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/auswertungen?von=YYYY-MM-DD&bis=YYYY-MM-DD&verkaufsbereich=ID
 * Verkaufsübersicht (Spec §25). Stornierte Bestellungen zählen nicht zum Umsatz.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const vonStr = url.searchParams.get("von");
    const bisStr = url.searchParams.get("bis");
    const verkaufsbereichId = url.searchParams.get("verkaufsbereich");
    const veranstaltungId = url.searchParams.get("veranstaltung");

    const von = vonStr ? new Date(vonStr + "T00:00:00") : undefined;
    const bis = bisStr ? new Date(bisStr + "T23:59:59.999") : undefined;

    const zeitraum: Prisma.BestellungWhereInput = {};
    if (von || bis) {
      zeitraum.createdAt = {};
      if (von) (zeitraum.createdAt as Prisma.DateTimeFilter).gte = von;
      if (bis) (zeitraum.createdAt as Prisma.DateTimeFilter).lte = bis;
    }
    if (verkaufsbereichId) zeitraum.verkaufsbereichId = verkaufsbereichId;
    if (veranstaltungId) zeitraum.veranstaltungId = veranstaltungId;

    const abgeschlossen = await prisma.bestellung.findMany({
      // Erstattete Bestellungen zählen nicht zum Umsatz und fallen aus allen Auswertungen.
      where: { ...zeitraum, status: "ABGESCHLOSSEN", zahlungStatus: { not: "REFUNDED" } },
      include: {
        positionen: true,
        verkaufsbereich: { select: { name: true } },
        veranstaltung: { select: { name: true } },
        kellner: { select: { anzeigename: true, benutzername: true } },
      },
    });
    const anzahlStorniert = await prisma.bestellung.count({
      where: { ...zeitraum, status: "STORNIERT" },
    });
    const erstattet = await prisma.bestellung.findMany({
      where: { ...zeitraum, zahlungStatus: "REFUNDED" },
      select: { summeCent: true },
    });
    const erstattetCent = erstattet.reduce((s, b) => s + b.summeCent, 0);
    const anzahlErstattet = erstattet.length;

    const gesamtumsatzCent = abgeschlossen.reduce((s, b) => s + b.summeCent, 0);
    const anzahlBestellungen = abgeschlossen.length;
    const durchschnittCent = anzahlBestellungen > 0 ? Math.round(gesamtumsatzCent / anzahlBestellungen) : 0;

    // Tagesumsatz (heute), unabhängig vom Filter.
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const heutigeBestellungen = await prisma.bestellung.findMany({
      where: { status: "ABGESCHLOSSEN", zahlungStatus: { not: "REFUNDED" }, createdAt: { gte: heute } },
      select: { summeCent: true },
    });
    const tagesumsatzCent = heutigeBestellungen.reduce((s, b) => s + b.summeCent, 0);

    // Aggregationen
    const jeBereich = new Map<string, number>();
    const jeKategorie = new Map<string, number>();
    const jeVeranstaltung = new Map<string, number>();
    const jeProdukt = new Map<string, { umsatzCent: number; menge: number }>();
    const jeKellnerMap = new Map<string, { umsatzCent: number; anzahl: number }>();
    const jeZahlungsart = new Map<string, number>();
    const zahlungsartLabel: Record<string, string> = { BAR: "Bar", KARTE: "Karte", GUTSCHEIN: "Gutschein" };

    for (const b of abgeschlossen) {
      const vName = b.veranstaltung?.name ?? "Ohne Veranstaltung";
      jeVeranstaltung.set(vName, (jeVeranstaltung.get(vName) ?? 0) + b.summeCent);
      const zaName = zahlungsartLabel[b.zahlungsart] ?? b.zahlungsart;
      jeZahlungsart.set(zaName, (jeZahlungsart.get(zaName) ?? 0) + b.summeCent);
      const kName = b.kellner?.anzeigename ?? b.kellner?.benutzername ?? "Direktverkauf";
      const kCur = jeKellnerMap.get(kName) ?? { umsatzCent: 0, anzahl: 0 };
      kCur.umsatzCent += b.summeCent;
      kCur.anzahl += 1;
      jeKellnerMap.set(kName, kCur);
      for (const p of b.positionen) {
        jeKategorie.set(p.kategorieName || "—", (jeKategorie.get(p.kategorieName || "—") ?? 0) + p.summeCent);
        // Positionsgenau: Umsatz je Verkaufsbereich aus der Position (Fallback: Bestellbereich).
        const bName = p.verkaufsbereichName || b.verkaufsbereich.name;
        jeBereich.set(bName, (jeBereich.get(bName) ?? 0) + p.summeCent);
        const cur = jeProdukt.get(p.produktName) ?? { umsatzCent: 0, menge: 0 };
        cur.umsatzCent += p.summeCent;
        cur.menge += p.menge;
        jeProdukt.set(p.produktName, cur);
      }
    }

    // Durchschnittliche Zubereitungszeit (Ticket erstellt -> fertig).
    const fertigeTickets = await prisma.bereichsticket.findMany({
      where: { fertigAm: { not: null }, bestellung: zeitraum },
      select: { createdAt: true, fertigAm: true },
    });
    const zubereitungMs = fertigeTickets.reduce(
      (s, t) => s + (t.fertigAm!.getTime() - t.createdAt.getTime()),
      0,
    );
    const zubereitungMinDurchschnitt = fertigeTickets.length
      ? Math.round(zubereitungMs / fertigeTickets.length / 60000)
      : 0;

    const sortMap = (m: Map<string, number>) =>
      [...m.entries()].map(([name, umsatzCent]) => ({ name, umsatzCent })).sort((a, b) => b.umsatzCent - a.umsatzCent);

    return ok(
      {
        anzahlBestellungen,
        gesamtumsatzCent,
        tagesumsatzCent,
        durchschnittCent,
        anzahlStorniert,
        erstattetCent,
        anzahlErstattet,
        zubereitungMinDurchschnitt,
        jeVerkaufsbereich: sortMap(jeBereich),
        jeKategorie: sortMap(jeKategorie),
        jeVeranstaltung: sortMap(jeVeranstaltung),
        jeZahlungsart: sortMap(jeZahlungsart),
        jeKellner: [...jeKellnerMap.entries()]
          .map(([name, v]) => ({ name, umsatzCent: v.umsatzCent, anzahl: v.anzahl }))
          .sort((a, b) => b.umsatzCent - a.umsatzCent),
        jeProdukt: [...jeProdukt.entries()]
          .map(([name, v]) => ({ name, umsatzCent: v.umsatzCent, menge: v.menge }))
          .sort((a, b) => b.umsatzCent - a.umsatzCent),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
