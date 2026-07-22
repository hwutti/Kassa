"use client";

import { formatCent } from "@/lib/money";

const ART_LABEL: Record<string, string> = { BAR: "Bar", KARTE: "Karte", GUTSCHEIN: "Gutschein" };

/**
 * Vorläufige Rechnung nach „Bezahlen" – NOCH NICHT gebucht. Zeigt die komplette
 * Rechnung zur Kontrolle. Erst „Bon drucken" / „Fertig" bucht den Verkauf;
 * „Korrigieren" verwirft sie und geht zurück in den Warenkorb (keine DB-Spur).
 */
export type Beleg = {
  positionen: { produktName: string; menge: number; einzelpreisCent: number; summeCent: number }[];
  summeCent: number;
  art: string;
  gegebenCent: number | null;
  rueckgeldCent: number | null;
};

export function BelegUebersicht({
  beleg,
  laedt,
  fehler,
  onKorrigieren,
  onFertig,
  onDrucken,
}: {
  beleg: Beleg;
  laedt: boolean;
  fehler: string | null;
  onKorrigieren: () => void;
  onFertig: () => void;
  onDrucken: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-sm max-h-[94dvh] flex flex-col">
        <div className="shrink-0 p-4 border-b border-neutral-800 text-center">
          <h2 className="text-lg font-semibold">Rechnung prüfen</h2>
          <p className="text-sm text-neutral-400">Noch nicht gebucht – bitte kontrollieren.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
          {beleg.positionen.map((p, i) => (
            <div key={i} className="flex justify-between gap-2 tabular-nums text-sm">
              <span className="min-w-0">
                <span className="font-medium">{p.menge}×</span> {p.produktName}
                {p.menge > 1 && <span className="text-neutral-500"> · à {formatCent(p.einzelpreisCent)}</span>}
              </span>
              <span className="shrink-0">{formatCent(p.summeCent)}</span>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-neutral-800 p-4 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="font-semibold">Summe</span>
            <span className="text-xl font-bold tabular-nums">{formatCent(beleg.summeCent)}</span>
          </div>
          <div className="flex justify-between text-sm text-neutral-400 tabular-nums">
            <span>Zahlung</span>
            <span>{ART_LABEL[beleg.art] ?? beleg.art}</span>
          </div>
          {beleg.gegebenCent !== null && (
            <div className="flex justify-between text-sm text-neutral-400 tabular-nums">
              <span>Gegeben</span>
              <span>{formatCent(beleg.gegebenCent)}</span>
            </div>
          )}
          {beleg.rueckgeldCent !== null && (
            <div className="flex justify-between text-base font-bold tabular-nums">
              <span>Rückgeld</span>
              <span>{formatCent(beleg.rueckgeldCent)}</span>
            </div>
          )}

          {fehler && (
            <p role="alert" className="text-sm text-red-300 bg-red-950/50 rounded-lg px-3 py-2">
              {fehler}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1" onClick={onKorrigieren} disabled={laedt}>
              Korrigieren
            </button>
            <button className="btn-ghost flex-1" onClick={onFertig} disabled={laedt}>
              {laedt ? "Speichere …" : "Fertig"}
            </button>
            <button className="btn-primary flex-1" onClick={onDrucken} disabled={laedt}>
              {laedt ? "Speichere …" : "Bon drucken"}
            </button>
          </div>
          <p className="text-[11px] text-neutral-500 text-center">
            „Korrigieren" verwirft die Rechnung (nichts wird gebucht).
          </p>
        </div>
      </div>
    </div>
  );
}
