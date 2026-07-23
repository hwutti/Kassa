import { formatCent } from "@/lib/money";

export type BonDaten = {
  titel: string;
  untertitel?: string | null;
  logoUrl?: string | null;
  nummer: number;
  datum: string;
  verkaeufer?: string | null;
  tisch?: string | null;
  positionen: { produktName: string; menge: number; einzelpreisCent: number; summeCent: number }[];
  summeCent: number;
  art: string;
  gegebenCent: number | null;
  rueckgeldCent: number | null;
};

const ART_LABEL: Record<string, string> = { BAR: "Bar", KARTE: "Karte", GUTSCHEIN: "Gutschein" };

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

/**
 * Druckt einen Kassenbon über ein verstecktes iframe. Bewusst druckerunabhängig:
 * es wird der vom Gerät/Browser gewählte Drucker genutzt (Thermo-Bon 80 mm,
 * normaler Drucker oder „Als PDF speichern"). Wartet vor dem Druck auf das Laden
 * des Logos, damit der Beleg vollständig ist.
 */
/** Baut das druckfertige 80-mm-Beleg-HTML (auch für die In-App-Vorschau nutzbar). */
export function bonHtml(d: BonDaten): string {
  const zeilen = d.positionen
    .map((p) => {
      const proStk = p.menge > 1 ? `<div class="ep">à ${formatCent(p.einzelpreisCent)}</div>` : "";
      return `<tr><td class="q">${p.menge}×</td><td class="n">${escape(p.produktName)}${proStk}</td><td class="r">${formatCent(p.summeCent)}</td></tr>`;
    })
    .join("");

  const geld =
    d.art === "BAR" && d.gegebenCent !== null
      ? `<div class="row"><span>Gegeben</span><span>${formatCent(d.gegebenCent)}</span></div>` +
        (d.rueckgeldCent !== null
          ? `<div class="row rueck"><span>Rückgeld</span><span>${formatCent(d.rueckgeldCent)}</span></div>`
          : "")
      : "";

  const logo = d.logoUrl ? `<div class="logo"><img src="${escape(d.logoUrl)}" alt=""></div>` : "";
  const untertitel = d.untertitel ? `<div class="sub">${escape(d.untertitel)}</div>` : "";
  const infoZeilen = [
    d.tisch ? `Tisch/Nr. ${escape(d.tisch)}` : "",
    d.verkaeufer ? `Bedienung: ${escape(d.verkaeufer)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const fuss = d.untertitel ? `<div class="small">${escape(d.untertitel)}</div>` : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Beleg ${d.nummer}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 12px; color: #111; margin: 0; width: 74mm; }
  .logo { text-align: center; margin-bottom: 2mm; }
  .logo img { max-height: 14mm; max-width: 48mm; object-fit: contain; }
  h1 { font-size: 17px; text-align: center; margin: 0; font-weight: 800; letter-spacing: .2px; }
  .sub { text-align: center; font-size: 11px; color: #333; margin-top: 1mm; }
  .meta { text-align: center; font-size: 10px; color: #444; margin-top: 2mm; line-height: 1.55; }
  .rule { border: 0; border-top: 1px solid #000; margin: 2.5mm 0; }
  .rule.dash { border-top: 1px dashed #000; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1mm 0; font-size: 12.5px; }
  td.q { white-space: nowrap; padding-right: 2mm; font-weight: 700; }
  td.n { width: 100%; }
  td.n .ep { font-size: 9px; color: #777; }
  td.r { text-align: right; white-space: nowrap; }
  .sumbox { margin-top: 1mm; padding-top: 1.5mm; border-top: 2px solid #000; }
  .row { display: flex; justify-content: space-between; padding: .4mm 0; font-size: 12px; }
  .row.sum { font-weight: 800; font-size: 16px; }
  .pay { margin-top: 1.5mm; color: #222; }
  .row.rueck { font-weight: 800; font-size: 13px; }
  .foot { text-align: center; margin-top: 5mm; }
  .foot .thanks { font-weight: 700; font-size: 12px; }
  .foot .small { color: #666; font-size: 9px; margin-top: 1mm; }
</style></head><body>
  ${logo}
  <h1>${escape(d.titel)}</h1>
  ${untertitel}
  <div class="meta">${escape(d.datum)}<br>Beleg-Nr. ${d.nummer}${infoZeilen ? "<br>" + infoZeilen : ""}</div>
  <hr class="rule">
  <table>${zeilen}</table>
  <div class="sumbox">
    <div class="row sum"><span>Summe</span><span>${formatCent(d.summeCent)}</span></div>
    <div class="pay">
      <div class="row"><span>Zahlung</span><span>${ART_LABEL[d.art] ?? d.art}</span></div>
      ${geld}
    </div>
  </div>
  <hr class="rule dash">
  <div class="foot"><div class="thanks">Vielen Dank für Ihren Besuch!</div>${fuss}</div>
</body></html>`;
  return html;
}

/** Druckt den Beleg über ein verstecktes iframe (öffnet den System-Druckdialog). */
export function druckeBon(d: BonDaten): void {
  const html = bonHtml(d);

  // Robustes Drucken: der Druck wird vom Eltern-Fenster über das onload-Event
  // ausgelöst – NICHT über ein Inline-Skript im iframe. So funktioniert der
  // Beleg auch dann, wenn die App als installierte PWA läuft oder der Browser
  // Skripte in dynamisch erzeugten iframes blockiert. srcdoc statt document.write,
  // damit der Inhalt zuverlässig geparst und geladen wird.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Ausgeblendet, aber mit echter Größe und nur aus dem Sichtfeld geschoben –
  // ein 0×0- oder display:none-iframe wird von manchen Browsern leer gedruckt.
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:80mm;height:auto;border:0;";
  iframe.srcdoc = html;

  let entfernt = false;
  const aufraeumen = () => {
    if (entfernt) return;
    entfernt = true;
    setTimeout(() => iframe.remove(), 800);
  };

  iframe.addEventListener("load", () => {
    const win = iframe.contentWindow;
    if (!win) {
      aufraeumen();
      return;
    }
    win.onafterprint = aufraeumen;
    const drucken = () => {
      try {
        win.focus();
        win.print();
      } catch {
        aufraeumen();
      }
    };
    // Vor dem Druck auf das Laden der Bilder (Logo) warten – sonst fehlt es.
    const bilder = Array.from(win.document.images ?? []);
    const offen = bilder.filter((b) => !b.complete);
    if (offen.length === 0) {
      setTimeout(drucken, 60);
    } else {
      let rest = offen.length;
      const eins = () => {
        if (--rest <= 0) drucken();
      };
      offen.forEach((b) => {
        b.addEventListener("load", eins);
        b.addEventListener("error", eins);
      });
      setTimeout(drucken, 1500); // Fallback, falls ein Bild hängt
    }
  });

  document.body.appendChild(iframe);
  // Sicherheitsnetz: iframe spätestens nach 20 s entfernen.
  setTimeout(aufraeumen, 20000);
}
