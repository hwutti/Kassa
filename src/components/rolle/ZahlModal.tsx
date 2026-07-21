"use client";

import { useState } from "react";
import { formatCent, parseEuroToCent } from "@/lib/money";
import { Geldrechner } from "@/components/kasse/Geldrechner";

type Position = { produktName: string; menge: number; einzelpreisCent: number; summeCent: number };

/**
 * Gemeinsames Bezahl-Modal für Verkäufer und zentrale Kassa.
 * Zeigt die Positionen + Geldrechner (Rückgeld) und meldet den erhaltenen Betrag
 * beim Bestätigen zurück. Kassiert wird über den zentralen Zahlungs-Endpunkt.
 */
export function ZahlModal({
  nummer,
  summeCent,
  positionen,
  laedt,
  fehler,
  onAbbrechen,
  onBezahlen,
}: {
  nummer: number;
  summeCent: number;
  positionen?: Position[];
  laedt: boolean;
  fehler: string | null;
  onAbbrechen: () => void;
  onBezahlen: (gegebenCent: number | null) => void;
}) {
  const [erhaltenText, setErhaltenText] = useState("");
  const erhaltenCent = parseEuroToCent(erhaltenText);
  const zuWenig = erhaltenCent !== null && erhaltenCent < summeCent;

  function bezahlen() {
    if (zuWenig || laedt) return;
    onBezahlen(erhaltenCent);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md max-h-[94dvh] flex flex-col">
        <div className="shrink-0 p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold">Kassieren – Nr. {nummer}</h2>
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

          <Geldrechner summeCent={summeCent} erhaltenText={erhaltenText} onErhaltenChange={setErhaltenText} />

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
              {laedt ? "Speichere …" : erhaltenText.trim() === "" ? "Bezahlt (passend)" : "Bezahlt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
