"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useDialog } from "@/components/ui/DialogProvider";
import { formatCent, parseEuroToCent } from "@/lib/money";

type Produkt = {
  id: string;
  name: string;
  beschreibung: string | null;
  icon: string | null;
  bildUrl: string | null;
  preisCent: number | null;
  preisFehlt: boolean;
  aktiv: boolean;
  sortierung: number;
  kategorie: { id: string; name: string; aktiv: boolean };
  verkaufsbereichIds: string[];
  arbeitsbereichId: string | null;
};
type Kategorie = { id: string; name: string; aktiv: boolean };
type Bereich = { id: string; name: string; aktiv: boolean };

type FormState = {
  id?: string;
  name: string;
  beschreibung: string;
  icon: string;
  bildUrl: string | null;
  preisText: string; // leer = Preis fehlt
  sortierung: number;
  aktiv: boolean;
  kategorieId: string;
  verkaufsbereichIds: string[];
  arbeitsbereichId: string;
};

const LEER: FormState = {
  name: "",
  beschreibung: "",
  icon: "",
  bildUrl: null,
  preisText: "",
  sortierung: 0,
  aktiv: true,
  kategorieId: "",
  verkaufsbereichIds: [],
  arbeitsbereichId: "",
};

export function ProdukteAdmin() {
  const dialog = useDialog();
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [kategorien, setKategorien] = useState<Kategorie[]>([]);
  const [bereiche, setBereiche] = useState<Bereich[]>([]);
  const [arbeitsbereiche, setArbeitsbereiche] = useState<Bereich[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [nurPreisFehlt, setNurPreisFehlt] = useState(false);

  async function laden() {
    setLadt(true);
    try {
      const [p, k, b, a] = await Promise.all([
        jsonFetch<Produkt[]>("/api/admin/produkte"),
        jsonFetch<Kategorie[]>("/api/admin/kategorien"),
        jsonFetch<Bereich[]>("/api/admin/verkaufsbereiche"),
        jsonFetch<Bereich[]>("/api/admin/arbeitsbereiche"),
      ]);
      setProdukte(p);
      setKategorien(k);
      setBereiche(b);
      setArbeitsbereiche(a);
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
      icon: p.icon ?? "",
      bildUrl: p.bildUrl,
      preisText: p.preisCent === null ? "" : (p.preisCent / 100).toFixed(2).replace(".", ","),
      sortierung: p.sortierung,
      aktiv: p.aktiv,
      kategorieId: p.kategorie.id,
      verkaufsbereichIds: p.verkaufsbereichIds,
      arbeitsbereichId: p.arbeitsbereichId ?? "",
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
      icon: form.icon.trim() || null,
      bildUrl: form.bildUrl,
      preisCent,
      sortierung: form.sortierung,
      aktiv: form.aktiv,
      kategorieId: form.kategorieId,
      verkaufsbereichIds: form.verkaufsbereichIds,
      arbeitsbereichId: form.arbeitsbereichId || null,
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
    const ok = await dialog.confirm({
      titel: "Löschen",
      text: `Produkt „${p.name}" löschen?`,
      bestaetigenText: "Löschen",
      gefahr: true,
    });
    if (!ok) return;
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
              {p.bildUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.bildUrl}
                  alt=""
                  className="h-9 w-9 rounded object-cover shrink-0 bg-neutral-800"
                />
              ) : (
                <span className="text-2xl w-9 text-center shrink-0">{p.icon || "📦"}</span>
              )}
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
          arbeitsbereiche={arbeitsbereiche}
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
  arbeitsbereiche,
  onSpeichern,
  onAbbrechen,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  kategorien: Kategorie[];
  bereiche: Bereich[];
  arbeitsbereiche: Bereich[];
  onSpeichern: () => void;
  onAbbrechen: () => void;
}) {
  const [ladeBild, setLadeBild] = useState(false);
  const [bildFehler, setBildFehler] = useState<string | null>(null);

  function toggleBereich(id: string) {
    const drin = form.verkaufsbereichIds.includes(id);
    setForm({
      ...form,
      verkaufsbereichIds: drin
        ? form.verkaufsbereichIds.filter((x) => x !== id)
        : [...form.verkaufsbereichIds, id],
    });
  }

  async function bildHochladen(datei: File) {
    setLadeBild(true);
    setBildFehler(null);
    try {
      const fd = new FormData();
      fd.append("datei", datei);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const info = await res.json();
      if (!res.ok) throw new Error(info.error ?? "Upload fehlgeschlagen.");
      setForm({ ...form, bildUrl: info.url });
    } catch (e) {
      setBildFehler((e as Error).message);
    } finally {
      setLadeBild(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="card w-full max-w-lg p-4 space-y-3 max-h-[92dvh] overflow-y-auto rounded-b-none sm:rounded-2xl">
        <h2 className="text-lg font-semibold">
          {form.id ? "Produkt bearbeiten" : "Neues Produkt"}
        </h2>

        <div className="flex gap-2">
          <label className="block w-20">
            <span className="text-sm text-neutral-400">Icon</span>
            <input
              className="input mt-1 text-center text-xl"
              placeholder="🍺"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
            />
          </label>
          <label className="block flex-1">
            <span className="text-sm text-neutral-400">Name</span>
            <input
              className="input mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-neutral-400">Beschreibung (optional)</span>
          <input
            className="input mt-1"
            value={form.beschreibung}
            onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
          />
        </label>

        {/* Produktbild (optional) – PNG/JPG/WebP, max. 2 MB */}
        <div>
          <span className="text-sm text-neutral-400">Bild (optional, PNG/JPG/WebP)</span>
          <div className="mt-1 flex items-center gap-3">
            {form.bildUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.bildUrl} alt="" className="h-14 w-14 rounded object-cover bg-neutral-800" />
            ) : (
              <span className="h-14 w-14 rounded bg-neutral-800 flex items-center justify-center text-2xl">
                {form.icon || "📦"}
              </span>
            )}
            <div className="flex flex-col gap-1">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="text-sm text-neutral-300 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-700 file:px-3 file:py-1.5 file:text-neutral-100"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) bildHochladen(f);
                }}
              />
              {form.bildUrl && (
                <button
                  type="button"
                  className="text-xs text-red-300 text-left"
                  onClick={() => setForm({ ...form, bildUrl: null })}
                >
                  Bild entfernen
                </button>
              )}
            </div>
          </div>
          {ladeBild && <p className="text-xs text-neutral-400 mt-1">Lädt Bild hoch …</p>}
          {bildFehler && <p className="text-xs text-red-300 mt-1">{bildFehler}</p>}
        </div>

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

        <label className="block">
          <span className="text-sm text-neutral-400">Arbeitsbereich (Zubereitung/Ausgabe)</span>
          <select
            className="input mt-1"
            value={form.arbeitsbereichId}
            onChange={(e) => setForm({ ...form, arbeitsbereichId: e.target.value })}
          >
            <option value="">– keiner –</option>
            {arbeitsbereiche.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {!a.aktiv ? " (inaktiv)" : ""}
              </option>
            ))}
          </select>
        </label>

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

        <div className="flex items-center gap-4">
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
            <span>Produkt aktiv</span>
          </label>
        </div>

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
