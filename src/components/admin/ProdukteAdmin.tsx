"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent, parseEuroToCent } from "@/lib/money";

type Produkt = {
  id: string;
  name: string;
  beschreibung: string | null;
  preisCent: number | null;
  preisFehlt: boolean;
  aktiv: boolean;
  sortierung: number;
  kategorie: { id: string; name: string; aktiv: boolean };
  verkaufsbereichIds: string[];
};
type Kategorie = { id: string; name: string; aktiv: boolean };
type Bereich = { id: string; name: string; aktiv: boolean };

type FormState = {
  id?: string;
  name: string;
  beschreibung: string;
  preisText: string; // leer = Preis fehlt
  aktiv: boolean;
  kategorieId: string;
  verkaufsbereichIds: string[];
};

const LEER: FormState = {
  name: "",
  beschreibung: "",
  preisText: "",
  aktiv: true,
  kategorieId: "",
  verkaufsbereichIds: [],
};

export function ProdukteAdmin() {
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [kategorien, setKategorien] = useState<Kategorie[]>([]);
  const [bereiche, setBereiche] = useState<Bereich[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [nurPreisFehlt, setNurPreisFehlt] = useState(false);

  async function laden() {
    setLadt(true);
    try {
      const [p, k, b] = await Promise.all([
        jsonFetch<Produkt[]>("/api/admin/produkte"),
        jsonFetch<Kategorie[]>("/api/admin/kategorien"),
        jsonFetch<Bereich[]>("/api/admin/verkaufsbereiche"),
      ]);
      setProdukte(p);
      setKategorien(k);
      setBereiche(b);
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

  function neu() {
    setForm({ ...LEER, kategorieId: kategorien[0]?.id ?? "" });
  }
  function bearbeiten(p: Produkt) {
    setForm({
      id: p.id,
      name: p.name,
      beschreibung: p.beschreibung ?? "",
      preisText: p.preisCent === null ? "" : (p.preisCent / 100).toFixed(2).replace(".", ","),
      aktiv: p.aktiv,
      kategorieId: p.kategorie.id,
      verkaufsbereichIds: p.verkaufsbereichIds,
    });
  }

  async function speichern() {
    if (!form) return;
    if (!form.name.trim() || !form.kategorieId) {
      setFehler("Name und Kategorie sind erforderlich.");
      return;
    }
    // Leeres Preisfeld => null ("Preis fehlt"). Sonst gültiger Cent-Betrag.
    const preisCent = form.preisText.trim() === "" ? null : parseEuroToCent(form.preisText);
    if (form.preisText.trim() !== "" && preisCent === null) {
      setFehler("Ungültiger Preis. Bitte z. B. 2,50 eingeben oder Feld leer lassen.");
      return;
    }
    const body = {
      name: form.name.trim(),
      beschreibung: form.beschreibung.trim() || null,
      preisCent,
      aktiv: form.aktiv,
      kategorieId: form.kategorieId,
      verkaufsbereichIds: form.verkaufsbereichIds,
    };
    try {
      if (form.id) {
        await jsonFetch(`/api/admin/produkte/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await jsonFetch("/api/admin/produkte", { method: "POST", body: JSON.stringify(body) });
      }
      setForm(null);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function loeschen(p: Produkt) {
    if (!confirm(`Produkt „${p.name}" löschen?`)) return;
    try {
      await jsonFetch(`/api/admin/produkte/${p.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  const sichtbareProdukte = nurPreisFehlt ? produkte.filter((p) => p.preisFehlt) : produkte;
  const anzahlOhnePreis = produkte.filter((p) => p.preisFehlt).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={neu} disabled={kategorien.length === 0}>
          + Neues Produkt
        </button>
        {kategorien.length === 0 && (
          <span className="text-sm text-amber-300">Bitte zuerst eine Kategorie anlegen.</span>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={nurPreisFehlt}
            onChange={(e) => setNurPreisFehlt(e.target.checked)}
          />
          Nur „Preis fehlt" ({anzahlOhnePreis})
        </label>
      </div>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}

      {ladt ? (
        <p className="text-neutral-400">Lädt …</p>
      ) : (
        <div className="space-y-2">
          {sichtbareProdukte.map((p) => (
            <div key={p.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{p.name}</span>
                  {p.preisFehlt && (
                    <span className="badge bg-amber-500/20 text-amber-200">Preis fehlt</span>
                  )}
                  {!p.aktiv && (
                    <span className="badge bg-neutral-700 text-neutral-300">inaktiv</span>
                  )}
                  {!p.kategorie.aktiv && (
                    <span className="badge bg-neutral-700 text-neutral-400">Kat. inaktiv</span>
                  )}
                </div>
                <div className="text-xs text-neutral-400">
                  {p.kategorie.name} · {p.verkaufsbereichIds.length} Bereich(e)
                </div>
              </div>
              <div className="text-right tabular-nums w-24">
                {p.preisFehlt ? (
                  <span className="text-amber-300">—</span>
                ) : (
                  <span className="font-semibold">{formatCent(p.preisCent)}</span>
                )}
              </div>
              <button className="btn-ghost py-1.5 text-sm" onClick={() => bearbeiten(p)}>
                Bearbeiten
              </button>
              <button className="btn-ghost py-1.5 text-red-300 text-sm" onClick={() => loeschen(p)}>
                Löschen
              </button>
            </div>
          ))}
          {sichtbareProdukte.length === 0 && (
            <p className="text-neutral-400">Keine Produkte.</p>
          )}
        </div>
      )}

      {form && (
        <ProduktForm
          form={form}
          setForm={setForm}
          kategorien={kategorien}
          bereiche={bereiche}
          onSpeichern={speichern}
          onAbbrechen={() => setForm(null)}
        />
      )}
    </div>
  );
}

function ProduktForm({
  form,
  setForm,
  kategorien,
  bereiche,
  onSpeichern,
  onAbbrechen,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  kategorien: Kategorie[];
  bereiche: Bereich[];
  onSpeichern: () => void;
  onAbbrechen: () => void;
}) {
  function toggleBereich(id: string) {
    const drin = form.verkaufsbereichIds.includes(id);
    setForm({
      ...form,
      verkaufsbereichIds: drin
        ? form.verkaufsbereichIds.filter((x) => x !== id)
        : [...form.verkaufsbereichIds, id],
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="card w-full max-w-lg p-4 space-y-3 max-h-[92dvh] overflow-y-auto rounded-b-none sm:rounded-2xl">
        <h2 className="text-lg font-semibold">
          {form.id ? "Produkt bearbeiten" : "Neues Produkt"}
        </h2>

        <label className="block">
          <span className="text-sm text-neutral-400">Name</span>
          <input
            className="input mt-1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-sm text-neutral-400">Beschreibung (optional)</span>
          <input
            className="input mt-1"
            value={form.beschreibung}
            onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-neutral-400">Preis (€) – leer = Preis fehlt</span>
            <input
              className="input mt-1 text-right tabular-nums"
              inputMode="decimal"
              placeholder="z. B. 2,50"
              value={form.preisText}
              onChange={(e) => setForm({ ...form, preisText: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-400">Kategorie</span>
            <select
              className="input mt-1"
              value={form.kategorieId}
              onChange={(e) => setForm({ ...form, kategorieId: e.target.value })}
            >
              {kategorien.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                  {!k.aktiv ? " (inaktiv)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <span className="text-sm text-neutral-400">Verkaufsbereiche</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {bereiche.map((b) => {
              const drin = form.verkaufsbereichIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBereich(b.id)}
                  className={`rounded-full px-3 py-2 text-sm border ${
                    drin
                      ? "bg-brand-600 border-brand-600 text-white"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300"
                  }`}
                >
                  {b.name}
                  {!b.aktiv ? " (inaktiv)" : ""}
                </button>
              );
            })}
            {bereiche.length === 0 && (
              <span className="text-sm text-amber-300">Noch keine Verkaufsbereiche angelegt.</span>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.aktiv}
            onChange={(e) => setForm({ ...form, aktiv: e.target.checked })}
          />
          <span>Produkt aktiv</span>
        </label>

        <div className="flex gap-2 pt-2">
          <button className="btn-ghost flex-1" onClick={onAbbrechen}>
            Abbrechen
          </button>
          <button className="btn-primary flex-1" onClick={onSpeichern}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
