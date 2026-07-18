"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";

type Bestellung = {
  id: string;
  nummer: number;
  summeCent: number;
  erhaltenCent: number | null;
  rueckgeldCent: number | null;
  createdAt: string;
  verkaufsbereichName: string;
  positionen: { produktName: string; menge: number; summeCent: number }[];
};

export function BestellungenAdmin() {
  const [liste, setListe] = useState<Bestellung[]>([]);
  const [ladt, setLadt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setListe(await jsonFetch<Bestellung[]>("/api/bestellungen?limit=100"));
      } catch (e) {
        setFehler((e as Error).message);
      } finally {
        setLadt(false);
      }
    })();
  }, []);

  if (ladt) return <p className="text-neutral-400">Lädt …</p>;
  if (fehler) return <p className="text-red-300">{fehler}</p>;
  if (liste.length === 0) return <p className="text-neutral-400">Noch keine Bestellungen.</p>;

  return (
    <div className="space-y-2">
      {liste.map((b) => (
        <details key={b.id} className="card p-3">
          <summary className="flex items-center gap-3 cursor-pointer select-none">
            <span className="font-semibold">Nr. {b.nummer}</span>
            <span className="text-xs text-neutral-400">
              {new Date(b.createdAt).toLocaleString("de-AT")} · {b.verkaufsbereichName}
            </span>
            <span className="ml-auto font-semibold tabular-nums">{formatCent(b.summeCent)}</span>
          </summary>
          <div className="mt-3 space-y-1 text-sm tabular-nums">
            {b.positionen.map((p, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {p.menge}× {p.produktName}
                </span>
                <span>{formatCent(p.summeCent)}</span>
              </div>
            ))}
            {b.erhaltenCent !== null && (
              <div className="flex justify-between text-neutral-400 pt-1 border-t border-neutral-800 mt-1">
                <span>Erhalten / Rückgeld</span>
                <span>
                  {formatCent(b.erhaltenCent)} / {formatCent(b.rueckgeldCent ?? 0)}
                </span>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
