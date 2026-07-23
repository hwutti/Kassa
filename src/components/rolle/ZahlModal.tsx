"use client";

import { useState } from "react";
import { formatCent, parseEuroToCent } from "@/lib/money";
import { Geldrechner } from "@/components/kasse/Geldrechner";
import { jsonFetch } from "@/lib/client";

type Position = { produktName: string; menge: number; einzelpreisCent: number; summeCent: number };
export type Zahlungsart = "BAR" | "KARTE" | "GUTSCHEIN";

const ARTEN: { wert: Zahlungsart; label: string; icon: string }[] = [
  { wert: "BAR", label: "Bar", icon: "💶" },
  { wert: "KARTE", label: "Karte", icon: "💳" },
  { wert: "GUTSCHEIN", label: "Gutschein", icon: "🎟️" },
];

/**
 * Gemeinsames Bezahl-Modal für Verkäufer und zentrale Kassa.
 * Zahlungsart wählbar (Bar/Karte/Gutschein). Bei Bar zusätzlich Geldrechner mit
 * Rückgeld; Karte/Gutschein gelten als passend. Kassiert wird über den zentralen
 * Zahlungs-Endpunkt.
 */
export function ZahlModal({
  nummer,
  titel,
  summeCent,
  positionen,
  laedt,
  fehler,
  sumupAffiliateKey,
  onAbbrechen,
  onBezahlen,
}: {
  nummer: number;
  titel?: string;
  summeCent: number;
  positionen?: Position[];
  laedt: boolean;
  fehler: string | null;
  sumupAffiliateKey?: string | null;
  onAbbrechen: () => void;
  onBezahlen: (gegebenCent: number | null, art: Zahlungsart, gutscheinCode?: string | null) => void;
}) {
  const [art, setArt] = useState<Zahlungsart>("BAR");
  const [erhaltenText, setErhaltenText] = useState("");
  const [gutscheinCode, setGutscheinCode] = useState("");
  const [gsInfo, setGsInfo] = useState<string | null>(null);
  const erhaltenCent = parseEuroToCent(erhaltenText);
  const zuWenig = art === "BAR" && erhaltenCent !== null && erhaltenCent < summeCent;

  function bezahlen() {
    if (zuWenig || laedt) return;
    onBezahlen(
      art === "BAR" ? erhaltenCent : null,
      art,
      art === "GUTSCHEIN" ? gutscheinCode.trim() || null : null,
    );
  }

  async function gutscheinPruefen() {
    const c = gutscheinCode.trim();
    if (!c) return;
    setGsInfo("Prüfe …");
    try {
      const g = await jsonFetch<{ restCent: number; aktiv: boolean }>(`/api/gutschein/${encodeURIComponent(c)}`);
      setGsInfo(g.aktiv ? `Guthaben: ${formatCent(g.restCent)}` : "Gutschein ist deaktiviert.");
    } catch (e) {
      setGsInfo((e as Error).message);
    }
  }

  function sumupOeffnen() {
    if (!sumupAffiliateKey) return;
    const total = (summeCent / 100).toFixed(2);
    const url =
      `sumupmerchant://pay/1.0?affiliate-key=${encodeURIComponent(sumupAffiliateKey)}` +
      `&app-id=at.kirchtag.kasse&total=${total}&currency=EUR&title=${encodeURIComponent(`Bestellung Nr. ${nummer}`)}`;
    // App-Absprung zur SumUp-App; nach Abschluss am Terminal kehrt der Kassier zurück
    // und bestätigt hier mit „Bezahlt".
    window.location.href = url;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md max-h-[94dvh] flex flex-col">
        <div className="shrink-0 p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold">{titel ?? `Kassieren – Nr. ${nummer}`}</h2>
          <p className="text-sm text-neutral-400">Betrag erfassen und bestätigen.</p>
        </div>

        {positionen && positionen.length > 0 && (
          <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0 border-b border-neutral-800">
            {positionen.map((p, i) => (
              <div key={i} className="flex justify-between gap-2 tabular-nums text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{p.menge}×</span> {p.produktName}
                </span>
                <span className="shrink-0">{formatCent(p.summeCent)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="shrink-0 p-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-neutral-300">Gesamt</span>
            <span className="text-2xl font-bold tabular-nums">{formatCent(summeCent)}</span>
          </div>

          {/* Zahlungsart */}
          <div className="grid grid-cols-3 gap-2">
            {ARTEN.map((a) => (
              <button
                key={a.wert}
                type="button"
                onClick={() => setArt(a.wert)}
                className={`rounded-lg border px-2 py-2 text-sm font-medium flex items-center justify-center gap-1 ${
                  art === a.wert
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-neutral-800 border-neutral-700 text-neutral-200"
                }`}
              >
                <span>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>

          {art === "BAR" ? (
            <Geldrechner summeCent={summeCent} erhaltenText={erhaltenText} onErhaltenChange={setErhaltenText} />
          ) : art === "KARTE" ? (
            <div className="space-y-2">
              {sumupAffiliateKey ? (
                <button type="button" className="btn-ghost w-full" onClick={sumupOeffnen} disabled={laedt}>
                  💳 Mit SumUp öffnen ({formatCent(summeCent)})
                </button>
              ) : null}
              <p className="text-sm text-neutral-400">
                Kartenzahlung am Terminal durchführen, dann „Bezahlt" bestätigen.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                className="input w-full"
                placeholder="Gutschein-Code (optional)"
                value={gutscheinCode}
                onChange={(e) => {
                  setGutscheinCode(e.target.value);
                  setGsInfo(null);
                }}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" className="btn-ghost text-sm" onClick={gutscheinPruefen} disabled={!gutscheinCode.trim()}>
                  Guthaben prüfen
                </button>
                {gsInfo && <span className="text-sm text-neutral-300">{gsInfo}</span>}
              </div>
              <p className="text-xs text-neutral-400">
                Mit Code wird das Restguthaben verrechnet; ohne Code wird der Gutschein nur vermerkt.
              </p>
            </div>
          )}

          {fehler && (
            <p role="alert" className="text-sm text-red-300 bg-red-950/50 rounded-lg px-3 py-2">
              {fehler}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1" onClick={onAbbrechen} disabled={laedt}>
              Abbrechen
            </button>
            <button className="btn-primary flex-1" onClick={bezahlen} disabled={laedt || zuWenig}>
              {laedt
                ? "Speichere …"
                : art === "BAR" && erhaltenText.trim() === ""
                  ? "Bezahlen (passend)"
                  : "Bezahlen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
