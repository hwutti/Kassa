"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useDialog } from "@/components/ui/DialogProvider";
import { StammEditor } from "@/components/admin/VerkaufsbereicheAdmin";

type Bereich = {
  id: string;
  name: string;
  beschreibung: string | null;
  icon: string | null;
  aktiv: boolean;
  sortierung: number;
  anzahlProdukte: number;
  anzahlMitarbeiter: number;
};
type Form = {
  id?: string;
  name: string;
  beschreibung: string;
  icon: string;
  sortierung: number;
  aktiv: boolean;
};
const LEER: Form = { name: "", beschreibung: "", icon: "", sortierung: 0, aktiv: true };

export function ArbeitsbereicheAdmin() {
  const dialog = useDialog();
  const [liste, setListe] = useState<Bereich[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);
  const [form, setForm] = useState<Form | null>(null);

  async function laden() {
    setLadt(true);
    try {
      setListe(await jsonFetch<Bereich[]>("/api/admin/arbeitsbereiche"));
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
    };
    try {
      if (form.id) {
        await jsonFetch(`/api/admin/arbeitsbereiche/${form.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await jsonFetch("/api/admin/arbeitsbereiche", { method: "POST", body: JSON.stringify(body) });
      }
      setForm(null);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }
  async function umschalten(b: Bereich) {
    try {
      await jsonFetch(`/api/admin/arbeitsbereiche/${b.id}`, { method: "PATCH", body: JSON.stringify({ aktiv: !b.aktiv }) });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }
  async function loeschen(b: Bereich) {
    const ok = await dialog.confirm({ titel: "Löschen", text: `Arbeitsbereich „${b.name}" löschen?`, bestaetigenText: "Löschen", gefahr: true });
    if (!ok) return;
    try {
      await jsonFetch(`/api/admin/arbeitsbereiche/${b.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2">
        <b className="text-neutral-200">Station / Ausgabe</b> – <b>WO</b> ein Produkt zubereitet und geholt wird
        (z. B. Bierausgabe, Küche, Kaffee). Steuert die <b>Tickets</b>, die zugewiesenen <b>Mitarbeiter</b> und den
        <b> Drucker</b> der Station. Welche Produkte dazugehören, stellst du unter „Produkte" ein.
      </p>
      <button className="btn-primary" onClick={() => setForm({ ...LEER, sortierung: liste.length + 1 })}>
        + Neuer Arbeitsbereich
      </button>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}
      {ladt ? (
        <p className="text-neutral-400">Lädt …</p>
      ) : (
        <div className="space-y-2">
          {liste.map((b) => (
            <div key={b.id} className="card p-3 flex items-center gap-3">
              <span className="text-2xl w-8 text-center shrink-0">{b.icon || "🏭"}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-neutral-400">
                  {b.anzahlProdukte} Produkte · {b.anzahlMitarbeiter} Mitarbeiter
                </div>
              </div>
              <button
                className={`badge ${b.aktiv ? "bg-brand-600/20 text-brand-50" : "bg-neutral-700 text-neutral-300"}`}
                onClick={() => umschalten(b)}
              >
                {b.aktiv ? "aktiv" : "inaktiv"}
              </button>
              <button
                className="btn-ghost py-1.5 text-sm"
                onClick={() =>
                  setForm({ id: b.id, name: b.name, beschreibung: b.beschreibung ?? "", icon: b.icon ?? "", sortierung: b.sortierung, aktiv: b.aktiv })
                }
              >
                Bearbeiten
              </button>
              <button className="btn-ghost py-1.5 text-red-300 text-sm" onClick={() => loeschen(b)}>
                Löschen
              </button>
            </div>
          ))}
          {liste.length === 0 && <p className="text-neutral-400">Noch keine Arbeitsbereiche.</p>}
        </div>
      )}

      {form && (
        <StammEditor
          titel={form.id ? "Arbeitsbereich bearbeiten" : "Neuer Arbeitsbereich"}
          form={form}
          setForm={setForm}
          onSpeichern={speichern}
          onAbbrechen={() => setForm(null)}
        />
      )}
    </div>
  );
}
