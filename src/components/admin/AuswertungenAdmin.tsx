"use client";

import { useCallback, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";

type NameUmsatz = { name: string; umsatzCent: number };
type Auswertung = {
  anzahlBestellungen: number;
  gesamtumsatzCent: number;
  tagesumsatzCent: number;
  durchschnittCent: number;
  anzahlStorniert: number;
  jeVerkaufsbereich: NameUmsatz[];
  jeKategorie: NameUmsatz[];
  jeProdukt: { name: string; umsatzCent: number; menge: number }[];
};
type Bereich = { id: string; name: string };

export function AuswertungenAdmin() {
  const [daten, setDaten] = useState<Auswertung | null>(null);
  const [bereiche, setBereiche] = useState<Bereich[]>([]);
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [bereich, setBereich] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    jsonFetch<Bereich[]>("/api/admin/verkaufsbereiche").then(setBereiche).catch(() => undefined);
  }, []);

  const laden = useCallback(async () => {
    const q = new URLSearchParams();
    if (von) q.set("von", von);
    if (bis) q.set("bis", bis);
    if (bereich) q.set("verkaufsbereich", bereich);
    try {
      setDaten(await jsonFetch<Auswertung>(`/api/admin/auswertungen?${q.toString()}`));
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, [von, bis, bereich]);

  useEffect(() => {
    laden();
  }, [laden]);

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="card p-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-neutral-400">Von</span>
          <input type="date" className="input mt-1" value={von} onChange={(e) => setVon(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-400">Bis</span>
          <input type="date" className="input mt-1" value={bis} onChange={(e) => setBis(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-400">Verkaufsbereich</span>
          <select className="input mt-1" value={bereich} onChange={(e) => setBereich(e.target.value)}>
            <option value="">Alle</option>
            {bereiche.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {(von || bis || bereich) && (
          <button
            className="btn-ghost"
            onClick={() => {
              setVon("");
              setBis("");
              setBereich("");
            }}
          >
            Zurücksetzen
          </button>
        )}
      </div>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}

      {daten && (
        <>
          {/* Kennzahlen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Kennzahl label="Gesamtumsatz" wert={formatCent(daten.gesamtumsatzCent)} gross />
            <Kennzahl label="Tagesumsatz (heute)" wert={formatCent(daten.tagesumsatzCent)} />
            <Kennzahl label="Bestellungen" wert={String(daten.anzahlBestellungen)} />
            <Kennzahl label="Ø Bestellwert" wert={formatCent(daten.durchschnittCent)} />
            <Kennzahl label="Storniert" wert={String(daten.anzahlStorniert)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <UmsatzListe titel="Umsatz je Verkaufsbereich" eintraege={daten.jeVerkaufsbereich} />
            <UmsatzListe titel="Umsatz je Kategorie" eintraege={daten.jeKategorie} />
          </div>

          {/* Je Produkt */}
          <div className="card p-3">
            <h3 className="font-semibold mb-2">Umsatz je Produkt</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[24rem]">
                <thead>
                  <tr className="text-left text-neutral-400 border-b border-neutral-800">
                    <th className="py-1 pr-3">Produkt</th>
                    <th className="py-1 pr-3 text-right">Menge</th>
                    <th className="py-1 pr-3 text-right">Umsatz</th>
                  </tr>
                </thead>
                <tbody>
                  {daten.jeProdukt.map((p) => (
                    <tr key={p.name} className="border-b border-neutral-900">
                      <td className="py-1 pr-3">{p.name}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{p.menge}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{formatCent(p.umsatzCent)}</td>
                    </tr>
                  ))}
                  {daten.jeProdukt.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-3 text-neutral-400">
                        Keine Verkäufe im Zeitraum.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kennzahl({ label, wert, gross }: { label: string; wert: string; gross?: boolean }) {
  return (
    <div className="card p-3">
      <div className={`font-bold tabular-nums ${gross ? "text-2xl text-brand-50" : "text-xl"}`}>{wert}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}

function UmsatzListe({ titel, eintraege }: { titel: string; eintraege: NameUmsatz[] }) {
  const max = Math.max(1, ...eintraege.map((e) => e.umsatzCent));
  return (
    <div className="card p-3">
      <h3 className="font-semibold mb-2">{titel}</h3>
      <div className="space-y-1.5">
        {eintraege.map((e) => (
          <div key={e.name}>
            <div className="flex justify-between text-sm">
              <span>{e.name}</span>
              <span className="tabular-nums">{formatCent(e.umsatzCent)}</span>
            </div>
            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600" style={{ width: `${(e.umsatzCent / max) * 100}%` }} />
            </div>
          </div>
        ))}
        {eintraege.length === 0 && <p className="text-neutral-400 text-sm">Keine Daten.</p>}
      </div>
    </div>
  );
}
