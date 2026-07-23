"use client";

import { useCallback, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useDialog } from "@/components/ui/DialogProvider";

type Drucker = {
  id: string;
  name: string;
  typ: "SYSTEM" | "NETZWERK";
  ip: string | null;
  aktiv: boolean;
  sortierung: number;
  arbeitsbereichId: string | null;
};
type Bereich = { id: string; name: string };

const LEER = { name: "", typ: "NETZWERK" as const, ip: "", arbeitsbereichId: "" };

export function DruckerAdmin() {
  const dialog = useDialog();
  const [liste, setListe] = useState<Drucker[]>([]);
  const [bereiche, setBereiche] = useState<Bereich[]>([]);
  const [neu, setNeu] = useState<{ name: string; typ: "SYSTEM" | "NETZWERK"; ip: string; arbeitsbereichId: string }>(LEER);
  const [fehler, setFehler] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [bearbeite, setBearbeite] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Drucker>>({});

  const laden = useCallback(async () => {
    try {
      const [d, b] = await Promise.all([
        jsonFetch<Drucker[]>("/api/admin/drucker"),
        jsonFetch<Bereich[]>("/api/admin/arbeitsbereiche").catch(() => [] as Bereich[]),
      ]);
      setListe(d);
      setBereiche(b);
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, []);
  useEffect(() => {
    laden();
  }, [laden]);

  const bereichName = (id: string | null) => bereiche.find((b) => b.id === id)?.name ?? null;

  async function anlegen() {
    if (!neu.name.trim()) return;
    try {
      await jsonFetch("/api/admin/drucker", {
        method: "POST",
        body: JSON.stringify({
          name: neu.name.trim(),
          typ: neu.typ,
          ip: neu.typ === "NETZWERK" ? neu.ip.trim() || null : null,
          arbeitsbereichId: neu.arbeitsbereichId || null,
        }),
      });
      setNeu(LEER);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function speichern(id: string) {
    try {
      await jsonFetch(`/api/admin/drucker/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: edit.name,
          typ: edit.typ,
          ip: edit.typ === "NETZWERK" ? edit.ip || null : null,
          arbeitsbereichId: edit.arbeitsbereichId || null,
          aktiv: edit.aktiv,
        }),
      });
      setBearbeite(null);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function umschalten(d: Drucker) {
    try {
      await jsonFetch(`/api/admin/drucker/${d.id}`, { method: "PATCH", body: JSON.stringify({ aktiv: !d.aktiv }) });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function loeschen(d: Drucker) {
    const ok = await dialog.confirm({ titel: "Drucker löschen?", text: d.name, bestaetigenText: "Löschen" });
    if (!ok) return;
    try {
      await jsonFetch(`/api/admin/drucker/${d.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function testdruck(d: Drucker) {
    setStatus(`Testdruck an ${d.name} …`);
    try {
      await jsonFetch("/api/print", { method: "POST", body: JSON.stringify({ druckerId: d.id, test: true }) });
      setStatus(`✓ Testdruck an ${d.name} gesendet`);
    } catch (e) {
      setStatus(`Fehler: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Drucker</h1>
        <span className="text-xs text-neutral-400">
          Netzwerkdrucker (ESC/POS, Port 9100) für Belege &amp; Küchentickets. „System“ = Browser-/Systemdrucker.
        </span>
      </div>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}
      {status && <p className="text-sm text-neutral-300">{status}</p>}

      {/* Neuer Drucker */}
      <div className="card p-3 space-y-2">
        <div className="text-sm font-semibold">Neuer Drucker</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <input className="input" placeholder="Name (z. B. Küchendrucker)" value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} />
          <select className="input" value={neu.typ} onChange={(e) => setNeu({ ...neu, typ: e.target.value as "SYSTEM" | "NETZWERK" })}>
            <option value="NETZWERK">Netzwerk (ESC/POS über IP)</option>
            <option value="SYSTEM">System (Browser/Systemdrucker)</option>
          </select>
          {neu.typ === "NETZWERK" && (
            <input className="input" placeholder="IP – z. B. 192.168.1.50 (optional :Port)" value={neu.ip} onChange={(e) => setNeu({ ...neu, ip: e.target.value })} />
          )}
          <select className="input" value={neu.arbeitsbereichId} onChange={(e) => setNeu({ ...neu, arbeitsbereichId: e.target.value })}>
            <option value="">Kein Arbeitsbereich (Beleg)</option>
            {bereiche.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={anlegen} disabled={!neu.name.trim()}>
          + Drucker anlegen
        </button>
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {liste.length === 0 && <p className="text-neutral-400">Noch keine Drucker angelegt.</p>}
        {liste.map((d) =>
          bearbeite === d.id ? (
            <div key={d.id} className="card p-3 space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <input className="input" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <select className="input" value={edit.typ} onChange={(e) => setEdit({ ...edit, typ: e.target.value as "SYSTEM" | "NETZWERK" })}>
                  <option value="NETZWERK">Netzwerk (ESC/POS über IP)</option>
                  <option value="SYSTEM">System (Browser/Systemdrucker)</option>
                </select>
                {edit.typ === "NETZWERK" && (
                  <input className="input" placeholder="IP" value={edit.ip ?? ""} onChange={(e) => setEdit({ ...edit, ip: e.target.value })} />
                )}
                <select className="input" value={edit.arbeitsbereichId ?? ""} onChange={(e) => setEdit({ ...edit, arbeitsbereichId: e.target.value })}>
                  <option value="">Kein Arbeitsbereich (Beleg)</option>
                  {bereiche.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => speichern(d.id)}>
                  Speichern
                </button>
                <button className="btn-ghost" onClick={() => setBearbeite(null)}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div key={d.id} className="card p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[12rem]">
                <div className="font-semibold">
                  {d.name} {!d.aktiv && <span className="text-xs text-neutral-500">(deaktiviert)</span>}
                </div>
                <div className="text-xs text-neutral-400">
                  {d.typ === "NETZWERK" ? `Netzwerk · ${d.ip ?? "keine IP"}` : "System/Browser"}
                  {bereichName(d.arbeitsbereichId) ? ` · ${bereichName(d.arbeitsbereichId)}` : " · Beleg"}
                </div>
              </div>
              {d.typ === "NETZWERK" && d.ip && (
                <button className="btn-ghost py-1.5 text-sm" onClick={() => testdruck(d)}>
                  Testdruck
                </button>
              )}
              <button className="btn-ghost py-1.5 text-sm" onClick={() => umschalten(d)}>
                {d.aktiv ? "Deaktivieren" : "Aktivieren"}
              </button>
              <button
                className="btn-ghost py-1.5 text-sm"
                onClick={() => {
                  setBearbeite(d.id);
                  setEdit({ name: d.name, typ: d.typ, ip: d.ip ?? "", arbeitsbereichId: d.arbeitsbereichId ?? "", aktiv: d.aktiv });
                }}
              >
                Bearbeiten
              </button>
              <button className="btn-ghost py-1.5 text-sm text-red-300" onClick={() => loeschen(d)}>
                Löschen
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
