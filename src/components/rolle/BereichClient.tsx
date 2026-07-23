"use client";

import { useCallback, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { RollenHeader } from "@/components/rolle/RollenHeader";
import { DirektverkaufPanel } from "@/components/rolle/DirektverkaufPanel";
import { useLive } from "@/lib/useLive";

type Ticket = {
  id: string;
  status: string;
  version: number;
  arbeitsbereich: string;
  nummer: number;
  tisch: string | null;
  gast: string | null;
  abholnummer: string | null;
  notiz: string | null;
  kellner: string;
  bestellzeit: string;
  positionen: { produktName: string; menge: number; notiz: string | null; bildUrl: string | null; icon: string | null }[];
};

function minuten(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function BereichClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [darfZahlen, setDarfZahlen] = useState(false);
  // Umschaltbar: Ticket-Ausgabe (Vorbereitung/Abholung) ODER Direktverkauf am Tresen.
  const [modus, setModus] = useState<"tickets" | "direkt">("tickets");

  const laden = useCallback(async () => {
    try {
      const d = await jsonFetch<{ tickets: Ticket[]; darfZahlen?: boolean }>("/api/bereich/tickets");
      setTickets(d.tickets);
      setDarfZahlen(d.darfZahlen === true);
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setGeladen(true);
    }
  }, []);

  useEffect(() => {
    laden();
  }, [laden]);
  useLive(laden); // Live-Aktualisierung (SSE + Fallback)

  async function setzen(t: Ticket, status: string) {
    try {
      await jsonFetch(`/api/bereich/tickets/${t.id}`, {
        method: "POST",
        body: JSON.stringify({ status, version: t.version }),
      });
      laden();
    } catch (e) {
      setFehler((e as Error).message);
      laden();
    }
  }

  const spalten: { titel: string; farbe: string; filter: (s: string) => boolean }[] = [
    { titel: "Neu", farbe: "border-neutral-600", filter: (s) => s === "QUEUED" },
    { titel: "In Vorbereitung", farbe: "border-blue-500", filter: (s) => s === "ACCEPTED" || s === "IN_PREPARATION" },
    { titel: "Fertig zur Abholung", farbe: "border-brand-600", filter: (s) => s === "READY" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <RollenHeader titel="Bereich" benutzer={tickets[0]?.arbeitsbereich}>
        {darfZahlen && (
          <div className="flex gap-1">
            <button className={`pill-tab ${modus === "tickets" ? "on" : ""}`} onClick={() => setModus("tickets")}>
              Ausgabe
            </button>
            <button className={`pill-tab ${modus === "direkt" ? "on" : ""}`} onClick={() => setModus("direkt")}>
              Direkt (Tresen)
            </button>
          </div>
        )}
        {modus === "tickets" && <span className="badge bg-brand-600/20 text-brand-50">● Live</span>}
      </RollenHeader>

      {modus === "direkt" ? (
        <DirektverkaufPanel />
      ) : (
      <div className="flex-1 overflow-y-auto p-3">
        {fehler && <p className="text-red-300 text-sm mb-2">{fehler}</p>}
        {geladen && tickets.length === 0 && <p className="text-neutral-400">Keine offenen Tickets.</p>}
        <div className="grid gap-3 md:grid-cols-3">
          {spalten.map((sp) => {
            const liste = tickets.filter((t) => sp.filter(t.status));
            return (
              <div key={sp.titel}>
                <h3 className="text-sm uppercase tracking-wide text-neutral-400 mb-2">
                  {sp.titel} ({liste.length})
                </h3>
                <div className="space-y-2">
                  {liste.map((t) => {
                    const alt = minuten(t.bestellzeit);
                    return (
                      <div key={t.id} className={`card p-3 border-l-4 ${sp.farbe}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">Nr. {t.nummer}</span>
                          <span className={`text-xs ${alt >= 6 ? "text-red-300 font-bold" : "text-neutral-500"}`}>
                            {alt} min{alt >= 6 ? " ⚠" : ""}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400">
                          {t.kellner}
                          {t.tisch ? ` · Tisch ${t.tisch}` : ""}
                          {t.abholnummer ? ` · Abhol-Nr. ${t.abholnummer}` : ""}
                          {t.gast ? ` · ${t.gast}` : ""}
                        </div>
                        <ul className="mt-2 text-sm space-y-1">
                          {t.positionen.map((p, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="h-9 w-9 shrink-0 rounded bg-neutral-800 flex items-center justify-center overflow-hidden">
                                {p.bildUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.bildUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-lg">{p.icon || "🍽️"}</span>
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="font-medium">{p.menge}×</span> {p.produktName}
                                {p.notiz && <span className="text-amber-300"> — {p.notiz}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {t.notiz && <div className="mt-1 text-xs text-amber-300">⚠ {t.notiz}</div>}
                        <div className="mt-2 flex gap-2">
                          {t.status === "QUEUED" && (
                            <>
                              <button className="btn-ghost flex-1 py-1.5 text-sm" onClick={() => setzen(t, "ACCEPTED")}>
                                Annehmen
                              </button>
                              <button className="btn-primary flex-1 py-1.5 text-sm" onClick={() => setzen(t, "READY")}>
                                Fertig
                              </button>
                            </>
                          )}
                          {(t.status === "ACCEPTED" || t.status === "IN_PREPARATION") && (
                            <>
                              <button className="btn-ghost py-1.5 text-sm" onClick={() => setzen(t, "QUEUED")}>
                                Zurückgeben
                              </button>
                              <button className="btn-primary flex-1 py-1.5 text-sm" onClick={() => setzen(t, "READY")}>
                                Fertig
                              </button>
                            </>
                          )}
                          {t.status === "READY" && (
                            <span className="text-xs text-neutral-500 py-1.5">wartet auf Kellner …</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
