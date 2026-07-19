"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useDialog } from "@/components/ui/DialogProvider";
import { formatCent } from "@/lib/money";

type Bestellung = {
  id: string;
  nummer: number;
  status: string;
  summeCent: number;
  erhaltenCent: number | null;
  rueckgeldCent: number | null;
  createdAt: string;
  storniertAm: string | null;
  stornoGrund: string | null;
  storniertVon: string | null;
  verkaufsbereichName: string;
  veranstaltungName: string | null;
  positionen: { produktName: string; menge: number; summeCent: number }[];
};
type Veranstaltung = { id: string; name: string; aktiv: boolean };

export function BestellungenAdmin() {
  const dialog = useDialog();
  const [liste, setListe] = useState<Bestellung[]>([]);
  const [veranstaltungen, setVeranstaltungen] = useState<Veranstaltung[]>([]);
  const [filter, setFilter] = useState<string | undefined>(undefined); // undefined = noch nicht initialisiert
  const [ladt, setLadt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nurAktive, setNurAktive] = useState(false);

  async function laden(veranstaltungId: string) {
    setLadt(true);
    try {
      const q = veranstaltungId ? `&veranstaltung=${veranstaltungId}` : "";
      setListe(await jsonFetch<Bestellung[]>(`/api/admin/bestellungen?limit=200${q}`));
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setLadt(false);
    }
  }

  // Veranstaltungen laden, Filter auf die aktive Veranstaltung vorbelegen.
  useEffect(() => {
    jsonFetch<Veranstaltung[]>("/api/admin/veranstaltungen")
      .then((vs) => {
        setVeranstaltungen(vs);
        setFilter(vs.find((v) => v.aktiv)?.id ?? "");
      })
      .catch(() => setFilter(""));
  }, []);

  // Bei Filteränderung neu laden.
  useEffect(() => {
    if (filter === undefined) return;
    laden(filter);
  }, [filter]);

  async function stornieren(b: Bestellung) {
    const grund = await dialog.prompt({
      titel: `Bestellung Nr. ${b.nummer} stornieren`,
      text: "Bitte Grund angeben:",
      platzhalter: "z. B. Fehleingabe",
      bestaetigenText: "Stornieren",
      gefahr: true,
    });
    if (grund === null) return;
    if (grund.trim() === "") {
      await dialog.alert({ text: "Ein Storno-Grund ist erforderlich." });
      return;
    }
    try {
      await jsonFetch(`/api/bestellungen/${b.id}/storno`, {
        method: "POST",
        body: JSON.stringify({ grund: grund.trim() }),
      });
      laden(filter ?? "");
    } catch (e) {
      await dialog.alert({ titel: "Fehler", text: (e as Error).message });
    }
  }

  const sichtbar = nurAktive ? liste.filter((b) => b.status !== "STORNIERT") : liste;
  const anzahlStorno = liste.filter((b) => b.status === "STORNIERT").length;

  return (
    <div className="space-y-3">
      {/* Filter nach Veranstaltung */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">Veranstaltung</span>
          <select
            className="input py-1.5 w-auto"
            value={filter ?? ""}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Alle Veranstaltungen</option>
            {veranstaltungen.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.aktiv ? " (aktiv)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-300 ml-auto">
          <input type="checkbox" checked={nurAktive} onChange={(e) => setNurAktive(e.target.checked)} />
          Stornierte ausblenden ({anzahlStorno})
        </label>
      </div>

      {ladt && <p className="text-neutral-400">Lädt …</p>}
      {fehler && <p className="text-red-300">{fehler}</p>}
      {!ladt && sichtbar.length === 0 && <p className="text-neutral-400">Keine Bestellungen.</p>}

      {sichtbar.map((b) => {
        const storniert = b.status === "STORNIERT";
        return (
          <div key={b.id} className={`card p-3 ${storniert ? "opacity-70" : ""}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold">Nr. {b.nummer}</span>
              {storniert && <span className="badge bg-red-700/30 text-red-200">storniert</span>}
              <span className="text-xs text-neutral-400">
                {new Date(b.createdAt).toLocaleString("de-AT")} · {b.verkaufsbereichName}
                {b.veranstaltungName ? ` · ${b.veranstaltungName}` : ""}
              </span>
              <span className={`ml-auto font-semibold tabular-nums ${storniert ? "line-through" : ""}`}>
                {formatCent(b.summeCent)}
              </span>
              {!storniert && (
                <button className="btn-ghost py-1.5 text-red-300 text-sm" onClick={() => stornieren(b)}>
                  Stornieren
                </button>
              )}
            </div>
            <div className="mt-2 space-y-0.5 text-sm tabular-nums">
              {b.positionen.map((p, i) => (
                <div key={i} className="flex justify-between text-neutral-300">
                  <span>
                    {p.menge}× {p.produktName}
                  </span>
                  <span>{formatCent(p.summeCent)}</span>
                </div>
              ))}
            </div>
            {storniert && (
              <div className="mt-2 text-xs text-red-300">
                Storniert am {new Date(b.storniertAm!).toLocaleString("de-AT")}
                {b.storniertVon ? ` von ${b.storniertVon}` : ""} · Grund: {b.stornoGrund}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
