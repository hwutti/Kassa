"use client";

import { useEffect, useMemo, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";
import type { BereichRef } from "@/lib/dto";

type Produkt = {
  id: string;
  name: string;
  preisCent: number | null;
  preisFehlt: boolean;
  preisGeaendertAm: string | null;
  aktiv: boolean;
  kategorie: { id: string; name: string };
  verkaufsbereichIds: string[];
};
type Bereich = BereichRef;

export function PreisuebersichtAdmin() {
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [bereiche, setBereiche] = useState<Bereich[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);
  const [nurFehlend, setNurFehlend] = useState(false);
  const [suche, setSuche] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [p, b] = await Promise.all([
          jsonFetch<Produkt[]>("/api/admin/produkte"),
          jsonFetch<Bereich[]>("/api/admin/verkaufsbereiche"),
        ]);
        setProdukte(p);
        setBereiche(b);
      } catch (e) {
        setFehler((e as Error).message);
      } finally {
        setLadt(false);
      }
    })();
  }, []);

  const bereichName = useMemo(() => {
    const m = new Map(bereiche.map((b) => [b.id, b.name]));
    return (ids: string[]) => ids.map((id) => m.get(id) ?? "?").join(", ");
  }, [bereiche]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return produkte.filter((p) => {
      if (nurFehlend && !p.preisFehlt) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [produkte, nurFehlend, suche]);

  const fehlend = produkte.filter((p) => p.preisFehlt).length;

  if (ladt) return <p className="text-neutral-400">Lädt …</p>;
  if (fehler) return <p className="text-red-300">{fehler}</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Produkt suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          type="search"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={nurFehlend} onChange={(e) => setNurFehlend(e.target.checked)} />
          Nur fehlende Preise ({fehlend})
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[40rem]">
          <thead>
            <tr className="text-left text-neutral-400 border-b border-neutral-800">
              <th className="py-2 pr-3">Produkt</th>
              <th className="py-2 pr-3">Kategorie</th>
              <th className="py-2 pr-3">Verkaufsbereiche</th>
              <th className="py-2 pr-3 text-right">Preis</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Letzte Änderung</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.map((p) => (
              <tr key={p.id} className="border-b border-neutral-900">
                <td className="py-2 pr-3 font-medium">{p.name}</td>
                <td className="py-2 pr-3 text-neutral-400">{p.kategorie.name}</td>
                <td className="py-2 pr-3 text-neutral-400">{bereichName(p.verkaufsbereichIds) || "—"}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {p.preisFehlt ? <span className="text-amber-300">—</span> : formatCent(p.preisCent)}
                </td>
                <td className="py-2 pr-3">
                  {p.preisFehlt ? (
                    <span className="badge bg-amber-500/20 text-amber-200">Preis fehlt</span>
                  ) : !p.aktiv ? (
                    <span className="badge bg-neutral-700 text-neutral-300">inaktiv</span>
                  ) : (
                    <span className="badge bg-brand-600/20 text-brand-50">ok</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-neutral-500 text-xs">
                  {p.preisGeaendertAm ? new Date(p.preisGeaendertAm).toLocaleString("de-AT") : "—"}
                </td>
              </tr>
            ))}
            {gefiltert.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-neutral-400">
                  Keine Produkte.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
