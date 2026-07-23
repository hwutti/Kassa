"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";
import { RollenHeader } from "@/components/rolle/RollenHeader";
import { useDialog } from "@/components/ui/DialogProvider";
import { useLive } from "@/lib/useLive";
import { ZahlModal } from "@/components/rolle/ZahlModal";
import { BelegUebersicht, type Beleg } from "@/components/rolle/BelegUebersicht";
import { StatusKopf, ZahlungBadge, BereichChip } from "@/components/rolle/StatusUi";
import { Kpi } from "@/components/ui/Kpi";
import { InstallButton } from "@/components/kasse/InstallButton";
import { druckeBon, type BonDaten } from "@/lib/bon";
import { minutenSeit } from "@/lib/zeit";
import { uuid } from "@/lib/id";

type Kat = { id: string; name: string; farbe: string | null; icon: string | null };
type Prod = { id: string; name: string; preisCent: number; icon: string | null; bildUrl: string | null; barcode: string | null; kategorieId: string };
type Pos = { produktId: string; name: string; preisCent: number; menge: number };
type MeineBestellung = {
  id: string;
  nummer: number;
  tisch: string | null;
  gast: string | null;
  abholnummer: string | null;
  verkaeufer?: string;
  summeCent: number;
  bestellStatus: string;
  zahlungStatus: string;
  auslieferungStatus: string;
  createdAt?: string;
  bereiche: { name: string; status: string }[];
  positionen: { produktName: string; menge: number; einzelpreisCent: number; summeCent: number }[];
};
// Woraus die vorläufige Rechnung stammt: frischer Direktverkauf oder Zahlung einer bestehenden Bestellung.
type BelegKontext =
  | { typ: "direkt" }
  | { typ: "zahlung"; bestellungId: string; nummer: number; tisch: string | null; verkaeufer: string | null };


