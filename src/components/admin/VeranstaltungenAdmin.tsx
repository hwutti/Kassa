"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useDialog } from "@/components/ui/DialogProvider";

type Veranstaltung = {
  id: string;
  name: string;
  beschreibung: string | null;
  aktiv: boolean;
  anzahlBestellungen: number;
};

export function VeranstaltungenAdmin() {
  const dialog = useDialog();
  const [liste, setListe] = useState<Veranstaltung[]>([]);
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);

  async function laden() {
    setLadt(true);
    try {
      setListe(await jsonFetch<Veranstaltung[]>("/api/admin/veranstaltungen"));
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
      await jsonFetch("/api/admin/veranstaltungen", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), aktiv: liste.length === 0 }),
      });
      setName("");
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function aktivSetzen(v: Veranstaltung) {
    try {
      await jsonFetch(`/api/admin/veranstaltungen/${v.id}`, {
        method: "PATCH",
        body: JSON.stringify({ aktiv: true }),
      });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function umbenennen(v: Veranstaltung) {
    const neu = await dialog.prompt({
      titel: "Umbenennen",
      text: "Neuer Name der Veranstaltung:",
      standard: v.name,
    });
    if (!neu || !neu.trim()) return;
    try {
      await jsonFetch(`/api/admin/veranstaltungen/${v.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: neu.trim() }),
      });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function loeschen(v: Veranstaltung) {
    const ok = await dialog.confirm({
      titel: "Löschen",
      text: `Veranstaltung „${v.name}" löschen?`,
      bestaetigenText: "Löschen",
      gefahr: true,
    });
    if (!ok) return;
    try {
      await jsonFetch(`/api/admin/veranstaltungen/${v.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        Neue Bestellungen werden automatisch der <strong>aktiven</strong> Veranstaltung zugeordnet.
        Abrechnungen lassen sich in den Auswertungen je Veranstaltung filtern.
      </p>

      <div className="card p-3 flex gap-2">
        <input
          className="input"
          placeholder="Neue Veranstaltung (z. B. Kirchtag 2026)"
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
          {liste.map((v) => (
            <div key={v.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {v.name}
                  {v.aktiv && <span className="badge bg-brand-600/20 text-brand-50">aktiv</span>}
                </div>
                <div className="text-xs text-neutral-400">{v.anzahlBestellungen} Bestellungen</div>
              </div>
              {!v.aktiv && (
                <button className="btn-ghost py-1.5 text-sm" onClick={() => aktivSetzen(v)}>
                  Aktiv setzen
                </button>
              )}
              <button className="btn-ghost py-1.5 text-sm" onClick={() => umbenennen(v)}>
                Umbenennen
              </button>
              <button className="btn-ghost py-1.5 text-red-300 text-sm" onClick={() => loeschen(v)}>
                Löschen
              </button>
            </div>
          ))}
          {liste.length === 0 && <p className="text-neutral-400">Noch keine Veranstaltungen.</p>}
        </div>
      )}
    </div>
  );
}
