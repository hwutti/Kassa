"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";

type Bereich = {
  id: string;
  name: string;
  aktiv: boolean;
  sortierung: number;
  anzahlProdukte: number;
};

export function VerkaufsbereicheAdmin() {
  const [liste, setListe] = useState<Bereich[]>([]);
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);

  async function laden() {
    setLadt(true);
    try {
      setListe(await jsonFetch<Bereich[]>("/api/admin/verkaufsbereiche"));
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
      await jsonFetch("/api/admin/verkaufsbereiche", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function umschalten(b: Bereich) {
    try {
      await jsonFetch(`/api/admin/verkaufsbereiche/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({ aktiv: !b.aktiv }),
      });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function loeschen(b: Bereich) {
    if (!confirm(`Verkaufsbereich „${b.name}" löschen?`)) return;
    try {
      await jsonFetch(`/api/admin/verkaufsbereiche/${b.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-3 flex gap-2">
        <input
          className="input"
          placeholder="Neuer Verkaufsbereich"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && anlegen()}
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
          {liste.map((b) => (
            <div key={b.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-neutral-400">{b.anzahlProdukte} Produkte</div>
              </div>
              <button
                className={`badge ${b.aktiv ? "bg-brand-600/20 text-brand-50" : "bg-neutral-700 text-neutral-300"}`}
                onClick={() => umschalten(b)}
              >
                {b.aktiv ? "aktiv" : "inaktiv"}
              </button>
              <button className="btn-ghost py-1.5 text-red-300 text-sm" onClick={() => loeschen(b)}>
                Löschen
              </button>
            </div>
          ))}
          {liste.length === 0 && <p className="text-neutral-400">Noch keine Verkaufsbereiche.</p>}
        </div>
      )}
    </div>
  );
}
