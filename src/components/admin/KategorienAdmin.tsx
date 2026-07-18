"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";

type Kategorie = {
  id: string;
  name: string;
  aktiv: boolean;
  sortierung: number;
  farbe: string | null;
  anzahlProdukte: number;
};

export function KategorienAdmin() {
  const [liste, setListe] = useState<Kategorie[]>([]);
  const [name, setName] = useState("");
  const [farbe, setFarbe] = useState("#2563eb");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);

  async function laden() {
    setLadt(true);
    try {
      setListe(await jsonFetch<Kategorie[]>("/api/admin/kategorien"));
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

  async function anlegen() {
    if (!name.trim()) return;
    try {
      await jsonFetch("/api/admin/kategorien", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), farbe }),
      });
      setName("");
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }
  async function umschalten(k: Kategorie) {
    try {
      await jsonFetch(`/api/admin/kategorien/${k.id}`, {
        method: "PATCH",
        body: JSON.stringify({ aktiv: !k.aktiv }),
      });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }
  async function loeschen(k: Kategorie) {
    if (!confirm(`Kategorie „${k.name}" löschen?`)) return;
    try {
      await jsonFetch(`/api/admin/kategorien/${k.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <input
          className="input flex-1 min-w-[12rem]"
          placeholder="Neue Kategorie"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && anlegen()}
        />
        <input
          type="color"
          className="h-12 w-12 rounded-lg bg-neutral-800 border border-neutral-700"
          value={farbe}
          onChange={(e) => setFarbe(e.target.value)}
          aria-label="Farbe"
        />
        <button className="btn-primary" onClick={anlegen}>
          Anlegen
        </button>
      </div>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}
      {ladt ? (
        <p className="text-neutral-400">Lädt …</p>
      ) : (
        <div className="space-y-2">
          {liste.map((k) => (
            <div key={k.id} className="card p-3 flex items-center gap-3">
              <span
                className="h-4 w-4 rounded-full shrink-0"
                style={{ background: k.farbe ?? "#525252" }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{k.name}</div>
                <div className="text-xs text-neutral-400">{k.anzahlProdukte} Produkte</div>
              </div>
              <button
                className={`badge ${k.aktiv ? "bg-brand-600/20 text-brand-50" : "bg-neutral-700 text-neutral-300"}`}
                onClick={() => umschalten(k)}
              >
                {k.aktiv ? "aktiv" : "inaktiv"}
              </button>
              <button className="btn-ghost py-1.5 text-red-300 text-sm" onClick={() => loeschen(k)}>
                Löschen
              </button>
            </div>
          ))}
          {liste.length === 0 && <p className="text-neutral-400">Noch keine Kategorien.</p>}
        </div>
      )}
    </div>
  );
}
