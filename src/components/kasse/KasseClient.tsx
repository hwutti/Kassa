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
  type WarenkorbPosition,
} from "@/components/kasse/types";
import { Geldrechner } from "@/components/kasse/Geldrechner";
import { parseEuroToCent } from "@/lib/money";
import { useDialog } from "@/components/ui/DialogProvider";
import { InstallButton } from "@/components/kasse/InstallButton";

const BEREICH_KEY = "pos-kasse:verkaufsbereich";
const OFFENE_BESTELLUNG_KEY = "pos-kasse:offeneBestellung";

type BelegDTO = {
  id: string;
  nummer: number;
  summeCent: number;
  erhaltenCent: number | null;
  rueckgeldCent: number | null;
  positionen: { produktName: string; menge: number; einzelpreisCent: number; summeCent: number }[];
};

type KonfigDTO = {
  titel: string;
  untertitel: string | null;
  logoUrl: string | null;
  logoHoehe: number;
  aktiveVeranstaltung: { id: string; name: string } | null;
};

export function KasseClient() {
  const { online } = usePwaStatus();
  const dialog = useDialog();

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
  const [bezahlOffen, setBezahlOffen] = useState(false); // Bezahl-/Übersicht-Modal

  const [speichern, setSpeichern] = useState(false);
  const [checkoutFehler, setCheckoutFehler] = useState<string | null>(null);
  const [beleg, setBeleg] = useState<BelegDTO | null>(null);
  const [konfig, setKonfig] = useState<KonfigDTO | null>(null);

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

  // Header-Konfiguration (Logo, Titel, aktive Veranstaltung) laden.
  useEffect(() => {
    let aktiv = true;
    fetch("/api/konfiguration", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((k) => aktiv && k && setKonfig(k))
      .catch(() => undefined);
    return () => {
      aktiv = false;
    };
  }, [online]);

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
    // Bereich, unter dem hinzugefügt wird (für positionsgenaue Abrechnung).
    const bId = daten?.verkaufsbereich.id ?? bereichId ?? "";
    setWarenkorb((korb) => {
      const vorhanden = korb[p.id];
      return {
        ...korb,
        [p.id]: vorhanden
          ? { ...vorhanden, menge: vorhanden.menge + 1 }
          : ausProdukt(p, bId),
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
  async function leerenMitFrage() {
    if (artikelAnzahl === 0) return;
    const ok = await dialog.confirm({
      titel: "Bestellung leeren",
      text: "Aktuelle Bestellung wirklich leeren?",
      bestaetigenText: "Leeren",
      gefahr: true,
    });
    if (!ok) return;
    warenkorbLeeren();
  }

  const summe = korbSumme(warenkorb);
  const artikelAnzahl = anzahlArtikel(warenkorb);

  // "Kassieren" öffnet zunächst das Bezahl-/Übersichts-Modal (noch nicht speichern).
  function kassierenOeffnen() {
    if (artikelAnzahl === 0) return;
    setCheckoutFehler(null);
    setBezahlOffen(true);
  }

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
            verkaufsbereichId: p.verkaufsbereichId,
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
      setBezahlOffen(false);
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
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={konfig?.logoUrl || "/logo.svg"}
            alt=""
            style={{ height: konfig?.logoHoehe ?? 48 }}
            className="w-auto max-w-[45vw] sm:max-w-[280px] object-contain shrink-0"
          />
          <div className="min-w-0 leading-tight">
            <div className="text-base sm:text-lg font-semibold truncate">
              {konfig?.titel ?? "Kasse"}
            </div>
            {konfig?.aktiveVeranstaltung && (
              <div className="text-[11px] text-brand-50/80 truncate">
                {konfig.aktiveVeranstaltung.name}
              </div>
            )}
          </div>
        </div>
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
          <InstallButton />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {gefilterteProdukte.map((p) => (
                  <ProduktKachel
                    key={p.id}
                    produkt={p}
                    menge={warenkorb[p.id]?.menge ?? 0}
                    onPlus={() => hinzufuegen(p)}
                    onMinus={() => mengeAendern(p.id, -1)}
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
        <aside className="hidden md:flex w-80 lg:w-96 shrink-0 border-l border-neutral-800 flex-col">
          <BestellPanel
            warenkorb={warenkorb}
            summe={summe}
            erhaltenText={erhaltenText}
            onErhaltenChange={setErhaltenText}
            onMenge={mengeAendern}
            onEntfernen={entfernen}
            onLeeren={leerenMitFrage}
            onKassieren={kassierenOeffnen}
          />
        </aside>
      </div>

      {/* Mobile: fixierte Leiste unten mit Gesamtsumme + Warenkorb öffnen */}
      <div className="md:hidden shrink-0 border-t border-neutral-800 bg-neutral-900 p-2 flex items-center gap-2">
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
        <div className="md:hidden fixed inset-0 z-40 flex flex-col">
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
              onKassieren={kassierenOeffnen}
            />
          </div>
        </div>
      )}

      {/* Bezahl-/Übersichts-Modal (öffnet mit „Kassieren", speichert erst bei „Bezahlen") */}
      {bezahlOffen && !beleg && (
        <BezahlModal
          positionen={Object.values(warenkorb)}
          summe={summe}
          erhaltenText={erhaltenText}
          online={online}
          speichern={speichern}
          fehler={checkoutFehler}
          onAbbrechen={() => setBezahlOffen(false)}
          onBezahlen={abschliessen}
        />
      )}

      {/* Beleg / Bestätigung */}
      {beleg && <BelegOverlay beleg={beleg} onSchliessen={() => setBeleg(null)} />}
    </div>
  );
}

/** Aktuelles Datum + Uhrzeit im Kopf (Spec §13). Aktualisiert regelmäßig. */
function Uhr() {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    const tick = () => {
      const jetzt = new Date();
      const datum = jetzt.toLocaleDateString("de-AT", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const zeit = jetzt.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
      setText(`${datum} · ${zeit}`);
    };
    tick();
    const iv = window.setInterval(tick, 15000);
    return () => window.clearInterval(iv);
  }, []);
  return (
    <span
      className="hidden md:inline text-sm tabular-nums text-neutral-400 whitespace-nowrap"
      suppressHydrationWarning
    >
      {text}
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
  onPlus,
  onMinus,
}: {
  produkt: ProduktDTO;
  menge: number;
  onPlus: () => void;
  onMinus: () => void;
}) {
  return (
    <div
      className={`card relative p-3 flex flex-col justify-between min-h-[7.5rem] transition ${
        menge > 0 ? "ring-2 ring-brand-600 border-brand-600" : "hover:border-brand-600"
      }`}
    >
      {/* Hauptfläche: ein Tipp fügt hinzu. */}
      <button onClick={onPlus} className="text-left active:scale-[0.98] transition">
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
          <span className="font-medium leading-tight">{produkt.name}</span>
        </div>
        <span className="mt-2 block text-lg font-semibold tabular-nums text-brand-50">
          {formatCent(produkt.preisCent)}
        </span>
      </button>

      {/* Mengensteuerung direkt in der Kachel (Touch-tauglich). */}
      <div className="mt-2 flex items-center gap-1">
        <button
          onClick={onMinus}
          disabled={menge === 0}
          aria-label={`${produkt.name}: Menge verringern`}
          className="flex-1 h-10 rounded-lg bg-neutral-800 text-xl font-semibold active:bg-neutral-700 disabled:opacity-30"
        >
          −
        </button>
        <span className="w-9 text-center tabular-nums font-semibold text-lg" aria-live="polite">
          {menge}
        </span>
        <button
          onClick={onPlus}
          aria-label={`${produkt.name}: Menge erhöhen`}
          className="flex-1 h-10 rounded-lg bg-brand-600 text-white text-xl font-semibold active:bg-brand-700"
        >
          +
        </button>
      </div>
    </div>
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
  onKassieren: () => void;
}) {
  const positionen = Object.values(props.warenkorb);
  const leer = positionen.length === 0;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Scrollbarer Bereich: Positionsliste + Geldrechner.
          So bleibt der Abschluss unten bei jeder Bildschirmgröße erreichbar. */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 min-h-0">
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

        {!leer && (
          <div className="border-t border-neutral-800 pt-2">
            <Geldrechner
              summeCent={props.summe}
              erhaltenText={props.erhaltenText}
              onErhaltenChange={props.onErhaltenChange}
            />
          </div>
        )}
      </div>

      {/* Fix angepinnter Fuß: Gesamtsumme + Abschluss (immer sichtbar). */}
      <div className="shrink-0 border-t border-neutral-800 p-2 sm:p-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-neutral-300">Gesamtsumme</span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums">{formatCent(props.summe)}</span>
        </div>

        <div className="flex gap-2">
          <button className="btn-ghost" onClick={props.onLeeren} disabled={leer}>
            Leeren
          </button>
          <button className="btn-primary flex-1" onClick={props.onKassieren} disabled={leer}>
            Kassieren
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Bezahl-/Übersichts-Modal. Öffnet sich mit „Kassieren" und zeigt die komplette
 * Bestellung übersichtlich. Erst „Bezahlen" speichert (danach „Bestellung gespeichert").
 */
function BezahlModal(props: {
  positionen: WarenkorbPosition[];
  summe: number;
  erhaltenText: string;
  online: boolean;
  speichern: boolean;
  fehler: string | null;
  onAbbrechen: () => void;
  onBezahlen: () => void;
}) {
  const erhaltenCent = parseEuroToCent(props.erhaltenText);
  const rueckgeldCent =
    erhaltenCent !== null && erhaltenCent >= props.summe ? erhaltenCent - props.summe : null;
  const zuWenig = erhaltenCent !== null && erhaltenCent < props.summe;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md max-h-[92dvh] flex flex-col">
        <div className="shrink-0 p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold">Bestellung – Übersicht</h2>
          <p className="text-sm text-neutral-400">Bitte prüfen und bezahlen.</p>
        </div>

        {/* Positionen */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-0">
          {props.positionen.map((p) => (
            <div key={p.produktId} className="flex justify-between gap-2 tabular-nums">
              <span className="min-w-0">
                <span className="font-medium">{p.menge}×</span> {p.name}
                <span className="text-neutral-500 text-sm"> ({formatCent(p.einzelpreisCent)})</span>
              </span>
              <span className="shrink-0">{formatCent(p.einzelpreisCent * p.menge)}</span>
            </div>
          ))}
        </div>

        {/* Summe + Geld */}
        <div className="shrink-0 border-t border-neutral-800 p-4 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-neutral-300">Gesamtsumme</span>
            <span className="text-2xl font-bold tabular-nums">{formatCent(props.summe)}</span>
          </div>
          {erhaltenCent !== null && (
            <div className="flex justify-between text-sm text-neutral-400 tabular-nums">
              <span>Erhalten</span>
              <span>{formatCent(erhaltenCent)}</span>
            </div>
          )}
          {rueckgeldCent !== null && (
            <div className="flex justify-between text-lg font-semibold text-brand-50 tabular-nums">
              <span>Rückgeld</span>
              <span>{formatCent(rueckgeldCent)}</span>
            </div>
          )}
          {zuWenig && (
            <p className="text-sm text-amber-300">
              Betrag zu niedrig – es fehlen {formatCent(props.summe - (erhaltenCent ?? 0))}.
            </p>
          )}

          {props.fehler && (
            <p role="alert" className="text-sm text-red-300 bg-red-950/50 rounded-lg px-3 py-2">
              {props.fehler}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1" onClick={props.onAbbrechen} disabled={props.speichern}>
              Ändern
            </button>
            <button
              className="btn-primary flex-1"
              onClick={props.onBezahlen}
              disabled={props.speichern || !props.online}
            >
              {props.speichern
                ? "Speichere …"
                : !props.online
                  ? "Offline – gesperrt"
                  : "Bezahlt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BelegOverlay({ beleg, onSchliessen }: { beleg: BelegDTO; onSchliessen: () => void }) {
  const [stornoOffen, setStornoOffen] = useState(false);
  const [grund, setGrund] = useState("");
  const [passwort, setPasswort] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [storniert, setStorniert] = useState(false);

  async function stornieren() {
    if (!grund.trim()) {
      setFehler("Bitte einen Grund angeben.");
      return;
    }
    setLaedt(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/bestellungen/${beleg.id}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grund: grund.trim(), passwort: passwort || undefined }),
      });
      const info = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFehler(info.error ?? "Storno fehlgeschlagen.");
        return;
      }
      setStorniert(true);
      setStornoOffen(false); // Storno-Formular schließen, damit „Nächste Bestellung" wieder erscheint
    } catch {
      setFehler("Netzwerkfehler – Storno nicht gespeichert.");
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-sm p-5 space-y-4">
        <div className="text-center">
          <div
            className={`mx-auto mb-2 h-12 w-12 rounded-full flex items-center justify-center text-2xl ${
              storniert ? "bg-red-600/20 text-red-300" : "bg-brand-600/20 text-brand-50"
            }`}
          >
            {storniert ? "↩" : "✓"}
          </div>
          <h2 className="text-lg font-semibold">
            {storniert ? "Bestellung storniert" : "Bestellung gespeichert"}
          </h2>
          <p className="text-neutral-400 text-sm">Bestell-Nr. {beleg.nummer}</p>
        </div>

        <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
          {beleg.positionen.map((p, i) => (
            <div key={i} className={`flex justify-between tabular-nums ${storniert ? "line-through text-neutral-500" : ""}`}>
              <span className="truncate pr-2">
                {p.menge}× {p.produktName}
              </span>
              <span>{formatCent(p.summeCent)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-neutral-800 pt-3 space-y-1 text-sm tabular-nums">
          <div className={`flex justify-between font-semibold text-base ${storniert ? "line-through text-neutral-500" : ""}`}>
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

        {/* Storno-Formular */}
        {stornoOffen && !storniert && (
          <div className="space-y-2 border-t border-neutral-800 pt-3">
            <input
              className="input"
              placeholder="Storno-Grund (z. B. Fehleingabe)"
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              autoFocus
            />
            <input
              className="input"
              type="password"
              placeholder="Admin-Passwort (falls nicht angemeldet)"
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              autoComplete="off"
            />
            {fehler && <p className="text-sm text-red-300">{fehler}</p>}
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setStornoOffen(false)} disabled={laedt}>
                Zurück
              </button>
              <button className="btn-danger flex-1" onClick={stornieren} disabled={laedt}>
                {laedt ? "Storniere …" : "Storno bestätigen"}
              </button>
            </div>
          </div>
        )}

        {/* Aktionen */}
        {!stornoOffen && (
          <div className="flex gap-2">
            {!storniert && (
              <button className="btn-ghost text-red-300" onClick={() => setStornoOffen(true)}>
                Stornieren
              </button>
            )}
            <button className="btn-primary flex-1" onClick={onSchliessen}>
              Nächste Bestellung
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
