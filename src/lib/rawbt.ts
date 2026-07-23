import { formatCent } from "@/lib/money";
import type { BonDaten } from "@/lib/bon";

const ART_LABEL: Record<string, string> = { BAR: "Bar", KARTE: "Karte", GUTSCHEIN: "Gutschein" };

/** Einfacher Text-Beleg für RawBT (Thermodrucker; Codepage/Breite stellt RawBT ein). */
function textBon(d: BonDaten): string {
  const trenner = "--------------------------------";
  const L: string[] = [];
  L.push(d.titel);
  if (d.untertitel) L.push(d.untertitel);
  L.push("");
  L.push(d.datum);
  L.push(`Beleg-Nr. ${d.nummer}`);
  const info = [d.tisch ? `Tisch/Nr. ${d.tisch}` : "", d.verkaeufer ? `Bed.: ${d.verkaeufer}` : ""].filter(Boolean).join("  ");
  if (info) L.push(info);
  L.push(trenner);
  for (const p of d.positionen) {
    L.push(`${p.menge}x ${p.produktName}`);
    const proStk = p.menge > 1 ? `a ${formatCent(p.einzelpreisCent)}  ` : "";
    L.push(`   ${proStk}${formatCent(p.summeCent)}`);
  }
  L.push(trenner);
  L.push(`Summe: ${formatCent(d.summeCent)}`);
  L.push(`Zahlung: ${ART_LABEL[d.art] ?? d.art}`);
  if (d.art === "BAR" && d.gegebenCent !== null && d.gegebenCent !== undefined) {
    L.push(`Gegeben: ${formatCent(d.gegebenCent)}`);
    if (d.rueckgeldCent !== null && d.rueckgeldCent !== undefined) L.push(`Rueckgeld: ${formatCent(d.rueckgeldCent)}`);
  }
  L.push("");
  L.push("Vielen Dank!");
  L.push("\n\n");
  return L.join("\n");
}

/**
 * Direktdruck via RawBT (Android): sendet den Beleg-Text über das rawbt:-URI-Schema
 * an die RawBT-App, die ihn ohne Browser-Druckdialog auf den gekoppelten
 * Bluetooth-Thermodrucker druckt. Voraussetzung: RawBT-App installiert.
 */
export function druckeRawbt(d: BonDaten): void {
  const text = textBon(d);
  window.location.href = "rawbt:" + encodeURIComponent(text);
}
