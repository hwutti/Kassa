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
  positionen: { produktName: string; menge: number; summeCent: number }[];
};

export function BestellungenAdmin() {
  const dialog = useDialog();
  const [liste, setListe] = useState<Bestellung[]>([]);
  const [ladt, setLadt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nurAktive, setNurAktive] = useState(false);

  async function laden() {
    try {
      setListe(await jsonFetch<Bestellung[]>("/api/admin/bestellungen?limit=200"));
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setLadt(false);
    }
  }
  useEffect(() => {
    laden();
  }, []);

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
      await jsonFetch(`/api/admin/bestellungen/${b.id}/storno`, {
        method: "POST",
        body: JSON.stringify({ grund: grund.trim() }),
      });
      laden();
    } catch (e) {
      await dialog.alert({ titel: "Fehler", text: (e as Error).message });
    }
  }

  if (ladt) return <p className="text-neutral-400">Lädt …</p>;
  if (fehler) return <p className="text-red-300">{fehler}</p>;

  const sichtbar = nurAktive ? liste.filter((b) => b.status !== "STORNIERT") : liste;
  const anzahlStorno = liste.filter((b) => b.status === "STORNIERT").length;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={nurAktive} onChange={(e) => setNurAktive(e.target.checked)} />
        Stornierte ausblenden ({anzahlStorno})
      </label>

      {sichtbar.length === 0 && <p className="text-neutral-400">Keine Bestellungen.</p>}

      {sichtbar.map((b) => {
        const storniert = b.status === "STORNIERT";
        return (
          <div key={b.id} className={`card p-3 ${storniert ? "opacity-70" : ""}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold">Nr. {b.nummer}</span>
              {storniert && <span className="badge bg-red-700/30 text-red-200">storniert</span>}
              <span className="text-xs text-neutral-400">
                {new Date(b.createdAt).toLocaleString("de-AT")} · {b.verkaufsbereichName}
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
