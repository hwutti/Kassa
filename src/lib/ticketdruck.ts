import { prisma } from "@/lib/prisma";
import { ticketEscPos } from "@/lib/escpos";
import { sendeAnDrucker } from "@/lib/netprint";

/**
 * Druckt beim Absenden für jeden beteiligten Arbeitsbereich ein Küchen-/Ausgabeticket
 * auf dessen Netzwerkdrucker (falls konfiguriert). Best-effort: ein nicht erreichbarer
 * Drucker darf die Bestellung niemals blockieren – Fehler werden geschluckt.
 */
export async function druckeKuechentickets(bestellungId: string): Promise<void> {
  try {
    const best = await prisma.bestellung.findUnique({
      where: { id: bestellungId },
      select: {
        nummer: true,
        tisch: true,
        gast: true,
        positionen: { select: { menge: true, produktName: true, notiz: true, arbeitsbereich: true, arbeitsbereichId: true } },
      },
    });
    if (!best) return;

    const proArea = new Map<string, { name: string; pos: { menge: number; produktName: string; notiz: string | null }[] }>();
    for (const p of best.positionen) {
      if (!p.arbeitsbereichId) continue;
      const eintrag = proArea.get(p.arbeitsbereichId) ?? { name: p.arbeitsbereich || "", pos: [] };
      eintrag.pos.push({ menge: p.menge, produktName: p.produktName, notiz: p.notiz });
      proArea.set(p.arbeitsbereichId, eintrag);
    }
    if (proArea.size === 0) return;

    const drucker = await prisma.drucker.findMany({
      where: { aktiv: true, typ: "NETZWERK", ip: { not: null }, arbeitsbereichId: { in: [...proArea.keys()] } },
      select: { ip: true, arbeitsbereichId: true },
    });
    if (drucker.length === 0) return;

    const zeit = new Date().toLocaleString("de-AT");
    await Promise.all(
      drucker.map(async (d) => {
        const grp = d.arbeitsbereichId ? proArea.get(d.arbeitsbereichId) : null;
        if (!grp || !d.ip) return;
        const buf = ticketEscPos({
          bereich: grp.name,
          nummer: best.nummer,
          tisch: best.tisch,
          gast: best.gast,
          zeit,
          positionen: grp.pos,
        });
        try {
          await sendeAnDrucker(d.ip, buf);
        } catch {
          /* Drucker offline – Ticket wird stillschweigend übersprungen */
        }
      }),
    );
  } catch {
    /* niemals die Bestellung blockieren */
  }
}
