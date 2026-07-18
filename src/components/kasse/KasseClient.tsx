"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { KassenDatenDTO, ProduktDTO, VerkaufsbereichDTO } from "@/lib/dto";
import { formatCent } from "@/lib/money";
import { usePwaStatus, setBestellungOffen } from "@/lib/pwa-store";
import {
  ausProdukt,
  anzahlArtikel,
  summeCent as korbSumme,
  type Warenkorb,
} from "@/components/kasse/types";
import { Geldrechner } from "@/components/kasse/Geldrechner";
import { parseEuroToCent } from "@/lib/money";

const BEREICH_KEY = "pos-kasse:verkaufsbereich";
const OFFENE_BESTELLUNG_KEY = "pos-kasse:offeneBestellung";

type BelegDTO = {
  nummer: number;
  summeCent: number;
  erhaltenCent: number | null;
  rueckgeldCent: number | null;
  positionen: { produktName: string; menge: number; einzelpreisCent: number; summeCent: number }[];
};

export function KasseClient() {
  const { online } = usePwaStatus();

  const [bereiche, setBereiche] = useState<VerkaufsbereichDTO[]>([]);
  const [bereichId, setBereichId] = useState<string | null>(null);
  const [daten, setDaten] = useState<KassenDatenDTO | null>(null);
  const [ladt, setLadt] = useState(false);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  const [katFilter, setKatFilter] = useState<string | null>(null);
  const [suche, setSuche] = useState("");

  const [warenkorb, setWarenkorb] = useState<Warenkorb>({});
  const [erhaltenText, setErhaltenText] = useState("");
  const [panelOffen, setPanelOffen] = useState(false);

  const [speichern, setSpeichern] = useState(false);
  const [checkoutFehler, setCheckoutFehler] = useState<string | null>(null);
  const [beleg, setBeleg] = useState<BelegDTO | null>(null);

  const clientRef = useRef<string>("");
  if (clientRef.current === "") {
    clientRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // --- Verkaufsbereiche laden ---
  const ladeBereiche = useCallback(async () => {
    try {
      const res = await fetch("/api/kasse/verkaufsbereiche", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const list: VerkaufsbereichDTO[] = await res.json();
      setBereiche(list);
      setBereichId((aktuell) => {
        if (aktuell && list.some((b) => b.id === aktuell)) return aktuell;
        const gespeichert =
          typeof window !== "undefined" ? window.localStorage.getItem(BEREICH_KEY) : null;
        if (gespeichert && list.some((b) => b.id === gespeichert)) return gespeichert;
        return list[0]?.id ?? null;
      });
    } catch {
      /* Offline: Bereiche bleiben wie sie sind (aus dem Speicher). */
    }
  }, []);

  // --- Produkt-/Preisdaten laden (immer frisch vom Server) ---
  const ladeDaten = useCallback(async (bId: string, zeigeSpinner = true) => {
    if (zeigeSpinner) setLadt(true);
    setLadeFehler(null);
    try {
      const res = await fetch(`/api/kasse/produkte?verkaufsbereich=${encodeURIComponent(bId)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: KassenDatenDTO = await res.json();
      setDaten(d);
    } catch {
      // Kein Überschreiben bereits geladener Daten – aber Hinweis anzeigen.
      setLadeFehler("Produktdaten konnten nicht geladen werden.");
    } finally {
      if (zeigeSpinner) setLadt(false);
    }
  }, []);

  useEffect(() => {
    ladeBereiche();
  }, [ladeBereiche]);

  useEffect(() => {
    if (!bereichId) return;
    if (typeof window !== "undefined") window.localStorage.setItem(BEREICH_KEY, bereichId);
    ladeDaten(bereichId, true);
    setKatFilter(null);
  }, [bereichId, ladeDaten]);

  // Bei Rückkehr der Verbindung frische Daten holen (ohne Warenkorb zu stören).
  useEffect(() => {
    if (online && bereichId) {
      ladeBereiche();
      ladeDaten(bereichId, false);
    }
  }, [online, bereichId, ladeBereiche, ladeDaten]);

  // Regelmäßige Aktualisierung des Katalogs (Preise nie unbemerkt veraltet).
  useEffect(() => {
    if (!bereichId) return;
    const iv = window.setInterval(() => {
      if (online) ladeDaten(bereichId, false);
    }, 60000);
    return () => window.clearInterval(iv);
  }, [bereichId, online, ladeDaten]);

  // Store informieren, ob eine Bestellung offen ist (blockiert PWA-Update).
  useEffect(() => {
    setBestellungOffen(Object.keys(warenkorb).length > 0);
  }, [warenkorb]);

  // Offene Bestellung wiederherstellen (übersteht versehentliches Neuladen / PWA-Update, §23).
  const wiederhergestellt = useRef(false);
  useEffect(() => {
    if (wiederhergestellt.current) return;
    wiederhergestellt.current = true;
    try {
      const raw = window.localStorage.getItem(OFFENE_BESTELLUNG_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { warenkorb?: Warenkorb; erhaltenText?: string };
        if (d.warenkorb && Object.keys(d.warenkorb).length > 0) setWarenkorb(d.warenkorb);
        if (typeof d.erhaltenText === "string") setErhaltenText(d.erhaltenText);
      }
    } catch {
      /* ignorieren */
    }
  }, []);

  // Offene Bestellung laufend sichern; nach Abschluss/Leeren wieder entfernen.
  useEffect(() => {
    if (!wiederhergestellt.current) return;
    try {
      if (Object.keys(warenkorb).length === 0) {
        window.localStorage.removeItem(OFFENE_BESTELLUNG_KEY);
      } else {
        window.localStorage.setItem(
          OFFENE_BESTELLUNG_KEY,
          JSON.stringify({ warenkorb, erhaltenText }),
        );
      }
    } catch {
      /* ignorieren */
    }
  }, [warenkorb, erhaltenText]);

  // --- Warenkorb-Operationen ---
  function hinzufuegen(p: ProduktDTO) {
    setWarenkorb((korb) => {
      const vorhanden = korb[p.id];
      return {
        ...korb,
        [p.id]: vorhanden
          ? { ...vorhanden, menge: vorhanden.menge + 1 }
          : ausProdukt(p),
      };
    });
  }
  function mengeAendern(produktId: string, delta: number) {
    setWarenkorb((korb) => {
      const pos = korb[produktId];
      if (!pos) return korb;
      const menge = pos.menge + delta;
      if (menge <= 0) {
        const rest = { ...korb };
        delete rest[produktId];
        return rest;
      }
      return { ...korb, [produktId]: { ...pos, menge } };
    });
  }
  function entfernen(produktId: string) {
    setWarenkorb((korb) => {
      const rest = { ...korb };
      delete rest[produktId];
      return rest;
    });
  }
  // Stiller Reset (nach erfolgreichem Abschluss).
  function warenkorbLeeren() {
    setWarenkorb({});
    setErhaltenText("");
    setCheckoutFehler(null);
  }
  // Leeren per Knopf – mit Sicherheitsabfrage (Spec §24).
  function leerenMitFrage() {
    if (artikelAnzahl === 0) return;
    if (!confirm("Aktuelle Bestellung wirklich leeren?")) return;
    warenkorbLeeren();
  }

  const summe = korbSumme(warenkorb);
  const artikelAnzahl = anzahlArtikel(warenkorb);

  const gefilterteProdukte = useMemo(() => {
    if (!daten) return [];
    const q = suche.trim().toLowerCase();
    return daten.produkte.filter((p) => {
      if (katFilter && p.kategorieId !== katFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [daten, katFilter, suche]);

  // --- Checkout ---
  async function abschliessen() {
    if (speichern) return; // Schutz vor doppeltem Auslösen
    if (artikelAnzahl === 0) return;
    if (!online) {
      setCheckoutFehler("Keine Verbindung – Bestellung kann nicht sicher gespeichert werden.");
      return;
    }
    if (!bereichId) return;

    const erhaltenCent = parseEuroToCent(erhaltenText);
    // Zu wenig Bargeld: Abschluss blockieren und fehlenden Betrag anzeigen (Spec §15).
    if (erhaltenCent !== null && erhaltenCent < summe) {
      setCheckoutFehler(`Betrag zu niedrig – es fehlen ${formatCent(summe - erhaltenCent)}.`);
      return;
    }

    setSpeichern(true);
    setCheckoutFehler(null);
    try {
      const res = await fetch("/api/bestellungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRef: clientRef.current,
          verkaufsbereichId: bereichId,
          erhaltenCent,
          positionen: Object.values(warenkorb).map((p) => ({
            produktId: p.produktId,
            menge: p.menge,
            einzelpreisCent: p.einzelpreisCent,
          })),
        }),
      });

      if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        // Erst NACH sicherem Speichern gilt eine Bestellung als abgeschlossen.
        setCheckoutFehler(info.error ?? "Speichern fehlgeschlagen. Bitte erneut versuchen.");
        return;
      }

      const { bestellung } = await res.json();
      setBeleg(bestellung as BelegDTO);
      // Neuer Idempotenzschlüssel für die nächste Bestellung.
      clientRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      warenkorbLeeren();
      setPanelOffen(false);
      // Katalog auffrischen (Preise könnten sich geändert haben).
      if (bereichId) ladeDaten(bereichId, false);
    } catch {
      setCheckoutFehler("Netzwerkfehler – Bestellung wurde NICHT gespeichert. Bitte erneut versuchen.");
    } finally {
      setSpeichern(false);
    }
  }

  const kategorien = daten?.kategorien ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Kopfzeile */}
      <header className="shrink-0 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur px-2 sm:px-3 py-2 flex items-center gap-2 flex-wrap">
        <h1 className="text-base sm:text-lg font-semibold">Kasse</h1>
        <select
          value={bereichId ?? ""}
          onChange={(e) => setBereichId(e.target.value || null)}
          className="input max-w-[11rem] sm:max-w-[14rem] py-1.5 flex-1 min-w-0"
          aria-label="Verkaufsbereich"
        >
          {bereiche.length === 0 && <option value="">Kein aktiver Bereich</option>}
          {bereiche.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Uhr />
          <span
            className={`badge ${online ? "bg-brand-600/20 text-brand-50" : "bg-red-700/30 text-red-200"}`}
            title={online ? "Verbindung vorhanden" : "Keine Verbindung"}
          >
            <span
              className={`mr-1 inline-block h-2 w-2 rounded-full ${online ? "bg-brand-DEFAULT" : "bg-red-500"}`}
            />
            <span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
          </span>
          <Link href="/admin" className="btn-ghost py-1.5 text-sm">
            Verwaltung
          </Link>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Produktbereich */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Suche + Kategorien */}
          <div className="shrink-0 p-3 space-y-2 border-b border-neutral-800">
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Produkt suchen …"
              className="input"
              type="search"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <FilterChip aktiv={katFilter === null} onClick={() => setKatFilter(null)}>
                Alle
              </FilterChip>
              {kategorien.map((k) => (
                <FilterChip
                  key={k.id}
                  aktiv={katFilter === k.id}
                  onClick={() => setKatFilter(k.id)}
                  farbe={k.farbe}
                >
                  {k.name}
                </FilterChip>
              ))}
            </div>
          </div>

          {/* Produktraster */}
          <div className="flex-1 overflow-y-auto p-3">
            {ladt && !daten ? (
              <p className="text-neutral-400 p-4">Lade Produkte …</p>
            ) : ladeFehler && !daten ? (
              <p className="text-red-300 p-4">{ladeFehler}</p>
            ) : gefilterteProdukte.length === 0 ? (
              <p className="text-neutral-400 p-4">
                Keine Produkte {suche ? "für die Suche " : ""}verfügbar.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {gefilterteProdukte.map((p) => (
                  <ProduktKachel
                    key={p.id}
                    produkt={p}
                    menge={warenkorb[p.id]?.menge ?? 0}
                    onClick={() => hinzufuegen(p)}
                  />
                ))}
              </div>
            )}
            {ladeFehler && daten && (
              <p className="mt-3 text-xs text-amber-300">
                Hinweis: {ladeFehler} Es werden zuletzt geladene Daten angezeigt.
              </p>
            )}
          </div>
        </main>

        {/* Bestell-Sidebar (ab lg dauerhaft sichtbar) */}
        <aside className="hidden lg:flex w-96 shrink-0 border-l border-neutral-800 flex-col">
          <BestellPanel
            warenkorb={warenkorb}
            summe={summe}
            erhaltenText={erhaltenText}
            onErhaltenChange={setErhaltenText}
            onMenge={mengeAendern}
            onEntfernen={entfernen}
            onLeeren={leerenMitFrage}
            onAbschliessen={abschliessen}
            speichern={speichern}
            online={online}
            checkoutFehler={checkoutFehler}
          />
        </aside>
      </div>

      {/* Mobile: fixierte Leiste unten mit Gesamtsumme + Warenkorb öffnen */}
      <div className="lg:hidden shrink-0 border-t border-neutral-800 bg-neutral-900 p-2 flex items-center gap-2">
        <div className="flex-1">
          <div className="text-xs text-neutral-400">Gesamtsumme</div>
          <div className="text-xl font-semibold tabular-nums">{formatCent(summe)}</div>
        </div>
        <button
          className="btn-primary flex-1"
          onClick={() => setPanelOffen(true)}
          disabled={artikelAnzahl === 0}
        >
          Bestellung ({artikelAnzahl})
        </button>
      </div>

      {/* Mobile: Bottom-Sheet für die Bestellung */}
      {panelOffen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col">
          <button
            className="flex-1 bg-black/60"
            aria-label="Schließen"
            onClick={() => setPanelOffen(false)}
          />
          <div className="max-h-[85dvh] bg-neutral-900 rounded-t-2xl border-t border-neutral-800 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-neutral-800">
              <h2 className="font-semibold">Aktuelle Bestellung</h2>
              <button className="btn-ghost py-1.5" onClick={() => setPanelOffen(false)}>
                Schließen
              </button>
            </div>
            <BestellPanel
              warenkorb={warenkorb}
              summe={summe}
              erhaltenText={erhaltenText}
              onErhaltenChange={setErhaltenText}
              onMenge={mengeAendern}
              onEntfernen={entfernen}
              onLeeren={leerenMitFrage}
              onAbschliessen={abschliessen}
              speichern={speichern}
              online={online}
              checkoutFehler={checkoutFehler}
            />
          </div>
        </div>
      )}

      {/* Beleg / Bestätigung */}
      {beleg && <BelegOverlay beleg={beleg} onSchliessen={() => setBeleg(null)} />}
    </div>
  );
}

/** Aktuelle Uhrzeit im Kopf (Spec §13). Aktualisiert jede Minute. */
function Uhr() {
  const [zeit, setZeit] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setZeit(new Date().toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const iv = window.setInterval(tick, 15000);
    return () => window.clearInterval(iv);
  }, []);
  return (
    <span className="hidden sm:inline text-sm tabular-nums text-neutral-400" suppressHydrationWarning>
      {zeit}
    </span>
  );
}

function FilterChip({
  children,
  aktiv,
  onClick,
  farbe,
}: {
  children: React.ReactNode;
  aktiv: boolean;
  onClick: () => void;
  farbe?: string | null;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 min-h-touch text-sm font-medium border transition ${
        aktiv
          ? "bg-brand-600 border-brand-600 text-white"
          : "bg-neutral-800 border-neutral-700 text-neutral-200"
      }`}
      style={!aktiv && farbe ? { borderColor: farbe } : undefined}
    >
      {children}
    </button>
  );
}

function ProduktKachel({
  produkt,
  menge,
  onClick,
}: {
  produkt: ProduktDTO;
  menge: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`card relative p-3 text-left flex flex-col justify-between min-h-[6.5rem] active:scale-[0.98] transition hover:border-brand-600 ${
        menge > 0 ? "ring-2 ring-brand-600 border-brand-600" : ""
      }`}
    >
      {menge > 0 && (
        <span className="absolute top-2 right-2 badge bg-brand-600 text-white tabular-nums text-sm">
          {menge}×
        </span>
      )}
      <div className="flex items-start gap-2">
        {produkt.bildUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={produkt.bildUrl}
            alt=""
            className="h-8 w-8 rounded object-cover shrink-0 bg-neutral-800"
          />
        ) : produkt.icon ? (
          <span className="text-2xl leading-none shrink-0">{produkt.icon}</span>
        ) : null}
        <span className="font-medium leading-tight pr-6">{produkt.name}</span>
      </div>
      <span className="mt-2 text-lg font-semibold tabular-nums text-brand-50">
        {formatCent(produkt.preisCent)}
      </span>
    </button>
  );
}

function BestellPanel(props: {
  warenkorb: Warenkorb;
  summe: number;
  erhaltenText: string;
  onErhaltenChange: (t: string) => void;
  onMenge: (id: string, delta: number) => void;
  onEntfernen: (id: string) => void;
  onLeeren: () => void;
  onAbschliessen: () => void;
  speichern: boolean;
  online: boolean;
  checkoutFehler: string | null;
}) {
  const positionen = Object.values(props.warenkorb);
  const leer = positionen.length === 0;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Positionsliste */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {leer ? (
          <p className="text-neutral-500 text-sm p-4 text-center">Noch keine Artikel gewählt.</p>
        ) : (
          positionen.map((p) => (
            <div key={p.produktId} className="card p-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-neutral-400 tabular-nums">
                  {formatCent(p.einzelpreisCent)} × {p.menge} ={" "}
                  {formatCent(p.einzelpreisCent * p.menge)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="btn-ghost h-9 w-9 !px-0 !min-h-0"
                  onClick={() => props.onMenge(p.produktId, -1)}
                  aria-label="Menge verringern"
                >
                  –
                </button>
                <span className="w-7 text-center tabular-nums">{p.menge}</span>
                <button
                  className="btn-ghost h-9 w-9 !px-0 !min-h-0"
                  onClick={() => props.onMenge(p.produktId, +1)}
                  aria-label="Menge erhöhen"
                >
                  +
                </button>
                <button
                  className="btn-ghost h-9 w-9 !px-0 !min-h-0 text-red-300"
                  onClick={() => props.onEntfernen(p.produktId)}
                  aria-label="Entfernen"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summe + Geldrechner + Abschluss */}
      <div className="shrink-0 border-t border-neutral-800 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-neutral-300">Gesamtsumme</span>
          <span className="text-2xl font-bold tabular-nums">{formatCent(props.summe)}</span>
        </div>

        {!leer && (
          <Geldrechner
            summeCent={props.summe}
            erhaltenText={props.erhaltenText}
            onErhaltenChange={props.onErhaltenChange}
          />
        )}

        {props.checkoutFehler && (
          <p role="alert" className="text-sm text-red-300 bg-red-950/50 rounded-lg px-3 py-2">
            {props.checkoutFehler}
          </p>
        )}

        <div className="flex gap-2">
          <button className="btn-ghost" onClick={props.onLeeren} disabled={leer || props.speichern}>
            Leeren
          </button>
          <button
            className="btn-primary flex-1"
            onClick={props.onAbschliessen}
            disabled={leer || props.speichern || !props.online}
          >
            {props.speichern
              ? "Speichere …"
              : !props.online
                ? "Offline – gesperrt"
                : "Kassieren"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BelegOverlay({ beleg, onSchliessen }: { beleg: BelegDTO; onSchliessen: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-sm p-5 space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-50 text-2xl">
            ✓
          </div>
          <h2 className="text-lg font-semibold">Bestellung gespeichert</h2>
          <p className="text-neutral-400 text-sm">Bestell-Nr. {beleg.nummer}</p>
        </div>

        <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
          {beleg.positionen.map((p, i) => (
            <div key={i} className="flex justify-between tabular-nums">
              <span className="truncate pr-2">
                {p.menge}× {p.produktName}
              </span>
              <span>{formatCent(p.summeCent)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-800 pt-3 space-y-1 text-sm tabular-nums">
          <div className="flex justify-between font-semibold text-base">
            <span>Summe</span>
            <span>{formatCent(beleg.summeCent)}</span>
          </div>
          {beleg.erhaltenCent !== null && (
            <div className="flex justify-between text-neutral-400">
              <span>Erhalten</span>
              <span>{formatCent(beleg.erhaltenCent)}</span>
            </div>
          )}
          {beleg.rueckgeldCent !== null && (
            <div className="flex justify-between text-brand-50">
              <span>Rückgeld</span>
              <span>{formatCent(beleg.rueckgeldCent)}</span>
            </div>
          )}
        </div>

        <button className="btn-primary w-full" onClick={onSchliessen}>
          Nächste Bestellung
        </button>
      </div>
    </div>
  );
}
