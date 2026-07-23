"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useDialog } from "@/components/ui/DialogProvider";
import { IconPicker } from "@/components/admin/IconPicker";
import { Modal } from "@/components/ui/Modal";

type Bereich = {
  id: string;
  name: string;
  beschreibung: string | null;
  icon: string | null;
  aktiv: boolean;
  istAllgemein: boolean;
  sortierung: number;
  anzahlProdukte: number;
};

type Form = {
  id?: string;
  name: string;
  beschreibung: string;
  icon: string;
  sortierung: number;
  aktiv: boolean;
  istAllgemein: boolean;
};

const LEER: Form = {
  name: "",
  beschreibung: "",
  icon: "",
  sortierung: 0,
  aktiv: true,
  istAllgemein: false,
};

export function VerkaufsbereicheAdmin() {
  const dialog = useDialog();
  const [liste, setListe] = useState<Bereich[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);
  const [form, setForm] = useState<Form | null>(null);

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
      istAllgemein: form.istAllgemein,
    };
    try {
      if (form.id) {
        await jsonFetch(`/api/admin/verkaufsbereiche/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await jsonFetch("/api/admin/verkaufsbereiche", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setForm(null);
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
    const ok = await dialog.confirm({
      titel: "Löschen",
      text: `Verkaufsbereich „${b.name}" löschen?`,
      bestaetigenText: "Löschen",
      gefahr: true,
    });
    if (!ok) return;
    try {
      await jsonFetch(`/api/admin/verkaufsbereiche/${b.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2">
        <b className="text-neutral-200">Verkaufsstelle / Kasse</b> – <b>WO</b> verkauft und kassiert wird. Legt fest,
        welche <b>Produkte</b> eine Kasse anbietet. Die <b>„Allgemeine Kassa"</b> zeigt automatisch alle Produkte –
        für die meisten Feste reicht diese eine.
      </p>
      <button className="btn-primary" onClick={() => setForm({ ...LEER, sortierung: liste.length + 1 })}>
        + Neuer Verkaufsbereich
      </button>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}
      {ladt ? (
        <p className="text-neutral-400">Lädt …</p>
      ) : (
        <div className="space-y-2">
          {liste.map((b) => (
            <div key={b.id} className="card p-3 flex items-center gap-3">
              <span className="text-2xl w-8 text-center shrink-0">{b.icon || "🛒"}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {b.name}
                  {b.istAllgemein && (
                    <span className="badge bg-blue-500/20 text-blue-200">Allgemeine Kassa</span>
                  )}
                </div>
                <div className="text-xs text-neutral-400">
                  Sortierung {b.sortierung} · {b.anzahlProdukte} Produkte
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
                  setForm({
                    id: b.id,
                    name: b.name,
                    beschreibung: b.beschreibung ?? "",
                    icon: b.icon ?? "",
                    sortierung: b.sortierung,
                    aktiv: b.aktiv,
                    istAllgemein: b.istAllgemein,
                  })
                }
              >
                Bearbeiten
              </button>
              <button className="btn-ghost py-1.5 text-red-300 text-sm" onClick={() => loeschen(b)}>
                Löschen
              </button>
            </div>
          ))}
          {liste.length === 0 && <p className="text-neutral-400">Noch keine Verkaufsbereiche.</p>}
        </div>
      )}

      {form && (
        <StammEditor
          titel={form.id ? "Verkaufsbereich bearbeiten" : "Neuer Verkaufsbereich"}
          form={form}
          setForm={setForm}
          onSpeichern={speichern}
          onAbbrechen={() => setForm(null)}
          extra={
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.istAllgemein}
                onChange={(e) => setForm({ ...form, istAllgemein: e.target.checked })}
              />
              <span>Allgemeine Kassa (zeigt alle gültigen Produkte)</span>
            </label>
          }
        />
      )}
    </div>
  );
}

/** Wiederverwendbarer Editor für Stammdaten mit Name/Beschreibung/Icon/Sortierung/aktiv. */
export function StammEditor<T extends { name: string; beschreibung: string; icon: string; sortierung: number; aktiv: boolean }>({
  titel,
  form,
  setForm,
  onSpeichern,
  onAbbrechen,
  extra,
}: {
  titel: string;
  form: T;
  setForm: (f: T) => void;
  onSpeichern: () => void;
  onAbbrechen: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <Modal variant="sheet" onSchliessen={onAbbrechen} cardClass="w-full max-w-md p-4 space-y-3 max-h-[92dvh] overflow-y-auto">
      <h2 className="text-lg font-semibold">{titel}</h2>
        <label className="block">
          <span className="text-sm text-neutral-400">Name</span>
          <input
            className="input mt-1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <div>
          <span className="text-sm text-neutral-400">Icon</span>
          <div className="mt-1">
            <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
          </div>
        </div>
        <label className="block">
          <span className="text-sm text-neutral-400">Beschreibung (optional)</span>
          <input
            className="input mt-1"
            value={form.beschreibung}
            onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
          />
        </label>
        <div className="flex items-center gap-3">
          <label className="block w-32">
            <span className="text-sm text-neutral-400">Sortierung</span>
            <input
              type="number"
              className="input mt-1"
              value={form.sortierung}
              onChange={(e) => setForm({ ...form, sortierung: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              checked={form.aktiv}
              onChange={(e) => setForm({ ...form, aktiv: e.target.checked })}
            />
            <span>aktiv</span>
          </label>
        </div>
        {extra}
        <div className="flex gap-2 pt-2">
          <button className="btn-ghost flex-1" onClick={onAbbrechen}>
            Abbrechen
          </button>
          <button className="btn-primary flex-1" onClick={onSpeichern}>
            Speichern
          </button>
        </div>
    </Modal>
  );
}
