"use client";

import { useCallback, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";

type Ereignis = {
  id: string;
  zeitpunkt: string;
  typ: string;
  benutzer: string;
  nummer: number | null;
  alterWert: string | null;
  neuerWert: string | null;
  grund: string | null;
};
type Preis = {
  id: string;
  geaendertAm: string;
  produkt: string;
  alterPreisCent: number | null;
  neuerPreisCent: number | null;
  geaendertVon: string | null;
};

const TYP_LABEL: Record<string, string> = {
  BESTELLUNG_ABGESENDET: "Bestellung abgesendet",
  ZAHLUNG_ERFASST: "Zahlung erfasst",
  RUECKERSTATTUNG: "Rückerstattung",
  AUSGEGEBEN: "Ausgegeben",
  DIREKTVERKAUF: "Direktverkauf",
  TICKET_STATUS: "Bereich: Statuswechsel",
  STORNIERT: "Storniert",
};
const label = (t: string) => TYP_LABEL[t] ?? t;
const zeit = (iso: string) => new Date(iso).toLocaleString("de-AT");
const preis = (c: number | null) => (c == null ? "—" : formatCent(c));

export function AuditAdmin() {
  const [ereignisse, setEreignisse] = useState<Ereignis[]>([]);
  const [preise, setPreise] = useState<Preis[]>([]);
  const [typen, setTypen] = useState<string[]>([]);
  const [typ, setTyp] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      const q = typ ? `?typ=${encodeURIComponent(typ)}` : "";
      const d = await jsonFetch<{ ereignisse: Ereignis[]; preise: Preis[]; typen: string[] }>(`/api/admin/audit${q}`);
      setEreignisse(d.ereignisse);
      setPreise(d.preise);
      setTypen(d.typen);
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, [typ]);
  useEffect(() => {
    laden();
  }, [laden]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Protokoll</h1>
        <span className="text-xs text-neutral-400">Nachvollziehbare Ereignisse &amp; Preisänderungen</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-neutral-400" htmlFor="audit-typ">
            Typ
          </label>
          <select id="audit-typ" className="input py-1.5" value={typ} onChange={(e) => setTyp(e.target.value)}>
            <option value="">Alle</option>
            {typen.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
          <button className="btn-ghost py-1.5 text-sm" onClick={laden}>
            Aktualisieren
          </button>
        </div>
      </div>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}

      <section className="card p-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-800 text-sm font-semibold">
          Ereignisse ({ereignisse.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-neutral-400 text-xs">
              <tr className="border-b border-neutral-800">
                <th className="text-left font-medium px-3 py-2">Zeit</th>
                <th className="text-left font-medium px-3 py-2">Ereignis</th>
                <th className="text-left font-medium px-3 py-2">Bestellung</th>
                <th className="text-left font-medium px-3 py-2">Benutzer</th>
                <th className="text-left font-medium px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {ereignisse.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-400 py-8">
                    Keine Einträge.
                  </td>
                </tr>
              )}
              {ereignisse.map((e) => (
                <tr key={e.id} className="border-b border-neutral-900">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums text-neutral-300">{zeit(e.zeitpunkt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{label(e.typ)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-neutral-300">{e.nummer != null ? `Nr. ${e.nummer}` : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-neutral-300">{e.benutzer}</td>
                  <td className="px-3 py-2 text-neutral-400">
                    {[e.alterWert && e.neuerWert ? `${e.alterWert} → ${e.neuerWert}` : e.neuerWert ?? e.alterWert, e.grund]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-800 text-sm font-semibold">
          Preisänderungen ({preise.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-neutral-400 text-xs">
              <tr className="border-b border-neutral-800">
                <th className="text-left font-medium px-3 py-2">Zeit</th>
                <th className="text-left font-medium px-3 py-2">Produkt</th>
                <th className="text-right font-medium px-3 py-2">Alt</th>
                <th className="text-right font-medium px-3 py-2">Neu</th>
                <th className="text-left font-medium px-3 py-2">Von</th>
              </tr>
            </thead>
            <tbody>
              {preise.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-neutral-400 py-8">
                    Keine Preisänderungen.
                  </td>
                </tr>
              )}
              {preise.map((p) => (
                <tr key={p.id} className="border-b border-neutral-900">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums text-neutral-300">{zeit(p.geaendertAm)}</td>
                  <td className="px-3 py-2">{p.produkt}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-400">{preis(p.alterPreisCent)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-50">{preis(p.neuerPreisCent)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-neutral-300">{p.geaendertVon ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
