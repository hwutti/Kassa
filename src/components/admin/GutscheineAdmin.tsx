"use client";

import { useCallback, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent, parseEuroToCent } from "@/lib/money";
import { useDialog } from "@/components/ui/DialogProvider";

type Gutschein = {
  id: string;
  code: string;
  anfangsCent: number;
  restCent: number;
  aktiv: boolean;
  notiz: string | null;
  createdAt: string;
};

export function GutscheineAdmin() {
  const dialog = useDialog();
  const [liste, setListe] = useState<Gutschein[]>([]);
  const [betragText, setBetragText] = useState("");
  const [code, setCode] = useState("");
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [neuerCode, setNeuerCode] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      setListe(await jsonFetch<Gutschein[]>("/api/admin/gutscheine"));
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, []);
  useEffect(() => {
    laden();
  }, [laden]);

  async function anlegen() {
    const betragCent = parseEuroToCent(betragText);
    if (betragCent === null || betragCent <= 0) {
      setFehler("Bitte einen gültigen Betrag angeben.");
      return;
    }
    try {
      const g = await jsonFetch<Gutschein>("/api/admin/gutscheine", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() || undefined, betragCent, notiz: notiz.trim() || null }),
      });
      setBetragText("");
      setCode("");
      setNotiz("");
      setNeuerCode(g.code);
      setFehler(null);
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function umschalten(g: Gutschein) {
    try {
      await jsonFetch(`/api/admin/gutscheine/${g.id}`, { method: "PATCH", body: JSON.stringify({ aktiv: !g.aktiv }) });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  async function loeschen(g: Gutschein) {
    const ok = await dialog.confirm({ titel: "Gutschein löschen?", text: g.code, bestaetigenText: "Löschen" });
    if (!ok) return;
    try {
      await jsonFetch(`/api/admin/gutscheine/${g.id}`, { method: "DELETE" });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Gutscheine</h1>
        <span className="text-xs text-neutral-400">Wertgutscheine ausgeben und Restguthaben verwalten.</span>
      </div>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}

      <div className="card p-3 space-y-2">
        <div className="text-sm font-semibold">Neuen Gutschein ausgeben</div>
        <div className="grid sm:grid-cols-3 gap-2">
          <input className="input" placeholder="Betrag € (z. B. 20)" value={betragText} onChange={(e) => setBetragText(e.target.value)} inputMode="decimal" />
          <input className="input" placeholder="Code (leer = automatisch)" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="input" placeholder="Notiz (optional)" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={anlegen}>
          + Gutschein ausgeben
        </button>
        {neuerCode && (
          <p className="text-sm text-green-300">
            Ausgegeben: <span className="font-mono font-semibold">{neuerCode}</span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        {liste.length === 0 && <p className="text-neutral-400">Noch keine Gutscheine.</p>}
        {liste.map((g) => {
          const leer = g.restCent <= 0;
          return (
            <div key={g.id} className="card p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[10rem]">
                <div className="font-mono font-semibold">
                  {g.code}{" "}
                  {!g.aktiv && <span className="text-xs text-neutral-500">(gesperrt)</span>}
                  {g.aktiv && leer && <span className="text-xs text-neutral-500">(aufgebraucht)</span>}
                </div>
                <div className="text-xs text-neutral-400">
                  Guthaben {formatCent(g.restCent)} von {formatCent(g.anfangsCent)}
                  {g.notiz ? ` · ${g.notiz}` : ""}
                </div>
              </div>
              <span className={`text-base font-bold tabular-nums ${leer ? "text-neutral-500" : "text-neutral-50"}`}>
                {formatCent(g.restCent)}
              </span>
              <button className="btn-ghost py-1.5 text-sm" onClick={() => umschalten(g)}>
                {g.aktiv ? "Sperren" : "Freigeben"}
              </button>
              <button className="btn-ghost py-1.5 text-sm text-red-300" onClick={() => loeschen(g)}>
                Löschen
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
