"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useDialog } from "@/components/ui/DialogProvider";
import { Modal } from "@/components/ui/Modal";
import { ROLLEN, ROLLEN_LABEL, type Rolle } from "@/lib/rollen";
import type { BereichRef } from "@/lib/dto";

type Benutzer = {
  id: string;
  benutzername: string;
  anzeigename: string | null;
  rolle: Rolle;
  darfZahlen: boolean;
  darfStornieren: boolean;
  aktiv: boolean;
  letzterLogin: string | null;
  arbeitsbereichIds: string[];
};
type Bereich = BereichRef;
type Form = {
  id?: string;
  benutzername: string;
  anzeigename: string;
  passwort: string;
  rolle: Rolle;
  darfZahlen: boolean;
  darfStornieren: boolean;
  aktiv: boolean;
  arbeitsbereichIds: string[];
};
const LEER: Form = {
  benutzername: "",
  anzeigename: "",
  passwort: "",
  rolle: "KELLNER",
  darfZahlen: false,
  darfStornieren: false,
  aktiv: true,
  arbeitsbereichIds: [],
};

export function BenutzerAdmin() {
  const dialog = useDialog();
  const [liste, setListe] = useState<Benutzer[]>([]);
  const [bereiche, setBereiche] = useState<Bereich[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);
  const [form, setForm] = useState<Form | null>(null);

  async function laden() {
    setLadt(true);
    try {
      const [b, ab] = await Promise.all([
        jsonFetch<Benutzer[]>("/api/admin/benutzer"),
        jsonFetch<Bereich[]>("/api/admin/arbeitsbereiche"),
      ]);
      setListe(b);
      setBereiche(ab);
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
    if (!form) return;
    if (!form.benutzername.trim() || (!form.id && form.passwort.length < 4)) {
      setFehler("Benutzername und (bei neuen) Passwort mit min. 4 Zeichen erforderlich.");
      return;
    }
    const body: Record<string, unknown> = {
      benutzername: form.benutzername.trim(),
      anzeigename: form.anzeigename.trim() || null,
      rolle: form.rolle,
      darfZahlen: form.darfZahlen,
      darfStornieren: form.darfStornieren,
      aktiv: form.aktiv,
      arbeitsbereichIds: form.arbeitsbereichIds,
    };
    if (form.passwort) body.passwort = form.passwort;
    try {
      if (form.id) {
        await jsonFetch(`/api/admin/benutzer/${form.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await jsonFetch("/api/admin/benutzer", { method: "POST", body: JSON.stringify(body) });
      }
      setForm(null);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function loeschen(b: Benutzer) {
    const ok = await dialog.confirm({ titel: "Löschen", text: `Benutzer „${b.benutzername}" löschen?`, bestaetigenText: "Löschen", gefahr: true });
    if (!ok) return;
    try {
      await jsonFetch(`/api/admin/benutzer/${b.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  function toggleBereich(bid: string) {
    if (!form) return;
    const drin = form.arbeitsbereichIds.includes(bid);
    setForm({
      ...form,
      arbeitsbereichIds: drin ? form.arbeitsbereichIds.filter((x) => x !== bid) : [...form.arbeitsbereichIds, bid],
    });
  }

  return (
    <div className="space-y-4">
      <button className="btn-primary" onClick={() => setForm({ ...LEER })}>
        + Neuer Benutzer
      </button>
      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}
      {ladt ? (
        <p className="text-neutral-400">Lädt …</p>
      ) : (
        <div className="space-y-2">
          {liste.map((b) => (
            <div key={b.id} className="card p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {b.anzeigename || b.benutzername}
                  <span className="text-xs text-neutral-500">({b.benutzername})</span>
                  <span className={`badge ${b.rolle === "ADMIN" ? "bg-brand-600/20 text-brand-50" : "bg-neutral-700 text-neutral-300"}`}>
                    {ROLLEN_LABEL[b.rolle]}
                  </span>
                  {b.darfZahlen && <span className="badge bg-blue-500/20 text-blue-200">darf zahlen</span>}
                  {b.darfStornieren && <span className="badge bg-red-700/25 text-red-200">darf stornieren</span>}
                </div>
                <div className="text-xs text-neutral-400">
                  {b.arbeitsbereichIds.length > 0
                    ? `${b.arbeitsbereichIds.length} Bereich(e) · `
                    : ""}
                  {b.letzterLogin ? `zuletzt ${new Date(b.letzterLogin).toLocaleString("de-AT")}` : "nie angemeldet"}
                </div>
              </div>
              <button
                className={`badge ${b.aktiv ? "bg-brand-600/20 text-brand-50" : "bg-neutral-700 text-neutral-300"}`}
                onClick={async () => {
                  try {
                    await jsonFetch(`/api/admin/benutzer/${b.id}`, { method: "PATCH", body: JSON.stringify({ aktiv: !b.aktiv }) });
                    laden();
                  } catch (e) {
                    setFehler((e as Error).message);
                  }
                }}
              >
                {b.aktiv ? "aktiv" : "inaktiv"}
              </button>
              <button
                className="btn-ghost py-1.5 text-sm"
                onClick={() =>
                  setForm({
                    id: b.id,
                    benutzername: b.benutzername,
                    anzeigename: b.anzeigename ?? "",
                    passwort: "",
                    rolle: b.rolle,
                    darfZahlen: b.darfZahlen,
                    darfStornieren: b.darfStornieren,
                    aktiv: b.aktiv,
                    arbeitsbereichIds: b.arbeitsbereichIds,
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
          {liste.length === 0 && <p className="text-neutral-400">Keine Benutzer.</p>}
        </div>
      )}

      {form && (
        <Modal variant="sheet" onSchliessen={() => setForm(null)} cardClass="w-full max-w-md p-4 space-y-3 max-h-[92dvh] overflow-y-auto">
            <h2 className="text-lg font-semibold">{form.id ? "Benutzer bearbeiten" : "Neuer Benutzer"}</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-sm text-neutral-400">Benutzername</span>
                <input className="input mt-1" value={form.benutzername} autoCapitalize="none" autoCorrect="off" onChange={(e) => setForm({ ...form, benutzername: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm text-neutral-400">Anzeigename</span>
                <input className="input mt-1" value={form.anzeigename} onChange={(e) => setForm({ ...form, anzeigename: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-sm text-neutral-400">{form.id ? "Neues Passwort (leer = unverändert)" : "Passwort"}</span>
                <input type="password" className="input mt-1" value={form.passwort} autoComplete="new-password" onChange={(e) => setForm({ ...form, passwort: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm text-neutral-400">Rolle</span>
                <select className="input mt-1" value={form.rolle} onChange={(e) => setForm({ ...form, rolle: e.target.value as Rolle })}>
                  {ROLLEN.map((r) => (
                    <option key={r} value={r}>
                      {ROLLEN_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.darfZahlen} onChange={(e) => setForm({ ...form, darfZahlen: e.target.checked })} />
                darf Zahlungen erfassen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.darfStornieren} onChange={(e) => setForm({ ...form, darfStornieren: e.target.checked })} />
                darf stornieren
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.aktiv} onChange={(e) => setForm({ ...form, aktiv: e.target.checked })} />
                aktiv
              </label>
            </div>
            {form.rolle === "BEREICH" && (
              <div>
                <span className="text-sm text-neutral-400">Zugewiesene Arbeitsbereiche</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {bereiche.map((a) => {
                    const drin = form.arbeitsbereichIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleBereich(a.id)}
                        className={`rounded-full px-3 py-2 text-sm border ${drin ? "bg-brand-600 border-brand-600 text-white" : "bg-neutral-800 border-neutral-700 text-neutral-300"}`}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                  {bereiche.length === 0 && <span className="text-sm text-amber-300">Noch keine Arbeitsbereiche angelegt.</span>}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button className="btn-ghost flex-1" onClick={() => setForm(null)}>
                Abbrechen
              </button>
              <button className="btn-primary flex-1" onClick={speichern}>
                Speichern
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
