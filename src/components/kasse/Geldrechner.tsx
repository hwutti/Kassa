"use client";

import { formatCent, parseEuroToCent } from "@/lib/money";

type Props = {
  summeCent: number;
  erhaltenText: string;
  onErhaltenChange: (text: string) => void;
};

// Schnellbeträge in Cent (typische Scheine/Münzen).
const SCHNELL = [500, 1000, 2000, 5000, 10000];

/**
 * Geldeingabe für Touch-Bedienung: numerische Bildschirmtastatur (inputMode) +
 * großer On-Screen-Ziffernblock, damit die Kasse ohne physische Tastatur bedienbar ist.
 */
export function Geldrechner({ summeCent, erhaltenText, onErhaltenChange }: Props) {
  const erhaltenCent = parseEuroToCent(erhaltenText);
  const rueckgeldCent =
    erhaltenCent !== null && erhaltenCent >= summeCent ? erhaltenCent - summeCent : null;
  const zuWenig = erhaltenCent !== null && erhaltenCent < summeCent;

  function ziffer(z: string) {
    // Nur sinnvolle Zeichen zulassen (Ziffern + ein Komma).
    if (z === "," && erhaltenText.includes(",")) return;
    onErhaltenChange(erhaltenText + z);
  }
  function loeschen() {
    onErhaltenChange(erhaltenText.slice(0, -1));
  }
  function zuruecksetzen() {
    onErhaltenChange("");
  }
  function passend() {
    onErhaltenChange((summeCent / 100).toFixed(2).replace(".", ","));
  }

  // Kompakte, aber touch-taugliche Tasten (Höhe passt sich an, damit auf Tablets
  // im Querformat alles ohne Scrollen auf eine Seite passt).
  const taste =
    "rounded-lg bg-neutral-800 active:bg-neutral-700 font-medium select-none " +
    "flex items-center justify-center h-[clamp(2.25rem,5.5vh,3rem)] text-lg";

  return (
    <div className="space-y-2">
      <input
        id="erhalten"
        value={erhaltenText}
        onChange={(e) => onErhaltenChange(e.target.value)}
        inputMode="decimal"
        placeholder="Erhalten 0,00"
        className="input text-right text-xl tabular-nums"
        aria-describedby="rueckgeld"
      />

      {/* Schnellbeträge */}
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" className={`${taste} text-sm`} onClick={passend}>
          Passend
        </button>
        {SCHNELL.map((c) => (
          <button
            key={c}
            type="button"
            className={`${taste} text-sm tabular-nums`}
            onClick={() => onErhaltenChange((c / 100).toFixed(2).replace(".", ","))}
          >
            {formatCent(c)}
          </button>
        ))}
      </div>

      {/* On-Screen-Ziffernblock */}
      <div className="grid grid-cols-3 gap-1.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((z) => (
          <button key={z} type="button" className={taste} onClick={() => ziffer(z)}>
            {z}
          </button>
        ))}
        <button type="button" className={taste} onClick={() => ziffer(",")}>
          ,
        </button>
        <button type="button" className={taste} onClick={() => ziffer("0")}>
          0
        </button>
        <button
          type="button"
          className={taste}
          onClick={loeschen}
          aria-label="Letzte Ziffer löschen"
        >
          ⌫
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className={`${taste} px-3 text-sm shrink-0`} onClick={zuruecksetzen}>
          C
        </button>
        {/* Rückgeld */}
        <div
          id="rueckgeld"
          className={`flex-1 rounded-lg px-3 h-[clamp(2.25rem,5.5vh,3rem)] flex items-center justify-between ${
            rueckgeldCent !== null ? "bg-brand-600/20 text-brand-50" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          <span className="text-sm">Rückgeld</span>
          <span className="text-lg font-semibold tabular-nums">
            {rueckgeldCent !== null ? formatCent(rueckgeldCent) : zuWenig ? "zu wenig" : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
