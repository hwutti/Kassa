"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { StammEditor } from "@/components/admin/VerkaufsbereicheAdmin";

type Kategorie = {
  id: string;
  name: string;
  beschreibung: string | null;
  icon: string | null;
  aktiv: boolean;
  sortierung: number;
  farbe: string | null;
  anzahlProdukte: number;
};

type Form = {
  id?: string;
  name: string;
  beschreibung: string;
  icon: string;
  sortierung: number;
  aktiv: boolean;
  farbe: string;
};

const LEER: Form = {
  name: "",
  beschreibung: "",
  icon: "",
  sortierung: 0,
  aktiv: true,
  farbe: "#2563eb",
};

export function KategorienAdmin() {
  const [liste, setListe] = useState<Kategorie[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);
  const [form, setForm] = useState<Form | null>(null);

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

  async function speichern() {
    if (!form || !form.name.trim()) {
      setFehler("Name ist erforderlich.");
      return;
    }
    const body = {
      name: form.name.trim(),
      beschreibung: form.beschreibung.trim() || null,
      icon: form.icon.trim() || null,
      sortierung: form.sortierung,
      aktiv: form.aktiv,
      farbe: form.farbe || null,
    };
    try {
      if (form.id) {
        await jsonFetch(`/api/admin/kategorien/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await jsonFetch("/api/admin/kategorien", { method: "POST", body: JSON.stringify(body) });
      }
      setForm(null);
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
      <button className="btn-primary" onClick={() => setForm({ ...LEER, sortierung: liste.length + 1 })}>
        + Neue Kategorie
      </button>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}
      {ladt ? (
        <p className="text-neutral-400">Lädt …</p>
      ) : (
        <div className="space-y-2">
          {liste.map((k) => (
            <div key={k.id} className="card p-3 flex items-center gap-3">
              <span className="text-2xl w-8 text-center shrink-0">{k.icon || "🏷️"}</span>
              <span
                className="h-4 w-4 rounded-full shrink-0"
                style={{ background: k.farbe ?? "#525252" }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{k.name}</div>
                <div className="text-xs text-neutral-400">
                  Sortierung {k.sortierung} · {k.anzahlProdukte} Produkte
                </div>
              </div>
              <button
                className={`badge ${k.aktiv ? "bg-brand-600/20 text-brand-50" : "bg-neutral-700 text-neutral-300"}`}
                onClick={() => umschalten(k)}
              >
                {k.aktiv ? "aktiv" : "inaktiv"}
              </button>
              <button
                className="btn-ghost py-1.5 text-sm"
                onClick={() =>
                  setForm({
                    id: k.id,
                    name: k.name,
                    beschreibung: k.beschreibung ?? "",
                    icon: k.icon ?? "",
                    sortierung: k.sortierung,
                    aktiv: k.aktiv,
                    farbe: k.farbe ?? "#2563eb",
                  })
                }
              >
                Bearbeiten
              </button>
              <button className="btn-ghost py-1.5 text-red-300 text-sm" onClick={() => loeschen(k)}>
                Löschen
              </button>
            </div>
          ))}
          {liste.length === 0 && <p className="text-neutral-400">Noch keine Kategorien.</p>}
        </div>
      )}

      {form && (
        <StammEditor
          titel={form.id ? "Kategorie bearbeiten" : "Neue Kategorie"}
          form={form}
          setForm={setForm}
          onSpeichern={speichern}
          onAbbrechen={() => setForm(null)}
          extra={
            <label className="flex items-center gap-3">
              <span className="text-sm text-neutral-400">Farbe</span>
              <input
                type="color"
                className="h-10 w-16 rounded-lg bg-neutral-800 border border-neutral-700"
                value={form.farbe}
                onChange={(e) => setForm({ ...form, farbe: e.target.value })}
              />
            </label>
          }
        />
      )}
    </div>
  );
}
