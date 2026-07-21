import { formatCent } from "@/lib/money";

export type BonDaten = {
  titel: string;
  nummer: number;
  datum: string;
  positionen: { produktName: string; menge: number; einzelpreisCent: number; summeCent: number }[];
  summeCent: number;
  art: string;
  gegebenCent: number | null;
  rueckgeldCent: number | null;
};

const ART_LABEL: Record<string, string> = { BAR: "Bar", KARTE: "Karte", GUTSCHEIN: "Gutschein" };

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

/**
 * Druckt einen Kassenbon über ein verstecktes iframe. Bewusst druckerunabhängig:
 * es wird der vom Gerät/Browser gewählte Drucker genutzt (Thermo-Bon 80 mm,
 * normaler Drucker oder „Als PDF speichern"). Keine Hardware-Bindung.
 */
export function druckeBon(d: BonDaten): void {
  const zeilen = d.positionen
    .map(
      (p) =>
        `<tr><td>${p.menge}×</td><td class="n">${escape(p.produktName)}</td><td class="r">${formatCent(p.summeCent)}</td></tr>`,
    )
    .join("");

  const geld =
    d.art === "BAR" && d.gegebenCent !== null
      ? `<div class="row"><span>Gegeben</span><span>${formatCent(d.gegebenCent)}</span></div>` +
        (d.rueckgeldCent !== null ? `<div class="row"><span>Rückgeld</span><span>${formatCent(d.rueckgeldCent)}</span></div>` : "")
      : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bon ${d.nummer}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font-family: "Courier New", monospace; font-size: 12px; color: #000; margin: 0; width: 74mm; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2mm; }
  .meta { text-align: center; font-size: 11px; margin-bottom: 3mm; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 0.4mm 0; }
  td.n { width: 100%; padding-left: 2mm; }
  td.r { text-align: right; white-space: nowrap; }
  .line { border-top: 1px dashed #000; margin: 2mm 0; }
  .row { display: flex; justify-content: space-between; }
  .sum { font-weight: bold; font-size: 14px; }
  .foot { text-align: center; margin-top: 4mm; }
</style></head><body>
  <h1>${escape(d.titel)}</h1>
  <div class="meta">${escape(d.datum)}<br>Beleg-Nr. ${d.nummer}</div>
  <table>${zeilen}</table>
  <div class="line"></div>
  <div class="row sum"><span>Summe</span><span>${formatCent(d.summeCent)}</span></div>
  <div class="row"><span>Zahlung</span><span>${ART_LABEL[d.art] ?? d.art}</span></div>
  ${geld}
  <div class="foot">Vielen Dank!</div>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const fenster = iframe.contentWindow;
  if (!fenster) {
    iframe.remove();
    return;
  }
  // Nach dem Druck (oder Abbruch) das iframe wieder entfernen.
  const aufraeumen = () => setTimeout(() => iframe.remove(), 1000);
  fenster.onafterprint = aufraeumen;
  fenster.focus();
  // kurze Verzögerung, damit der Inhalt sicher gerendert ist
  setTimeout(() => {
    try {
      fenster.print();
    } finally {
      aufraeumen();
    }
  }, 150);
}
