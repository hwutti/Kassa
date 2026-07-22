"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";
import { ZahlModal } from "@/components/rolle/ZahlModal";
import { BelegUebersicht, type Beleg } from "@/components/rolle/BelegUebersicht";
import { druckeBon, type BonDaten } from "@/lib/bon";

type Kat = { id: string; name: string; farbe: string | null; icon: string | null };
type Prod = { id: string; name: string; preisCent: number; icon: string | null; bildUrl: string | null; barcode: string | null; kategorieId: string };
type Pos = { produktId: string; name: string; preisCent: number; menge: number };

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Direktverkauf/Tresen-Panel: Kunde bestellt direkt am Stand, bekommt alles dort
 * und zahlt sofort – alles in EINEM Schritt (ohne Tisch, ohne Küchenticket,
 * ohne Ausgabe-Liste). Wird sowohl im Verkauf als auch im Bereich verwendet.
 * Erfordert Kassenrecht (serverseitig geprüft).
 */
export function DirektverkaufPanel() {
  const [kategorien, setKategorien] = useState<Kat[]>([]);
  const [produkte, setProdukte] = useState<Prod[]>([]);
  const [katFilter, setKatFilter] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [korb, setKorb] = useState<Record<string, Pos>>({});
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const clientRef = useRef(uuid());

  const [offen, setOffen] = useState(false);
  const [zahlFehler, setZahlFehler] = useState<string | null>(null);
  const [sumupKey, setSumupKey] = useState<string | null>(null);
  // Vorläufige Rechnung (Übersicht vor dem Buchen) + Abschluss-Zustand.
  const [beleg, setBeleg] = useState<Beleg | null>(null);
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
    jsonFetch<{ sumupAffiliateKey: string | null }>("/api/kasse/konfig")
      .then((k) => setSumupKey(k.sumupAffiliateKey))
      .catch(() => undefined);
    jsonFetch<{ titel?: string; untertitel?: string | null; logoUrl?: string | null; aktiveVeranstaltung?: { name: string } | null }>(
      "/api/konfiguration",
    )
      .then((k) =>
        setKonfig({ titel: k.titel || "Kirchtag", untertitel: k.aktiveVeranstaltung?.name ?? k.untertitel ?? null, logoUrl: k.logoUrl ?? null }),
      )
      .catch(() => undefined);
  }, []);

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

  // Schritt 1: „Bezahlen" bucht NICHT, sondern zeigt die komplette Rechnung zur
  // Kontrolle. Rückgeld wird lokal berechnet (Server rechnet beim Abschluss erneut).
  function bezahlen(gegebenCent: number | null, art: string) {
    if (anzahl === 0) return;
    const rueckgeldCent = art === "BAR" && gegebenCent != null && gegebenCent >= summe ? gegebenCent - summe : null;
    setBeleg({
      positionen: positionen.map((p) => ({ produktName: p.name, menge: p.menge, einzelpreisCent: p.preisCent, summeCent: p.preisCent * p.menge })),
      summeCent: summe,
      art,
      gegebenCent: art === "BAR" ? gegebenCent : null,
      rueckgeldCent,
    });
    setAbschlussFehler(null);
    setOffen(false);
  }

  // „Korrigieren": Rechnung verwerfen und zurück in den Warenkorb (nichts gebucht).
  function korrigieren() {
    setBeleg(null);
    setAbschlussFehler(null);
  }

  // Schritt 2: Verkauf jetzt buchen (erst hier entsteht der Datensatz), optional drucken.
  async function abschliessen(drucken: boolean) {
    if (!beleg || abschlussLaedt) return;
    setAbschlussLaedt(true);
    setAbschlussFehler(null);
    try {
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
      if (drucken) {
        const bon: BonDaten = {
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
        };
        druckeBon(bon);
      }
      clientRef.current = uuid();
      setKorb({});
      setNotiz("");
      setBeleg(null);
    } catch (e) {
      setAbschlussFehler((e as Error).message);
    } finally {
      setAbschlussLaedt(false);
    }
  }

  return (
    <div className="flex-1 flex min-h-0">
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 p-3 border-b border-neutral-800 space-y-2">
          {fehler && <p className="text-red-300 text-sm">{fehler}</p>}
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
        <div className="p-3 border-b border-neutral-800">
          <p className="text-[11px] text-neutral-400">Tresen: Kunde bestellt, bekommt &amp; zahlt direkt am Stand.</p>
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
          <button
            className="btn-primary w-full"
            onClick={() => {
              if (anzahl === 0) return;
              setZahlFehler(null);
              setOffen(true);
            }}
            disabled={anzahl === 0}
          >
            Kassieren ({formatCent(summe)})
          </button>
        </div>
      </aside>

      {offen && (
        <ZahlModal
          nummer={0}
          titel="Direktverkauf kassieren"
          summeCent={summe}
          positionen={positionen.map((p) => ({ produktName: p.name, menge: p.menge, einzelpreisCent: p.preisCent, summeCent: p.preisCent * p.menge }))}
          laedt={false}
          fehler={zahlFehler}
          sumupAffiliateKey={sumupKey}
          onAbbrechen={() => setOffen(false)}
          onBezahlen={bezahlen}
        />
      )}

      {beleg && (
        <BelegUebersicht
          beleg={beleg}
          laedt={abschlussLaedt}
          fehler={abschlussFehler}
          onKorrigieren={korrigieren}
          onFertig={() => abschliessen(false)}
          onDrucken={() => abschliessen(true)}
        />
      )}
    </div>
  );
}
