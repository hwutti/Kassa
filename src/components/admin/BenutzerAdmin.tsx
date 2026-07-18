"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useDialog } from "@/components/ui/DialogProvider";

type Benutzer = {
  id: string;
  benutzername: string;
  rolle: "ADMIN" | "KASSA";
  aktiv: boolean;
  letzterLogin: string | null;
};

export function BenutzerAdmin() {
  const dialog = useDialog();
  const [liste, setListe] = useState<Benutzer[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ladt, setLadt] = useState(true);

  // Formular für neuen Benutzer
  const [name, setName] = useState("");
  const [passwort, setPasswort] = useState("");
  const [rolle, setRolle] = useState<"ADMIN" | "KASSA">("KASSA");

  async function laden() {
    setLadt(true);
    try {
      setListe(await jsonFetch<Benutzer[]>("/api/admin/benutzer"));
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
    if (!name.trim() || passwort.length < 4) {
      setFehler("Benutzername und Passwort (min. 4 Zeichen) erforderlich.");
      return;
    }
    try {
      await jsonFetch("/api/admin/benutzer", {
        method: "POST",
        body: JSON.stringify({ benutzername: name.trim(), passwort, rolle }),
      });
      setName("");
      setPasswort("");
      setRolle("KASSA");
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function patch(b: Benutzer, data: Record<string, unknown>) {
    try {
      await jsonFetch(`/api/admin/benutzer/${b.id}`, { method: "PATCH", body: JSON.stringify(data) });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function passwortZuruecksetzen(b: Benutzer) {
    const neu = await dialog.prompt({
      titel: "Passwort zurücksetzen",
      text: `Neues Passwort für „${b.benutzername}" (min. 4 Zeichen):`,
    });
    if (neu === null) return;
    if (neu.length < 4) {
      await dialog.alert({ text: "Passwort zu kurz (min. 4 Zeichen)." });
      return;
    }
    patch(b, { passwort: neu });
  }

  async function loeschen(b: Benutzer) {
    const ok = await dialog.confirm({
      titel: "Löschen",
      text: `Benutzer „${b.benutzername}" löschen?`,
      bestaetigenText: "Löschen",
      gefahr: true,
    });
    if (!ok) return;
    try {
      await jsonFetch(`/api/admin/benutzer/${b.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Neuer Benutzer */}
      <div className="card p-3 flex flex-wrap items-end gap-2">
        <label className="block flex-1 min-w-[10rem]">
          <span className="text-xs text-neutral-400">Benutzername</span>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>
        <label className="block flex-1 min-w-[10rem]">
          <span className="text-xs text-neutral-400">Passwort</span>
          <input
            type="password"
            className="input mt-1"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-400">Rolle</span>
          <select
            className="input mt-1"
            value={rolle}
            onChange={(e) => setRolle(e.target.value as "ADMIN" | "KASSA")}
          >
            <option value="KASSA">Kassa</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </label>
        <button className="btn-primary" onClick={anlegen}>
          Anlegen
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Rolle <strong>Administrator</strong>: darf alles verwalten. <strong>Kassa</strong>: für Bedienpersonen.
      </p>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}
      {ladt ? (
        <p className="text-neutral-400">Lädt …</p>
      ) : (
        <div className="space-y-2">
          {liste.map((b) => (
            <div key={b.id} className="card p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {b.benutzername}
                  <span
                    className={`badge ${b.rolle === "ADMIN" ? "bg-brand-600/20 text-brand-50" : "bg-neutral-700 text-neutral-300"}`}
                  >
                    {b.rolle === "ADMIN" ? "Administrator" : "Kassa"}
                  </span>
                </div>
                <div className="text-xs text-neutral-400">
                  {b.letzterLogin
                    ? `zuletzt angemeldet ${new Date(b.letzterLogin).toLocaleString("de-AT")}`
                    : "noch nie angemeldet"}
                </div>
              </div>
              <select
                className="input py-1.5 w-auto"
                value={b.rolle}
                onChange={(e) => patch(b, { rolle: e.target.value })}
                aria-label="Rolle ändern"
              >
                <option value="KASSA">Kassa</option>
                <option value="ADMIN">Administrator</option>
              </select>
              <button
                className={`badge ${b.aktiv ? "bg-brand-600/20 text-brand-50" : "bg-neutral-700 text-neutral-300"}`}
                onClick={() => patch(b, { aktiv: !b.aktiv })}
              >
                {b.aktiv ? "aktiv" : "inaktiv"}
              </button>
              <button className="btn-ghost py-1.5 text-sm" onClick={() => passwortZuruecksetzen(b)}>
                Passwort
              </button>
              <button className="btn-ghost py-1.5 text-red-300 text-sm" onClick={() => loeschen(b)}>
                Löschen
              </button>
            </div>
          ))}
          {liste.length === 0 && <p className="text-neutral-400">Keine Benutzer.</p>}
        </div>
      )}
    </div>
  );
}
