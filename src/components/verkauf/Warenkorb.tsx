"use client";

import { formatCent } from "@/lib/money";
import type { Pos } from "@/components/verkauf/ProduktGrid";

/** Warenkorb-Liste (Positionen + Mengen + optionale Notiz). Gemeinsam für Verkauf/Tresen. */
export function Warenkorb({
  positionen,
  onMenge,
  notiz,
  setNotiz,
}: {
  positionen: Pos[];
  onMenge: (id: string, d: number) => void;
  notiz: string;
  setNotiz: (v: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
      {positionen.length === 0 ? (
        <p className="text-neutral-500 text-sm text-center p-4">Produkte antippen …</p>
      ) : (
        positionen.map((p) => (
          <div key={p.produktId} className="card p-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{p.name}</div>
              <div className="text-xs text-neutral-400 tabular-nums">
                {formatCent(p.preisCent)} × {p.menge}
              </div>
            </div>
            <button className="btn-ghost h-8 w-8 !px-0 !min-h-0" onClick={() => onMenge(p.produktId, -1)}>–</button>
            <span className="w-6 text-center tabular-nums">{p.menge}</span>
            <button className="btn-ghost h-8 w-8 !px-0 !min-h-0" onClick={() => onMenge(p.produktId, +1)}>+</button>
          </div>
        ))
      )}
      {positionen.length > 0 && (
        <input className="input" placeholder="Notiz (optional)" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
      )}
    </div>
  );
}
