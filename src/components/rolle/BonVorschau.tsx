"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { Modal } from "@/components/ui/Modal";
import { bonHtml, druckeBon, type BonDaten } from "@/lib/bon";
import { druckeRawbt } from "@/lib/rawbt";

/**
 * Zeigt den Beleg KLEIN in der App (kein Vollbild-Druckdialog beim Öffnen).
 * „Drucken" startet erst auf Wunsch den System-Druckdialog; „Schließen" bringt
 * immer zurück. Ist RawBT-Direktdruck in den Einstellungen aktiv, erscheint
 * zusätzlich „Direkt drucken" (an den Thermodrucker, ohne Dialog).
 */
export function BonVorschau({ daten, onSchliessen }: { daten: BonDaten; onSchliessen: () => void }) {
  const [rawbt, setRawbt] = useState(false);
  useEffect(() => {
    jsonFetch<{ rawbtAktiv?: boolean }>("/api/kasse/konfig")
      .then((k) => setRawbt(k.rawbtAktiv === true))
      .catch(() => undefined);
  }, []);

  return (
    <Modal onSchliessen={onSchliessen} cardClass="w-full max-w-xs max-h-[94dvh] flex flex-col p-0 overflow-hidden">
      <div className="p-3 border-b border-neutral-800 text-center shrink-0">
        <h2 className="font-semibold">Beleg · Nr. {daten.nummer}</h2>
        <p className="text-xs text-neutral-400">Vorschau – „Drucken" öffnet den Druck, „Schließen" bringt zurück.</p>
      </div>
      <div className="flex-1 overflow-y-auto bg-white flex justify-center min-h-0">
        <iframe title="Beleg-Vorschau" srcDoc={bonHtml(daten)} className="w-[80mm] h-[62vh] border-0 bg-white" />
      </div>
      <div className="p-3 border-t border-neutral-800 shrink-0 space-y-2">
        {rawbt && (
          <button className="btn-primary w-full" onClick={() => druckeRawbt(daten)}>
            ⚡ Direkt drucken (RawBT)
          </button>
        )}
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onSchliessen}>
            Schließen
          </button>
          <button className={`${rawbt ? "btn-ghost" : "btn-primary"} flex-1`} onClick={() => druckeBon(daten)}>
            Drucken{rawbt ? " (Dialog)" : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}
