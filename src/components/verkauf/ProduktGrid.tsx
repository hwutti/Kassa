"use client";

import { useMemo, useState } from "react";
import { formatCent } from "@/lib/money";

export type Kat = { id: string; name: string; farbe: string | null; icon: string | null };
export type Prod = {
  id: string;
  name: string;
  preisCent: number;
  icon: string | null;
  bildUrl: string | null;
  barcode: string | null;
  kategorieId: string;
};
export type Pos = { produktId: string; name: string; preisCent: number; menge: number };
export type Korb = Record<string, Pos>;

/**
 * Produkt-Raster mit Suche, Barcode-Scan, Kategorie-Filter und Mengen-Buttons.
 * Gemeinsam von Verkauf (KellnerClient) und Direktverkauf/Tresen (DirektverkaufPanel).
 */
export function ProduktGrid({
  kategorien,
  produkte,
  korb,
  onPlus,
  onMenge,
}: {
  kategorien: Kat[];
  produkte: Prod[];
  korb: Korb;
  onPlus: (p: Prod) => void;
  onMenge: (id: string, d: number) => void;
}) {
  const [katFilter, setKatFilter] = useState<string | null>(null);
  const [suche, setSuche] = useState("");

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return produkte.filter((p) => {
      if (katFilter && p.kategorieId !== katFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [produkte, katFilter, suche]);

  return (
    <main className="flex-1 min-w-0 flex flex-col">
      <div className="shrink-0 p-3 border-b border-neutral-800 space-y-2">
        <input
          type="search"
          className="input"
          placeholder="Produkt suchen oder Barcode scannen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const code = suche.trim();
            if (!code) return;
            // Barcode-Scanner tippt den Code + Enter: exakter Treffer -> in den Korb.
            const treffer = produkte.find((p) => p.barcode && p.barcode === code);
            if (treffer) {
              onPlus(treffer);
              setSuche("");
            }
          }}
        />
        <div className="flex gap-2 overflow-x-auto">
          <button className={`chip-cat ${!katFilter ? "on" : ""}`} onClick={() => setKatFilter(null)}>
            Alle
          </button>
          {kategorien.map((k) => (
            <button key={k.id} className={`chip-cat ${katFilter === k.id ? "on" : ""}`} onClick={() => setKatFilter(k.id)}>
              {k.icon} {k.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {gefiltert.map((p) => (
            <div
              key={p.id}
              className={`card p-0 overflow-hidden flex flex-col ${korb[p.id] ? "ring-2 ring-brand-600 border-brand-600" : ""}`}
            >
              <button onClick={() => onPlus(p)} className="text-left active:scale-[.98] transition">
                <div className="relative aspect-[4/3] bg-neutral-800 flex items-center justify-center">
                  {p.bildUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.bildUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl leading-none">{p.icon || "🍽️"}</span>
                  )}
                  {korb[p.id] && (
                    <span className="absolute top-1 right-1 badge bg-brand-600 text-white shadow">{korb[p.id].menge}×</span>
                  )}
                </div>
                <div className="p-2">
                  <div className="font-medium leading-tight line-clamp-2">{p.name}</div>
                  <div className="mt-0.5 text-brand-50 font-semibold tabular-nums">{formatCent(p.preisCent)}</div>
                </div>
              </button>
              <div className="mt-auto flex items-center gap-1 p-1.5 border-t border-neutral-800">
                <button
                  onClick={() => onMenge(p.id, -1)}
                  disabled={!korb[p.id]}
                  aria-label={`${p.name}: Menge verringern`}
                  className="h-10 flex-1 rounded-lg bg-neutral-800 text-xl font-semibold active:bg-neutral-700 disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-8 text-center tabular-nums font-semibold" aria-live="polite">
                  {korb[p.id]?.menge ?? 0}
                </span>
                <button
                  onClick={() => onPlus(p)}
                  aria-label={`${p.name}: Menge erhöhen`}
                  className="h-10 flex-1 rounded-lg bg-brand-600 text-white text-xl font-semibold active:bg-brand-700"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          {gefiltert.length === 0 && <p className="text-neutral-400 col-span-full p-4">Keine Produkte mit Preis.</p>}
        </div>
      </div>
    </main>
  );
}