export function KellnerClient() {
  const dialog = useDialog();
  const [tab, setTab] = useState<"neu" | "meine" | "ausgabe">("neu");

  // Produkte / Warenkorb
  const [kategorien, setKategorien] = useState<Kat[]>([]);
  const [produkte, setProdukte] = useState<Prod[]>([]);
  const [katFilter, setKatFilter] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [korb, setKorb] = useState<Record<string, Pos>>({});
  const [tisch, setTisch] = useState("");
  const [gast, setGast] = useState("");
  const [notiz, setNotiz] = useState("");
  const [senden, setSenden] = useState(false);
  const clientRef = useRef(uuid());

  // Meine Bestellungen + geteilte Ausgabe-Liste
  const [meine, setMeine] = useState<MeineBestellung[]>([]);
  const [ausgabe, setAusgabe] = useState<MeineBestellung[]>([]);
  const [erledigtHeute, setErledigtHeute] = useState(0);
  const [darfZahlen, setDarfZahlen] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Bezahl-Modal (Kassieren einer bestehenden Bestellung)
  const [zahlFuer, setZahlFuer] = useState<MeineBestellung | null>(null);
  const [sumupKey, setSumupKey] = useState<string | null>(null);
  const [bonAutoDruck, setBonAutoDruck] = useState(false);

  // Ablauf fürs Fest (aus der Verwaltung). SZENARIO_1 = ein Kellner macht alles;
  // SZENARIO_2 = aufnehmen + sofort kassieren, Läufer liefert aus.
  const [bedienungsmodus, setBedienungsmodus] = useState<"SZENARIO_1" | "SZENARIO_2">("SZENARIO_1");
  // Verkaufsart auf dem "Neue Bestellung"-Tab: Bedienung (Tisch) oder Direkt (Tresen).
  const [verkaufsart, setVerkaufsart] = useState<"bedienung" | "direkt">("bedienung");
  const [direktOffen, setDirektOffen] = useState(false);
  // Einheitlicher Abschluss (wie am Tresen): vorläufige Rechnung + Kontext (woher) + Abschluss.
  const [beleg, setBeleg] = useState<Beleg | null>(null);
  const [belegKontext, setBelegKontext] = useState<BelegKontext | null>(null);
  const [abschlussLaedt, setAbschlussLaedt] = useState(false);
  const [abschlussFehler, setAbschlussFehler] = useState<string | null>(null);
  const [konfig, setKonfig] = useState<{ titel: string; untertitel: string | null; logoUrl: string | null }>({
    titel: "Kirchtag",
    untertitel: null,
    logoUrl: null,
  });

  useEffect(() => {
    jsonFetch<{ kategorien: Kat[]; produkte: Prod[] }>("/api/kellner/produkte")
      .then((d) => {
        setKategorien(d.kategorien);
        setProdukte(d.produkte);
      })
      .catch((e) => setFehler((e as Error).message));
    jsonFetch<{ sumupAffiliateKey: string | null; bedienungsmodus?: string; bonAutoDruck?: boolean }>("/api/kasse/konfig")
      .then((k) => {
        setSumupKey(k.sumupAffiliateKey);
        setBonAutoDruck(k.bonAutoDruck === true);
        if (k.bedienungsmodus === "SZENARIO_2") setBedienungsmodus("SZENARIO_2");
      })
      .catch(() => undefined);
    jsonFetch<{ titel?: string; untertitel?: string | null; logoUrl?: string | null; aktiveVeranstaltung?: { name: string } | null }>(
      "/api/konfiguration",
    )
      .then((k) =>
        setKonfig({ titel: k.titel || "Kirchtag", untertitel: k.aktiveVeranstaltung?.name ?? k.untertitel ?? null, logoUrl: k.logoUrl ?? null }),
      )
      .catch(() => undefined);
  }, []);

  const ladeMeine = useCallback(async () => {
    try {
      const d = await jsonFetch<{ bestellungen: MeineBestellung[]; erledigtHeute: number; darfZahlen: boolean }>(
        "/api/kellner/bestellungen",
      );
      setMeine(d.bestellungen);
      setErledigtHeute(d.erledigtHeute);
      setDarfZahlen(d.darfZahlen);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, []);
  const ladeAusgabe = useCallback(async () => {
    try {
      const d = await jsonFetch<{ bestellungen: MeineBestellung[] }>("/api/kellner/ausgabe");
      setAusgabe(d.bestellungen);
    } catch {
      /* Ausgabe-Liste ist ergänzend; Fehler nicht hart anzeigen */
    }
  }, []);
  const aktualisieren = useCallback(() => {
    ladeMeine();
    ladeAusgabe();
  }, [ladeMeine, ladeAusgabe]);
  useEffect(() => {
    aktualisieren();
  }, [aktualisieren]);
  useLive(aktualisieren);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return produkte.filter((p) => {
      if (katFilter && p.kategorieId !== katFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [produkte, katFilter, suche]);
  const positionen = Object.values(korb);
  const summe = positionen.reduce((s, p) => s + p.preisCent * p.menge, 0);
  const anzahl = positionen.reduce((s, p) => s + p.menge, 0);

  function plus(p: Prod) {
    setKorb((k) => ({
      ...k,
      [p.id]: k[p.id]
        ? { ...k[p.id], menge: k[p.id].menge + 1 }
        : { produktId: p.id, name: p.name, preisCent: p.preisCent, menge: 1 },
    }));
  }
  function menge(id: string, d: number) {
    setKorb((k) => {
      const pos = k[id];
      if (!pos) return k;
      const m = pos.menge + d;
      if (m <= 0) {
        const rest = { ...k };
        delete rest[id];
        return rest;
      }
      return { ...k, [id]: { ...pos, menge: m } };
    });
  }

  async function absenden() {
    if (anzahl === 0 || senden) return;
    if (!tisch.trim()) {
      setFehler("Bitte einen Tisch / eine Abholnummer angeben – sonst ist unklar, wohin ausgegeben wird.");
      return;
    }
    setSenden(true);
    setFehler(null);
    try {
      const res = await jsonFetch<{ bestellung: { id: string; nummer: number; tisch: string | null; summeCent: number; bestellStatus: string } }>(
        "/api/kellner/bestellungen",
        {
          method: "POST",
          body: JSON.stringify({
            clientRef: clientRef.current,
            tisch: tisch.trim() || null,
            gast: gast.trim() || null,
            notiz: notiz.trim() || null,
            positionen: positionen.map((p) => ({ produktId: p.produktId, menge: p.menge })),
          }),
        },
      );
      const neu = res.bestellung;
      clientRef.current = uuid();
      setKorb({});
      setTisch("");
      setGast("");
      setNotiz("");
      setTab("meine");
      aktualisieren();
      // Szenario 2: sofort kassieren – Bezahl-Dialog für die neue Bestellung öffnen.
      if (bedienungsmodus === "SZENARIO_2" && darfZahlen) {
        setZahlFuer({
          id: neu.id,
          nummer: neu.nummer,
          tisch: neu.tisch,
          gast: null,
          abholnummer: null,
          summeCent: neu.summeCent,
          bestellStatus: neu.bestellStatus,
          zahlungStatus: "UNPAID",
          auslieferungStatus: "NOT_READY",
          bereiche: [],
          positionen: positionen.map((p) => ({ produktName: p.name, menge: p.menge, einzelpreisCent: p.preisCent, summeCent: p.preisCent * p.menge })),
        });
      }
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setSenden(false);
    }
  }

  async function aktion(id: string, pfad: string, body?: unknown) {
    try {
      await jsonFetch(`/api/bestellungen/${id}/${pfad}`, { method: "POST", body: JSON.stringify(body ?? {}) });
      aktualisieren();
    } catch (e) {
      await dialog.alert({ titel: "Fehler", text: (e as Error).message });
    }
  }
  // Rückgeld für die Vorschau lokal berechnen (Server rechnet beim Buchen erneut).
  function rueckgeldVon(summeCent: number, gegebenCent: number | null, art: string): number | null {
    return art === "BAR" && gegebenCent != null && gegebenCent >= summeCent ? gegebenCent - summeCent : null;
  }

  // Schritt 1 – bestehende Bestellung kassieren: „Bezahlen" bucht NICHT, sondern
  // zeigt die komplette Rechnung zur Kontrolle (einheitlich wie am Tresen).
  function bezahlen(gegebenCent: number | null, art: string) {
    if (!zahlFuer) return;
    setBeleg({
      positionen: zahlFuer.positionen,
      summeCent: zahlFuer.summeCent,
      art,
      gegebenCent: art === "BAR" ? gegebenCent : null,
      rueckgeldCent: rueckgeldVon(zahlFuer.summeCent, gegebenCent, art),
    });
    setBelegKontext({ typ: "zahlung", bestellungId: zahlFuer.id, nummer: zahlFuer.nummer, tisch: zahlFuer.tisch ?? zahlFuer.abholnummer, verkaeufer: zahlFuer.verkaeufer ?? null });
    setAbschlussFehler(null);
    setZahlFuer(null);
  }

  // Schritt 1 – Direktverkauf/Tresen: dieselbe Rechnungsprüfung, Kontext „direkt".
  function bezahlenDirekt(gegebenCent: number | null, art: string) {
    if (anzahl === 0) return;
    setBeleg({
      positionen: positionen.map((p) => ({ produktName: p.name, menge: p.menge, einzelpreisCent: p.preisCent, summeCent: p.preisCent * p.menge })),
      summeCent: summe,
      art,
      gegebenCent: art === "BAR" ? gegebenCent : null,
      rueckgeldCent: rueckgeldVon(summe, gegebenCent, art),
    });
    setBelegKontext({ typ: "direkt" });
    setAbschlussFehler(null);
    setDirektOffen(false);
  }

  // „Korrigieren": zurück, es wird nichts gebucht.
  function belegKorrigieren() {
    setBeleg(null);
    setBelegKontext(null);
    setAbschlussFehler(null);
  }

  // Schritt 2 – jetzt buchen (erst hier entsteht die Zahlung/der Verkauf), optional drucken.
  async function belegAbschliessen(drucken: boolean) {
    if (!beleg || !belegKontext || abschlussLaedt) return;
    setAbschlussLaedt(true);
    setAbschlussFehler(null);
    try {
      const macheBon = drucken || bonAutoDruck;
      if (belegKontext.typ === "direkt") {
        const res = await jsonFetch<{ bestellung: { nummer: number; summeCent: number; erhaltenCent: number | null; rueckgeldCent: number | null; positionen: { produktName: string; menge: number; einzelpreisCent: number; summeCent: number }[] } }>(
          "/api/kellner/direktverkauf",
          {
            method: "POST",
            body: JSON.stringify({
              clientRef: clientRef.current,
              positionen: positionen.map((p) => ({ produktId: p.produktId, menge: p.menge })),
              gegebenCent: beleg.gegebenCent,
              art: beleg.art,
            }),
          },
        );
        const best = res.bestellung;
        if (macheBon) {
          druckeBon({
            titel: konfig.titel,
            untertitel: konfig.untertitel,
            logoUrl: konfig.logoUrl,
            nummer: best.nummer,
            datum: new Date().toLocaleString("de-AT"),
            positionen: best.positionen,
            summeCent: best.summeCent,
            art: beleg.art,
            gegebenCent: best.erhaltenCent,
            rueckgeldCent: best.rueckgeldCent,
          });
        }
        clientRef.current = uuid();
        setKorb({});
        setNotiz("");
      } else {
        const res = await jsonFetch<{ rueckgeldCent: number | null }>(`/api/bestellungen/${belegKontext.bestellungId}/zahlung`, {
          method: "POST",
          body: JSON.stringify({ gegebenCent: beleg.gegebenCent, art: beleg.art }),
        });
        if (macheBon) {
          druckeBon({
            titel: konfig.titel,
            untertitel: konfig.untertitel,
            logoUrl: konfig.logoUrl,
            nummer: belegKontext.nummer,
            datum: new Date().toLocaleString("de-AT"),
            verkaeufer: belegKontext.verkaeufer,
            tisch: belegKontext.tisch,
            positionen: beleg.positionen,
            summeCent: beleg.summeCent,
            art: beleg.art,
            gegebenCent: beleg.gegebenCent,
            rueckgeldCent: res?.rueckgeldCent ?? beleg.rueckgeldCent,
          });
        }
      }
      setBeleg(null);
      setBelegKontext(null);
      aktualisieren();
    } catch (e) {
      setAbschlussFehler((e as Error).message);
    } finally {
      setAbschlussLaedt(false);
    }
  }
  async function ausgeben(b: MeineBestellung) {
    const offene = b.bereiche.filter((a) => a.status !== "READY" && a.status !== "COLLECTED");
    if (offene.length > 0) {
      const ok = await dialog.confirm({
        titel: `Nr. ${b.nummer} ohne Zubereitung ausgeben?`,
        text: `Noch nicht fertig gemeldet: ${offene.map((a) => a.name).join(", ")}. Trotzdem ausgeben?`,
        bestaetigenText: "Ausgeben",
      });
      if (!ok) return;
    }
    aktion(b.id, "ausgeben");
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <RollenHeader titel="Verkauf">
        <div className="flex gap-1">
          <button className={`pill-tab ${tab === "neu" ? "on" : ""}`} onClick={() => setTab("neu")}>
            Neue Bestellung
          </button>
          <button className={`pill-tab ${tab === "meine" ? "on" : ""}`} onClick={() => setTab("meine")}>
            Meine ({meine.length})
          </button>
          {/* Szenario 2: gemeinsamer Läufer-Pool. In Szenario 1 liefert jeder seine eigenen (über „Meine"). */}
          {bedienungsmodus === "SZENARIO_2" && (
            <button className={`pill-tab ${tab === "ausgabe" ? "on" : ""}`} onClick={() => setTab("ausgabe")}>
              Ausgabe ({ausgabe.length})
            </button>
          )}
        </div>
        <InstallButton />
      </RollenHeader>

      {fehler && <p className="text-red-300 text-sm px-3 pt-2">{fehler}</p>}

      {tab === "neu" && (
        <div className="flex-1 flex min-h-0">
          <main className="flex-1 min-w-0 flex flex-col">
            <div className="shrink-0 p-3 border-b border-neutral-800 space-y-2">
              <input
                type="search"
                className="input"
                placeholder="Produkt suchen oder Barcode scannen …"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const code = suche.trim();
                  if (!code) return;
                  // Barcode-Scanner tippt den Code + Enter: exakter Treffer -> in den Korb.
                  const treffer = produkte.find((p) => p.barcode && p.barcode === code);
                  if (treffer) {
                    plus(treffer);
                    setSuche("");
                  }
                }}
              />
              <div className="flex gap-2 overflow-x-auto">
                <button className={`chip-cat ${!katFilter ? "on" : ""}`} onClick={() => setKatFilter(null)}>
                  Alle
                </button>
                {kategorien.map((k) => (
                  <button key={k.id} className={`chip-cat ${katFilter === k.id ? "on" : ""}`} onClick={() => setKatFilter(k.id)}>
                    {k.icon} {k.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {gefiltert.map((p) => (
                  <div
                    key={p.id}
                    className={`card p-0 overflow-hidden flex flex-col ${korb[p.id] ? "ring-2 ring-brand-600 border-brand-600" : ""}`}
                  >
                    {/* Großes Produktbild (oder Icon) – antippen legt in den Korb. */}
                    <button onClick={() => plus(p)} className="text-left active:scale-[.98] transition">
                      <div className="relative aspect-[4/3] bg-neutral-800 flex items-center justify-center">
                        {p.bildUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.bildUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <span className="text-4xl leading-none">{p.icon || "🍽️"}</span>
                        )}
                        {korb[p.id] && (
                          <span className="absolute top-1 right-1 badge bg-brand-600 text-white shadow">{korb[p.id].menge}×</span>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="font-medium leading-tight line-clamp-2">{p.name}</div>
                        <div className="mt-0.5 text-brand-50 font-semibold tabular-nums">{formatCent(p.preisCent)}</div>
                      </div>
                    </button>
                    {/* Menge direkt an der Kachel anpassen. */}
                    <div className="mt-auto flex items-center gap-1 p-1.5 border-t border-neutral-800">
                      <button
                        onClick={() => menge(p.id, -1)}
                        disabled={!korb[p.id]}
                        aria-label={`${p.name}: Menge verringern`}
                        className="h-10 flex-1 rounded-lg bg-neutral-800 text-xl font-semibold active:bg-neutral-700 disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-8 text-center tabular-nums font-semibold" aria-live="polite">
                        {korb[p.id]?.menge ?? 0}
                      </span>
                      <button
                        onClick={() => plus(p)}
                        aria-label={`${p.name}: Menge erhöhen`}
                        className="h-10 flex-1 rounded-lg bg-brand-600 text-white text-xl font-semibold active:bg-brand-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                {gefiltert.length === 0 && <p className="text-neutral-400 col-span-full p-4">Keine Produkte mit Preis.</p>}
              </div>
            </div>
          </main>

          <aside className="w-80 shrink-0 border-l border-neutral-800 flex flex-col">
            <div className="p-3 border-b border-neutral-800 space-y-2">
              {darfZahlen && (
                <div className="flex gap-1">
                  <button
                    className={`pill-tab flex-1 ${verkaufsart === "bedienung" ? "on" : ""}`}
                    onClick={() => setVerkaufsart("bedienung")}
                  >
                    Bedienung
                  </button>
                  <button
                    className={`pill-tab flex-1 ${verkaufsart === "direkt" ? "on" : ""}`}
                    onClick={() => setVerkaufsart("direkt")}
                  >
                    Direkt (Tresen)
                  </button>
                </div>
              )}
              {verkaufsart === "bedienung" ? (
                <>
                  <input
                    className={`input ${!tisch.trim() ? "border-amber-500/60" : ""}`}
                    placeholder="Tisch / Abholnr. (Pflicht)"
                    value={tisch}
                    onChange={(e) => setTisch(e.target.value)}
                    aria-label="Tisch oder Abholnummer (erforderlich)"
                  />
                  {!tisch.trim() && <p className="text-[11px] text-amber-300">Pflicht – damit klar ist, wohin ausgegeben wird.</p>}
                  <input className="input" placeholder="Gast (optional)" value={gast} onChange={(e) => setGast(e.target.value)} />
                </>
              ) : (
                <p className="text-[11px] text-neutral-400">Tresen: Kunde bestellt, bekommt &amp; zahlt direkt am Stand.</p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {positionen.length === 0 ? (
                <p className="text-neutral-500 text-sm text-center p-4">Produkte antippen …</p>
              ) : (
                positionen.map((p) => (
                  <div key={p.produktId} className="card p-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-neutral-400 tabular-nums">
                        {formatCent(p.preisCent)} × {p.menge}
                      </div>
                    </div>
                    <button className="btn-ghost h-8 w-8 !px-0 !min-h-0" onClick={() => menge(p.produktId, -1)}>–</button>
                    <span className="w-6 text-center tabular-nums">{p.menge}</span>
                    <button className="btn-ghost h-8 w-8 !px-0 !min-h-0" onClick={() => menge(p.produktId, +1)}>+</button>
                  </div>
                ))
              )}
              {positionen.length > 0 && (
                <input className="input" placeholder="Notiz (optional)" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
              )}
            </div>
            <div className="shrink-0 border-t border-neutral-800 p-3 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-neutral-300">Gesamt</span>
                <span className="text-xl font-bold tabular-nums">{formatCent(summe)}</span>
              </div>
              {verkaufsart === "direkt" ? (
                <button
                  className="btn-primary w-full"
                  onClick={() => {
                    if (anzahl === 0) return;
                    setDirektOffen(true);
                  }}
                  disabled={anzahl === 0}
                >
                  Kassieren ({formatCent(summe)})
                </button>
              ) : (
                <button className="btn-primary w-full" onClick={absenden} disabled={anzahl === 0 || !tisch.trim() || senden}>
                  {senden ? "Sende …" : !tisch.trim() && anzahl > 0 ? "Erst Tisch angeben" : `Bestellung absenden (${anzahl})`}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {tab === "meine" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Übersicht: Kennzahlen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi label="Offen" wert={meine.length} />
            <Kpi label="Abholbereit" wert={meine.filter((b) => b.auslieferungStatus === "READY_FOR_PICKUP").length} ton="gut" />
            <Kpi label="Zahlung offen" wert={meine.filter((b) => b.zahlungStatus !== "PAID").length} ton="warnung" />
            <Kpi label="Heute erledigt" wert={erledigtHeute} />
          </div>

          {meine.length === 0 && (
            <p className="text-neutral-400 text-center py-8">Keine offenen Bestellungen. 🎉</p>
          )}
          {meine.map((b) => {
            const ausgeliefert = b.auslieferungStatus === "DELIVERED";
            const bezahlt = b.zahlungStatus === "PAID";
            return (
              <div key={b.id} className="card p-0 overflow-hidden">
                <StatusKopf status={b.bestellStatus} minuten={minutenSeit(b.createdAt)} />
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-base">
                      Nr. {b.nummer}
                      {b.tisch ? ` · Tisch ${b.tisch}` : b.abholnummer ? ` · Nr. ${b.abholnummer}` : ""}
                      {b.gast ? ` · ${b.gast}` : ""}
                    </span>
                    <ZahlungBadge bezahlt={bezahlt} />
                  </div>
                  {b.bereiche.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {b.bereiche.map((a, i) => (
                        <BereichChip key={i} name={a.name} status={a.status} />
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-neutral-50 tabular-nums">{formatCent(b.summeCent)}</span>
                    {ausgeliefert && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full ring-1 bg-teal-500/25 text-teal-50 ring-teal-400/50">
                        Ausgeliefert ✓
                      </span>
                    )}
                    <div className="ml-auto flex gap-2">
                      {!bezahlt && darfZahlen && (
                        <button className="btn-ghost py-1.5 text-sm" onClick={() => setZahlFuer(b)}>
                          Kassieren
                        </button>
                      )}
                      {!ausgeliefert && (
                        <button className="btn-primary py-1.5 text-sm" onClick={() => ausgeben(b)}>
                          Ausgeben
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "ausgabe" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <p className="text-sm text-neutral-400">
            Abholbereite Bestellungen – jeder Kellner kann sie ausgeben (holen &amp; zum Tisch bringen).
          </p>
          {ausgabe.length === 0 && (
            <p className="text-neutral-400 text-center py-8">Nichts abholbereit. 🎉</p>
          )}
          {ausgabe.map((b) => {
            const bezahlt = b.zahlungStatus === "PAID";
            return (
              <div key={b.id} className="card p-0 overflow-hidden">
                <StatusKopf status="READY_FOR_PICKUP" minuten={minutenSeit(b.createdAt)} />
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-base">
                      Nr. {b.nummer}
                      {b.tisch ? ` · Tisch ${b.tisch}` : b.abholnummer ? ` · Nr. ${b.abholnummer}` : ""}
                      {b.gast ? ` · ${b.gast}` : ""}
                    </span>
                    <ZahlungBadge bezahlt={bezahlt} />
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-neutral-50 tabular-nums">{formatCent(b.summeCent)}</span>
                    <span className="text-xs text-neutral-500">von {b.verkaeufer ?? "—"}</span>
                    <div className="ml-auto flex gap-2">
                      {!bezahlt && darfZahlen && (
                        <button className="btn-ghost py-1.5 text-sm" onClick={() => setZahlFuer(b)}>
                          Kassieren
                        </button>
                      )}
                      <button className="btn-primary py-1.5 text-sm" onClick={() => ausgeben(b)}>
                        Ausgeben
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zahlFuer && (
        <ZahlModal
          nummer={zahlFuer.nummer}
          summeCent={zahlFuer.summeCent}
          positionen={zahlFuer.positionen}
          laedt={false}
          fehler={null}
          sumupAffiliateKey={sumupKey}
          onAbbrechen={() => setZahlFuer(null)}
          onBezahlen={bezahlen}
        />
      )}

      {direktOffen && (
        <ZahlModal
          nummer={0}
          titel="Direktverkauf kassieren"
          summeCent={summe}
          positionen={positionen.map((p) => ({ produktName: p.name, menge: p.menge, einzelpreisCent: p.preisCent, summeCent: p.preisCent * p.menge }))}
          laedt={false}
          fehler={null}
          sumupAffiliateKey={sumupKey}
          onAbbrechen={() => setDirektOffen(false)}
          onBezahlen={bezahlenDirekt}
        />
      )}

      {beleg && (
        <BelegUebersicht
          beleg={beleg}
          laedt={abschlussLaedt}
          fehler={abschlussFehler}
          onKorrigieren={belegKorrigieren}
          onFertig={() => belegAbschliessen(false)}
          onDrucken={() => belegAbschliessen(true)}
        />
      )}
    </div>
  );
}
