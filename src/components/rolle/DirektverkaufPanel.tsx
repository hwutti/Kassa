"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { useLive } from "@/lib/useLive";
import { formatCent } from "@/lib/money";
import { ZahlModal } from "@/components/rolle/ZahlModal";
import { BelegUebersicht, type Beleg } from "@/components/rolle/BelegUebersicht";
import { ProduktGrid, type Kat, type Prod, type Korb } from "@/components/verkauf/ProduktGrid";
import { Warenkorb } from "@/components/verkauf/Warenkorb";
import { druckeBon, type BonDaten } from "@/lib/bon";
import { uuid } from "@/lib/id";

/**
 * Direktverkauf/Tresen-Panel: Kunde bestellt direkt am Stand, bekommt alles dort
 * und zahlt sofort – alles in EINEM Schritt (ohne Tisch, ohne Küchenticket,
 * ohne Ausgabe-Liste). Wird sowohl im Verkauf als auch im Bereich verwendet.
 * Erfordert Kassenrecht (serverseitig geprüft).
 */
export function DirektverkaufPanel() {
  const [kategorien, setKategorien] = useState<Kat[]>([]);
  const [produkte, setProdukte] = useState<Prod[]>([]);
  const [korb, setKorb] = useState<Korb>({});
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

  const ladeProdukte = useCallback(async () => {
    try {
      const d = await jsonFetch<{ kategorien: Kat[]; produkte: Prod[] }>("/api/kellner/produkte");
      setKategorien(d.kategorien);
      setProdukte(d.produkte);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, []);

  useEffect(() => {
    ladeProdukte();
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
  }, [ladeProdukte]);
  // Live: Ausverkauft-Status/Produktänderungen sofort übernehmen.
  useLive(ladeProdukte);

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
      <div className="flex-1 min-w-0 flex flex-col">
        {fehler && <p className="text-red-300 text-sm px-3 pt-2">{fehler}</p>}
        <ProduktGrid kategorien={kategorien} produkte={produkte} korb={korb} onPlus={plus} onMenge={menge} />
      </div>

      <aside className="w-80 shrink-0 border-l border-neutral-800 flex flex-col">
        <div className="p-3 border-b border-neutral-800">
          <p className="text-[11px] text-neutral-400">Tresen: Kunde bestellt, bekommt &amp; zahlt direkt am Stand.</p>
        </div>
        <Warenkorb positionen={positionen} onMenge={menge} notiz={notiz} setNotiz={setNotiz} />
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
