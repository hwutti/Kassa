// ESC/POS-Befehle für Thermodrucker (80 mm, Font A). Reine Byte-Erzeugung,
// unabhängig vom Transport – dadurch gut testbar. Beträge ohne €-Symbol
// (Thermodrucker-Zeichensatz), Umlaute über Codepage Windows-1252.
import type { BonDaten } from "@/lib/bon";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
export const WIDTH = 48; // Zeichen pro Zeile bei 80 mm / Font A

const ART_LABEL: Record<string, string> = { BAR: "Bar", KARTE: "Karte", GUTSCHEIN: "Gutschein" };

/** Text → Bytes (Windows-1252). €/geschützte Leerzeichen werden ersetzt. */
function txt(s: string): Buffer {
  const clean = s.replace(/€/g, "EUR").replace(/ /g, " ");
  return Buffer.from(clean, "latin1");
}
/** Cent → "12,50" (ohne Währungszeichen). */
export function eur(cent: number): string {
  return (cent / 100).toFixed(2).replace(".", ",");
}
/** Zwei Spalten auf WIDTH auffüllen; linker Text wird bei Bedarf gekürzt. */
export function zeile(links: string, rechts: string, width = WIDTH): string {
  const maxLinks = width - rechts.length - 1;
  let l = links;
  if (l.length > maxLinks) l = l.slice(0, Math.max(0, maxLinks - 1)) + "…";
  const pad = Math.max(1, width - l.length - rechts.length);
  return l + " ".repeat(pad) + rechts;
}

function baue(zeilen: (b: Buffer[]) => void): Buffer {
  const b: Buffer[] = [];
  zeilen(b);
  return Buffer.concat(b);
}

/** Kompletter Kassenbon als ESC/POS-Bytefolge (inkl. Schnitt). */
export function bonEscPos(d: BonDaten): Buffer {
  return baue((b) => {
    const raw = (...bytes: number[]) => b.push(Buffer.from(bytes));
    const line = (s = "") => {
      b.push(txt(s));
      raw(LF);
    };
    raw(ESC, 0x40); // initialisieren
    raw(ESC, 0x74, 0x10); // Codepage Windows-1252 (Umlaute)
    raw(ESC, 0x61, 0x01); // zentriert
    raw(ESC, 0x45, 0x01); // fett an
    raw(GS, 0x21, 0x11); // doppelte Breite+Höhe
    line(d.titel);
    raw(GS, 0x21, 0x00); // normale Größe
    raw(ESC, 0x45, 0x00); // fett aus
    if (d.untertitel) line(d.untertitel);
    line(d.datum);
    line("Beleg-Nr. " + d.nummer);
    const info = [d.tisch ? "Tisch/Nr. " + d.tisch : "", d.verkaeufer ? "Bedienung: " + d.verkaeufer : ""]
      .filter(Boolean)
      .join("  ");
    if (info) line(info);
    raw(ESC, 0x61, 0x00); // links
    line("-".repeat(WIDTH));
    for (const p of d.positionen) {
      line(zeile(`${p.menge}x ${p.produktName}`, eur(p.summeCent)));
      if (p.menge > 1) line("   a " + eur(p.einzelpreisCent));
    }
    line("-".repeat(WIDTH));
    raw(ESC, 0x45, 0x01);
    raw(GS, 0x21, 0x01); // doppelte Höhe
    line(zeile("SUMME", eur(d.summeCent) + " EUR"));
    raw(GS, 0x21, 0x00);
    raw(ESC, 0x45, 0x00);
    line("Zahlung: " + (ART_LABEL[d.art] ?? d.art));
    if (d.art === "BAR" && d.gegebenCent !== null) {
      line(zeile("Gegeben", eur(d.gegebenCent)));
      if (d.rueckgeldCent !== null) line(zeile("Rückgeld", eur(d.rueckgeldCent)));
    }
    raw(LF);
    raw(ESC, 0x61, 0x01);
    line("Vielen Dank für Ihren Besuch!");
    raw(LF, LF, LF);
    raw(GS, 0x56, 0x42, 0x00); // Teilschnitt mit Vorschub
  });
}

/** Küchen-/Ausgabeticket für einen Arbeitsbereich (nur die eigenen Positionen). */
export function ticketEscPos(opts: {
  bereich: string;
  nummer: number;
  tisch?: string | null;
  gast?: string | null;
  zeit: string;
  positionen: { menge: number; produktName: string; notiz?: string | null }[];
}): Buffer {
  return baue((b) => {
    const raw = (...bytes: number[]) => b.push(Buffer.from(bytes));
    const line = (s = "") => {
      b.push(txt(s));
      raw(LF);
    };
    raw(ESC, 0x40);
    raw(ESC, 0x74, 0x10);
    raw(ESC, 0x61, 0x01);
    raw(ESC, 0x45, 0x01);
    raw(GS, 0x21, 0x11);
    line(opts.bereich);
    raw(GS, 0x21, 0x00);
    raw(GS, 0x21, 0x01);
    line("Nr. " + opts.nummer + (opts.tisch ? " · Tisch " + opts.tisch : ""));
    raw(GS, 0x21, 0x00);
    raw(ESC, 0x45, 0x00);
    if (opts.gast) line(opts.gast);
    line(opts.zeit);
    raw(ESC, 0x61, 0x00);
    line("-".repeat(WIDTH));
    raw(GS, 0x21, 0x01); // doppelte Höhe – am Stand gut lesbar
    for (const p of opts.positionen) {
      line(`${p.menge}x ${p.produktName}`);
      if (p.notiz) {
        raw(GS, 0x21, 0x00);
        line("   " + p.notiz);
        raw(GS, 0x21, 0x01);
      }
    }
    raw(GS, 0x21, 0x00);
    raw(LF, LF, LF);
    raw(GS, 0x56, 0x42, 0x00);
  });
}

/** Kurzer Testausdruck zur Drucker-Prüfung. */
export function testEscPos(druckerName: string, zeit: string): Buffer {
  return baue((b) => {
    const raw = (...bytes: number[]) => b.push(Buffer.from(bytes));
    const line = (s = "") => {
      b.push(txt(s));
      raw(LF);
    };
    raw(ESC, 0x40);
    raw(ESC, 0x74, 0x10);
    raw(ESC, 0x61, 0x01);
    raw(ESC, 0x45, 0x01);
    raw(GS, 0x21, 0x11);
    line("TESTDRUCK");
    raw(GS, 0x21, 0x00);
    raw(ESC, 0x45, 0x00);
    line(druckerName);
    line(zeit);
    line("Umlaute: äöü ÄÖÜ ß");
    line("Betrag: " + eur(1250) + " EUR");
    raw(LF, LF, LF);
    raw(GS, 0x56, 0x42, 0x00);
  });
}
